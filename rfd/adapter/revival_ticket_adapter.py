"""
OurRevival join-ticket adapter for Roblox Freedom Distribution (RFD) v347.

Runs INSIDE the RFD server process, called from GameConfig.toml hooks
(python call mode). Standard library only. It never executes commands,
never runs Lua, and only talks to ONE configured API endpoint:

    POST {REVIVAL_API_URL}/api/internal/join-tickets/redeem
    Authorization: Bearer <this server's rvgs_ credential>

Hook mapping (see rfd/GameConfig.revival.toml):
    server_core.check_user_allowed(user_code)          -> check_user_allowed
    server_core.retrieve_user_id(user_code)            -> retrieve_user_id
    server_core.retrieve_username(id_num, user_code)   -> retrieve_username
    server_core.check_user_has_admin(id_num, code)     -> always False
    server_core.retrieve_default_user_code()           -> an invalid code (no ticket, no entry)

The player's `-u` user code IS the one-time join ticket.

Why a local cache: RFD calls check_user_allowed several times per join
(join-data creation, then again from /rfd/verify-player with a 7 s cache).
The API redeems a ticket exactly once, so the adapter redeems on the first
call and remembers the result for ADMIT_WINDOW_SECONDS. After that window the
same code is refused again, which bounds replay of an old ticket against this
server even though RFD's own sqlite keeps the code -> player mapping.

Why the sqlite fix-up: RFD's `players` table has UNIQUE(id_number) and
UNIQUE(username) with ON CONFLICT IGNORE, and RFD loops calling
retrieve_user_id until an insert sticks. With a fresh ticket per join, a
returning player's insert would be ignored forever. Before returning the
stable id, retrieve_user_id deletes the previous (stale) mapping rows for that
id/username so RFD can insert the new code. Verified against RFD commit
510b6e25 (Source/storage/players.py); the adapter checks the table's columns
and fails closed if the schema differs.

Configuration (environment of the RFD server process; never in the repo):
    REVIVAL_API_URL                     e.g. http://10.0.0.2:4000 (internal)
    REVIVAL_GAME_SERVER_CREDENTIAL_FILE path to a file holding rvgs_...  (preferred)
    REVIVAL_GAME_SERVER_CREDENTIAL      rvgs_... (alternative)
    REVIVAL_RFD_SQLITE_PATH             optional; defaults to <CONFIG_DIR>/_.sqlite
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.request

TICKET_PATTERN = re.compile(r"^rvjt_[A-Za-z0-9_-]{43}$")
CREDENTIAL_PATTERN = re.compile(r"^rvgs_[A-Za-z0-9_-]{43}$")
ADMIT_WINDOW_SECONDS = 120
NEGATIVE_CACHE_SECONDS = 30
HTTP_TIMEOUT_SECONDS = 5
MAX_CACHE_ENTRIES = 5000
NO_TICKET_USER_CODE = "no-ticket"

log = logging.getLogger("revival_ticket_adapter")

_lock = threading.Lock()
# sha256(ticket) -> {"allowed": bool, "until": float, "identity": dict | None}
_cache: dict[str, dict] = {}
_settings: dict = {"config_dir": None}


class AdapterError(Exception):
    pass


def configure(config_dir: str | None = None) -> None:
    _settings["config_dir"] = config_dir


def _key(user_code: str) -> str:
    return hashlib.sha256(user_code.encode("utf-8")).hexdigest()


def _credential() -> str:
    path = os.environ.get("REVIVAL_GAME_SERVER_CREDENTIAL_FILE")
    value = ""
    if path:
        with open(path, "r", encoding="utf-8") as fh:
            value = fh.read().strip()
    else:
        value = os.environ.get("REVIVAL_GAME_SERVER_CREDENTIAL", "").strip()
    if not CREDENTIAL_PATTERN.match(value):
        raise AdapterError("game-server credential missing or malformed")
    return value


def _api_url() -> str:
    url = os.environ.get("REVIVAL_API_URL", "").rstrip("/")
    if not re.match(r"^https?://[^\s/@?#]+$", url):
        raise AdapterError("REVIVAL_API_URL missing or malformed")
    return url


def _redeem(ticket: str, opener=urllib.request.urlopen) -> dict | None:
    """Returns the identity dict on success, None on any rejection or error (fail closed)."""
    request = urllib.request.Request(
        _api_url() + "/api/internal/join-tickets/redeem",
        data=json.dumps({"ticket": ticket}).encode("utf-8"),
        headers={"Authorization": "Bearer " + _credential(), "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with opener(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read(65536).decode("utf-8"))
    except urllib.error.HTTPError as err:
        reason = None
        try:
            reason = json.loads(err.read(4096).decode("utf-8")).get("error", {}).get("details", {}).get("reason")
        except Exception:
            pass
        log.warning("join ticket rejected (status=%s reason=%s)", err.code, reason)
        return None
    except Exception as err:  # network errors, bad JSON, timeouts
        log.warning("join ticket redemption failed: %s", type(err).__name__)
        return None
    user = body.get("user") if isinstance(body, dict) else None
    if (
        not isinstance(body, dict)
        or body.get("allowed") is not True
        or not isinstance(user, dict)
        or not isinstance(user.get("numericId"), int)
        or user["numericId"] <= 0
        or not isinstance(user.get("username"), str)
        or not user["username"]
    ):
        log.warning("join ticket redemption returned an unexpected body")
        return None
    return {"numeric_id": user["numericId"], "username": user["username"]}


def _prune(now: float) -> None:
    if len(_cache) <= MAX_CACHE_ENTRIES:
        return
    for k in [k for k, v in _cache.items() if v["until"] < now]:
        del _cache[k]


def check_user_allowed(user_code, opener=urllib.request.urlopen) -> bool:
    if not isinstance(user_code, str) or not TICKET_PATTERN.match(user_code):
        return False
    key = _key(user_code)
    now = time.time()
    with _lock:
        entry = _cache.get(key)
        if entry is not None:
            if now < entry["until"]:
                return entry["allowed"]
            if entry["allowed"]:
                # Admission window over: a redeemed ticket is never valid again.
                return False
        identity = _redeem(user_code, opener)
        if identity is None:
            _cache[key] = {"allowed": False, "until": now + NEGATIVE_CACHE_SECONDS, "identity": None}
            return False
        _cache[key] = {"allowed": True, "until": now + ADMIT_WINDOW_SECONDS, "identity": identity}
        _prune(now)
        log.info("admitted user %s", identity["numeric_id"])
        return True


def _identity(user_code) -> dict:
    with _lock:
        entry = _cache.get(_key(user_code)) if isinstance(user_code, str) else None
    if not entry or not entry["allowed"] or not entry["identity"]:
        # RFD only asks after check_user_allowed succeeded; anything else fails closed.
        raise AdapterError("no redeemed identity for this user code")
    return entry["identity"]


def _sqlite_path() -> str:
    explicit = os.environ.get("REVIVAL_RFD_SQLITE_PATH")
    if explicit:
        return explicit
    base = _settings.get("config_dir") or "."
    return os.path.join(base, "_.sqlite")


def _free_player_slot(numeric_id: int, username: str, user_code: str) -> None:
    """Delete stale RFD `players` rows for this id/username so the new code can be inserted."""
    path = _sqlite_path()
    if not os.path.exists(path):
        return  # fresh server: nothing to clean
    conn = sqlite3.connect(path, timeout=5)
    try:
        cols = [row[1] for row in conn.execute('PRAGMA table_info("players")')]
        if not cols:
            return
        if sorted(cols) != ["id_number", "user_code", "username"]:
            raise AdapterError("unexpected RFD players schema; refusing to modify it")
        conn.execute(
            'DELETE FROM "players" WHERE ("id_number" = ? OR "username" = ?) AND "user_code" <> ?',
            (numeric_id, username, user_code),
        )
        conn.commit()
    finally:
        conn.close()


def retrieve_user_id(user_code) -> int:
    identity = _identity(user_code)
    _free_player_slot(identity["numeric_id"], identity["username"], user_code)
    return identity["numeric_id"]


def retrieve_username(id_num, user_code) -> str:
    identity = _identity(user_code)
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
        _cache.clear()
