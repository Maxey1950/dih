"""
OurRevival join-ticket adapter for Roblox Freedom Distribution (RFD) v347.

Runs INSIDE the RFD server process, called from GameConfig.toml hooks
(python call mode). Standard library only. It never executes commands, never
runs Lua, and talks to exactly ONE configured endpoint:

    POST {REVIVAL_API_URL}/api/internal/join-tickets/redeem
    Authorization: Bearer <this server's rvgs_ credential>

The player's `-u` user code IS the one-time join ticket.

How RFD authorizes a player (verified against RFD commit 510b6e25)
-----------------------------------------------------------------
1. Join data (/game/join.ashx, /game/PlaceLauncher.ashx) calls
   add_player_to_players_database(user_code):
     - if RFD's sqlite `players` table already maps user_code -> player, it
       returns that player WITHOUT calling any hook;
     - otherwise check_user_allowed.cached_call(7, user_code), then
       retrieve_user_id(user_code) and retrieve_username(id, user_code).
2. When the client actually connects, RCC's Players.PlayerAdded handler calls
   /rfd/is-player-allowed?userId=<id>, which looks up user_code by id and calls
   check_user_allowed.cached_call(7, user_code). A `false` kicks the player.
   This is the only per-connection gate RFD has.
RFD caches check_user_allowed results for 7 s per user_code, and hook calls
carry no connection identity.

Join-state machine (one redeemed ticket = one connection)
---------------------------------------------------------
Per ticket (keyed by SHA-256 of the user code, per server process):

    (none) --check: API redeem ok--> REDEEMED --retrieve_user_id--> BOUND
    BOUND --check (the PlayerAdded verification)--> ADMITTED   (returns True once)
    ADMITTED --check--> False (a second independent connection)
    any state past ADMISSION_WINDOW_SECONDS after redemption --> CLOSED (False)
    API rejection --> REJECTED (False; re-asked after NEGATIVE_CACHE_SECONDS)

- Repeated join-data calls before RFD binds the identity (REDEEMED) are the
  same join and return True without contacting the API again.
- The first check after binding is the connection verification and consumes
  the single admission. Any later check for that ticket returns False.
- The API redeems a ticket once, globally, so another server, a restarted
  adapter, or a restarted RFD cannot reuse it either.

Residual risk outside the adapter's control (documented in
docs/phase-4.5-rfd-hardening.md): RFD answers repeated checks for the same
user code from its own 7-second cache without calling this adapter. If the
legitimate client connects within 7 s of join data (so its verification is
served from RFD's cache and the adapter never sees it), the single admission
stays unconsumed until the admission window closes. An attacker holding the
same raw ticket could use it within that window (at most
ADMISSION_WINDOW_SECONDS after redemption), and only on this server, as the
same user. Closing this completely requires a per-connection signal from RFD.

Configuration (environment of the RFD server process; never in the repo):
    REVIVAL_API_URL                     internal API origin, e.g. https://api.internal or
                                        http://10.0.0.2:4000 (plain HTTP: loopback/private IPs only)
    REVIVAL_GAME_SERVER_CREDENTIAL_FILE absolute path to a chmod-600 file containing rvgs_...
    REVIVAL_GAME_SERVER_CREDENTIAL      rvgs_... (alternative)
    REVIVAL_RFD_SQLITE_PATH             optional; defaults to <CONFIG_DIR>/_.sqlite
    REVIVAL_JOIN_LEDGER_PATH            optional; join ledger for the heartbeat agent
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import logging
import os
import re
import sqlite3
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

TICKET_PATTERN = re.compile(r"^rvjt_[A-Za-z0-9_-]{43}$")
CREDENTIAL_PATTERN = re.compile(r"^rvgs_[A-Za-z0-9_-]{43}$")
# From redemption to the client's PlayerAdded verification. Covers client
# launch + connect; after this the ticket authorizes nothing on this server.
ADMISSION_WINDOW_SECONDS = 60
NEGATIVE_CACHE_SECONDS = 30
HTTP_TIMEOUT_SECONDS = 5
MAX_STATES = 5000
LEDGER_RETENTION_SECONDS = 24 * 3600
NO_TICKET_USER_CODE = "no-ticket"
EXPECTED_PLAYERS_COLUMNS = ["id_number", "user_code", "username"]

REDEEMED, BOUND, ADMITTED, CLOSED, REJECTED = "redeemed", "bound", "admitted", "closed", "rejected"

log = logging.getLogger("revival_ticket_adapter")

_lock = threading.Lock()
_states: dict[str, dict] = {}
_key_locks: dict[str, threading.Lock] = {}
_settings: dict = {"config_dir": None}
_ledger: list[dict] = []


def _now() -> float:
    return time.monotonic()


class AdapterError(Exception):
    pass


def configure(config_dir: str | None = None) -> None:
    _settings["config_dir"] = config_dir


def _key(user_code: str) -> str:
    return hashlib.sha256(user_code.encode("utf-8")).hexdigest()


def _credential() -> str:
    path = os.environ.get("REVIVAL_GAME_SERVER_CREDENTIAL_FILE")
    if path:
        value = read_secret_file(path)
    else:
        value = os.environ.get("REVIVAL_GAME_SERVER_CREDENTIAL", "").strip()
    if not CREDENTIAL_PATTERN.match(value):
        raise AdapterError("game-server credential missing or malformed")
    return value


def read_secret_file(path: str) -> str:
    """Read a credential file that only the server account may access (POSIX: no group/other bits)."""
    if not os.path.isabs(path):
        raise AdapterError("credential file path must be absolute")
    with open(path, "r", encoding="utf-8") as fh:
        if os.name == "posix" and os.fstat(fh.fileno()).st_mode & 0o077:
            raise AdapterError("credential file must not be readable by group/other (chmod 600)")
        return fh.read(256).strip()


def validate_api_url(url: str) -> str:
    """Origin only. HTTPS anywhere; plain HTTP only to loopback or a private-network IP literal."""
    try:
        parts = urllib.parse.urlsplit(url)
        port = parts.port
    except ValueError:
        raise AdapterError("REVIVAL_API_URL malformed") from None
    host = parts.hostname or ""
    if (
        parts.scheme not in ("https", "http")
        or not host
        or parts.username is not None
        or parts.password is not None
        or parts.path not in ("", "/")
        or parts.query
        or parts.fragment
        or re.search(r"\s", url)
    ):
        raise AdapterError("REVIVAL_API_URL must be a bare origin like https://api.internal:4000")
    if parts.scheme == "http":
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            ip = None
        if not (host == "localhost" or (ip is not None and (ip.is_loopback or ip.is_private))):
            raise AdapterError("plain HTTP is only allowed to loopback or a private-network IP")
    return f"{parts.scheme}://{parts.netloc}"


def _api_url() -> str:
    return validate_api_url(os.environ.get("REVIVAL_API_URL", "").strip())


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # never re-send the credential to another URL
        return None


_urlopen = urllib.request.build_opener(_NoRedirect()).open


def _redeem(ticket: str, opener=None) -> tuple[dict | None, bool]:
    """(identity, definitive). identity is None on any failure (fail closed);
    definitive is True only when the API itself refused the ticket (HTTP 403/404).
    Transient failures (429, 5xx, timeouts, network, odd bodies) are not definitive."""
    request = urllib.request.Request(
        _api_url() + "/api/internal/join-tickets/redeem",
        data=json.dumps({"ticket": ticket}).encode("utf-8"),
        headers={"Authorization": "Bearer " + _credential(), "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    opener = opener or _urlopen
    try:
        with opener(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read(65536).decode("utf-8"))
    except urllib.error.HTTPError as err:
        reason = None
        try:
            reason = json.loads(err.read(4096).decode("utf-8")).get("error", {}).get("details", {}).get("reason")
        except Exception:
            pass
        err.close()
        log.warning("join ticket rejected (status=%s reason=%s)", err.code, reason)
        return None, err.code in (403, 404)
    except Exception as err:  # network errors, bad JSON, timeouts
        log.warning("join ticket redemption failed: %s", type(err).__name__)
        return None, False
    user = body.get("user") if isinstance(body, dict) else None
    if (
        not isinstance(body, dict)
        or body.get("allowed") is not True
        or not isinstance(user, dict)
        or not isinstance(user.get("numericId"), int)
        or isinstance(user.get("numericId"), bool)
        or user["numericId"] <= 0
        or not isinstance(user.get("username"), str)
        or not re.match(r"^[A-Za-z0-9_]{3,20}$", user["username"])
    ):
        log.warning("join ticket redemption returned an unexpected body")
        return None, False
    return {"numeric_id": user["numericId"], "username": user["username"]}, False


def _prune(now: float) -> None:
    if len(_states) > MAX_STATES:
        for k in [k for k, s in _states.items() if s["phase"] in (CLOSED, REJECTED, ADMITTED) and now > s["deadline"]]:
            del _states[k]
    if len(_key_locks) > MAX_STATES:
        for k in [k for k, lk in _key_locks.items() if k not in _states and not lk.locked()]:
            del _key_locks[k]


def _key_lock(key: str) -> threading.Lock:
    with _lock:
        lk = _key_locks.get(key)
        if lk is None:
            lk = _key_locks[key] = threading.Lock()
        return lk


def _decide_from_state(key: str, now: float) -> bool | None:
    """Answer from the join state, or None when the API must be asked. Caller holds _lock."""
    state = _states.get(key)
    if state is None:
        return None
    phase = state["phase"]
    if phase == REJECTED:
        # After the negative-cache period, ask the API again (it refuses a used ticket).
        return False if now < state["deadline"] else None
    if phase in (ADMITTED, CLOSED):
        return False
    if now >= state["deadline"]:
        state["phase"] = CLOSED
        return False
    if phase == REDEEMED:
        return True  # repeated join-data call for the same join
    # BOUND: this is the connection verification, and there is exactly one.
    state["phase"] = ADMITTED
    log.info("admitted user %s", state["identity"]["numeric_id"])
    return True


def check_user_allowed(user_code, opener=None) -> bool:
    if not isinstance(user_code, str) or not TICKET_PATTERN.match(user_code):
        return False
    key = _key(user_code)
    # One in-flight decision per ticket (so a ticket is never redeemed twice
    # concurrently); different tickets never wait on each other's API call.
    with _key_lock(key):
        with _lock:
            decision = _decide_from_state(key, _now())
        if decision is not None:
            return decision
        identity, definitive = _redeem(user_code, opener)
        now = _now()
        with _lock:
            if identity is None:
                if definitive:
                    _states[key] = {"phase": REJECTED, "deadline": now + NEGATIVE_CACHE_SECONDS, "identity": None}
                else:
                    _states.pop(key, None)  # transient: the next hook call asks the API again
                _prune(now)
                return False
            _states[key] = {"phase": REDEEMED, "deadline": now + ADMISSION_WINDOW_SECONDS, "identity": identity}
            _prune(now)
            return True


def _state_for_identity(user_code, allowed_phases) -> dict:
    if not isinstance(user_code, str) or not TICKET_PATTERN.match(user_code):
        raise AdapterError("invalid user code")
    with _lock:
        state = _states.get(_key(user_code))
        if not state or state["phase"] not in allowed_phases or _now() >= state["deadline"]:
            raise AdapterError("no active join for this user code")
        return state


def _sqlite_path() -> str:
    explicit = os.environ.get("REVIVAL_RFD_SQLITE_PATH")
    path = explicit if explicit else os.path.join(_settings.get("config_dir") or ".", "_.sqlite")
    if not os.path.isabs(path):
        raise AdapterError("RFD sqlite path must be absolute")
    return path


def _free_player_slot(numeric_id: int, username: str, user_code: str) -> None:
    """
    Remove THIS user's stale RFD `players` rows (older ticket codes) so RFD can
    insert the new code; otherwise RFD loops forever (UNIQUE ... ON CONFLICT
    IGNORE on id_number and username). Never touches another player's row:
    if the username is held by a different id, fail closed.
    """
    path = _sqlite_path()
    if not os.path.isfile(path):
        return  # fresh server: nothing to clean (and never create a database)
    uri = "file:" + urllib.request.pathname2url(path) + "?mode=rw"
    conn = sqlite3.connect(uri, uri=True, timeout=5, isolation_level=None)
    try:
        cols = sorted(row[1] for row in conn.execute('PRAGMA table_info("players")'))
        if not cols:
            return
        if cols != EXPECTED_PLAYERS_COLUMNS:
            raise AdapterError("unexpected RFD players schema; refusing to modify it")
        conn.execute("BEGIN IMMEDIATE")
        try:
            rows = conn.execute(
                'SELECT "user_code", "id_number", "username" FROM "players" WHERE ("id_number" = ? OR "username" = ?) AND "user_code" <> ?',
                (numeric_id, username, user_code),
            ).fetchall()
            for _code, row_id, row_name in rows:
                if row_id != numeric_id or row_name != username:
                    raise AdapterError("players row conflicts with a different player; refusing to modify it")
            for row_code, _id, _name in rows:
                conn.execute('DELETE FROM "players" WHERE "user_code" = ? AND "id_number" = ?', (row_code, numeric_id))
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()


def _record_join(numeric_id: int) -> None:
    """Append to the join ledger read by the heartbeat agent (wall-clock times, ids only)."""
    path = os.environ.get("REVIVAL_JOIN_LEDGER_PATH")
    if not path:
        return
    wall = time.time()
    with _lock:
        _ledger.append({"t": wall, "uid": numeric_id})
        _ledger[:] = [e for e in _ledger if wall - e["t"] < LEDGER_RETENTION_SECONDS]
        data = json.dumps({"version": 1, "joins": _ledger})
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".ledger-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(data)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def retrieve_user_id(user_code) -> int:
    state = _state_for_identity(user_code, (REDEEMED, BOUND))
    identity = state["identity"]
    _free_player_slot(identity["numeric_id"], identity["username"], user_code)
    with _lock:
        first_bind = state["phase"] == REDEEMED
        if first_bind:
            state["phase"] = BOUND
    if first_bind:
        try:
            _record_join(identity["numeric_id"])
        except Exception as err:  # the ledger is informational; never block a join on it
            log.warning("could not write join ledger: %s", type(err).__name__)
    return identity["numeric_id"]


def retrieve_username(id_num, user_code) -> str:
    identity = _state_for_identity(user_code, (BOUND, ADMITTED))["identity"]
    if int(id_num) != identity["numeric_id"]:
        raise AdapterError("user id mismatch")
    return identity["username"]


def check_user_has_admin(id_num, user_code) -> bool:
    return False


def retrieve_default_user_code(*_args) -> str:
    # Players without a ticket get a code that check_user_allowed always rejects.
    return NO_TICKET_USER_CODE


def _reset_for_tests() -> None:
    with _lock:
        _states.clear()
        _key_locks.clear()
        _ledger.clear()
