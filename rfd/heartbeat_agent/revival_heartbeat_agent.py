#!/usr/bin/env python3
"""
OurRevival heartbeat agent for one RFD v347 game server.

Runs as a separate, long-lived process next to ONE RFD server, under the same
(unprivileged) server account. Standard library only.

What it does, and nothing else:
  - identifies its GameServer by the id + credential in its config;
  - every `interval_seconds` (default 30) checks that the local RFD web port
    accepts TCP connections and sends
        POST {api_url}/api/internal/servers/{id}/heartbeat
        {"playerCount": N, "maxPlayers": M, "status": "online"}
  - after two consecutive failed probes reports the server `offline`, and
    resumes heartbeats when the port comes back;
  - on SIGTERM/SIGINT reports `offline` and exits;
  - `--drain` / `--offline` send that one request and exit.

What it never does: spawn processes, run shell commands, run Lua, read or
write RFD process memory, call RFD/RCC admin endpoints, accept inbound
connections, or dispatch any remote instruction. The API's response is used
only to log the server's status.

Player count
------------
RFD v347 exposes no presence or player-count API, and RFD's `players` table
keeps rows after a player leaves. The only trusted local signal is the join
ledger written by revival_ticket_adapter.py (one entry per admitted join:
wall-clock time + numeric user id, no tickets). The agent reports the number
of DISTINCT user ids that joined within `player_window_seconds`, capped at
`max_players`. This is an ESTIMATE that errs high (players who left recently
still count), which is the safe direction: matchmaking sends fewer players
to a server that looks fuller. It is never used for authorization.

Config: a TOML file (see heartbeat.example.toml). The credential is read
from `credential_file` (absolute path, chmod 600 on POSIX) or from the
REVIVAL_GAME_SERVER_CREDENTIAL environment variable; it may not appear in the
TOML file itself and is never logged.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import os
import re
import signal
import socket
import sys
import threading
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request

CREDENTIAL_PATTERN = re.compile(r"^rvgs_[A-Za-z0-9_-]{43}$")
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
HTTP_TIMEOUT_SECONDS = 10
MAX_RESPONSE_BYTES = 65536
PROBE_TIMEOUT_SECONDS = 3
PROBE_FAILURES_BEFORE_OFFLINE = 2
MAX_LEDGER_BYTES = 4 * 1024 * 1024

ALLOWED_KEYS = {
    "api_url",
    "server_id",
    "credential_file",
    "join_ledger_path",
    "max_players",
    "rfd_host",
    "rfd_port",
    "interval_seconds",
    "player_window_seconds",
}
REQUIRED_KEYS = {"api_url", "server_id", "max_players", "rfd_port"}

log = logging.getLogger("revival_heartbeat_agent")


class AgentError(Exception):
    pass


# --- configuration ---------------------------------------------------------


def validate_api_url(url: str) -> str:
    """Origin only. HTTPS anywhere; plain HTTP only to loopback or a private-network IP literal."""
    if not isinstance(url, str):
        raise AgentError("api_url must be a string")
    try:
        parts = urllib.parse.urlsplit(url)
        parts.port
    except ValueError:
        raise AgentError("api_url malformed") from None
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
        raise AgentError("api_url must be a bare origin like https://api.internal:4000")
    if parts.scheme == "http":
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            ip = None
        if not (host == "localhost" or (ip is not None and (ip.is_loopback or ip.is_private))):
            raise AgentError("plain HTTP is only allowed to loopback or a private-network IP")
    return f"{parts.scheme}://{parts.netloc}"


def validate_probe_host(host: str) -> str:
    """The RFD server must be on this machine or the private network; IP literal or localhost."""
    if host == "localhost":
        return "127.0.0.1"
    try:
        ip = ipaddress.ip_address(host)
    except (ValueError, TypeError):
        raise AgentError("rfd_host must be localhost or an IP literal") from None
    if not (ip.is_loopback or ip.is_private):
        raise AgentError("rfd_host must be a loopback or private-network address")
    return str(ip)


def _int(conf: dict, key: str, default: int | None, lo: int, hi: int) -> int:
    value = conf.get(key, default)
    if not isinstance(value, int) or isinstance(value, bool) or not lo <= value <= hi:
        raise AgentError(f"{key} must be an integer between {lo} and {hi}")
    return value


def read_secret_file(path: str) -> str:
    if not isinstance(path, str) or not os.path.isabs(path):
        raise AgentError("credential_file must be an absolute path")
    with open(path, "r", encoding="utf-8") as fh:
        if os.name == "posix" and os.fstat(fh.fileno()).st_mode & 0o077:
            raise AgentError("credential file must not be readable by group/other (chmod 600)")
        return fh.read(256).strip()


def load_config(path: str, environ=os.environ) -> dict:
    with open(path, "rb") as fh:
        conf = tomllib.load(fh)
    unknown = set(conf) - ALLOWED_KEYS
    if unknown:
        # Also catches a pasted `credential = "rvgs_..."`: secrets do not belong in this file.
        raise AgentError("unknown config keys: " + ", ".join(sorted(unknown)))
    missing = REQUIRED_KEYS - set(conf)
    if missing:
        raise AgentError("missing config keys: " + ", ".join(sorted(missing)))
    server_id = conf["server_id"]
    if not isinstance(server_id, str) or not UUID_PATTERN.match(server_id):
        raise AgentError("server_id must be a lower-case UUID")
    ledger = conf.get("join_ledger_path")
    if ledger is not None and (not isinstance(ledger, str) or not os.path.isabs(ledger)):
        raise AgentError("join_ledger_path must be an absolute path")

    if "credential_file" in conf:
        credential = read_secret_file(conf["credential_file"])
    else:
        credential = environ.get("REVIVAL_GAME_SERVER_CREDENTIAL", "").strip()
    if not CREDENTIAL_PATTERN.match(credential):
        raise AgentError("game-server credential missing or malformed")

    return {
        "api_url": validate_api_url(conf["api_url"]),
        "server_id": server_id,
        "credential": credential,
        "join_ledger_path": ledger,
        "max_players": _int(conf, "max_players", None, 1, 200),
        "rfd_host": validate_probe_host(conf.get("rfd_host", "127.0.0.1")),
        "rfd_port": _int(conf, "rfd_port", None, 1, 65535),
        "interval_seconds": _int(conf, "interval_seconds", 30, 5, 60),
        "player_window_seconds": _int(conf, "player_window_seconds", 1200, 60, 86400),
    }


# --- local signals -----------------------------------------------------------


def probe_rfd(host: str, port: int, timeout: float = PROBE_TIMEOUT_SECONDS) -> bool:
    """TCP connect to the RFD web port. No data is sent (RFD's HTTPS cert is self-signed,
    and TLS verification is never disabled, so the agent does not speak HTTPS to it)."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def estimate_player_count(ledger_path: str | None, window_seconds: int, max_players: int, now: float | None = None) -> int:
    """Distinct user ids admitted within the window, capped at max_players. 0 if no ledger."""
    if not ledger_path:
        return 0
    now = time.time() if now is None else now
    try:
        with open(ledger_path, "r", encoding="utf-8") as fh:
            raw = fh.read(MAX_LEDGER_BYTES + 1)
    except FileNotFoundError:
        return 0
    if len(raw) > MAX_LEDGER_BYTES:
        log.warning("join ledger too large; reporting a full server")
        return max_players
    try:
        data = json.loads(raw)
        joins = data["joins"] if data.get("version") == 1 else None
        if not isinstance(joins, list):
            raise ValueError
    except (ValueError, KeyError, AttributeError, TypeError):
        log.warning("join ledger unreadable; reporting a full server")
        return max_players  # fail toward "full": never over-fill because of a bad file
    uids = set()
    for entry in joins:
        if not isinstance(entry, dict):
            continue
        t, uid = entry.get("t"), entry.get("uid")
        if isinstance(t, (int, float)) and isinstance(uid, int) and not isinstance(uid, bool) and 0 <= now - t < window_seconds:
            uids.add(uid)
    return min(len(uids), max_players)


# --- API client ------------------------------------------------------------------


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # never follow redirects with the credential
        return None


_OPENER = urllib.request.build_opener(_NoRedirect())


class ApiClient:
    def __init__(self, api_url: str, server_id: str, credential: str, opener=None):
        self._base = f"{api_url}/api/internal/servers/{server_id}/"
        self._credential = credential
        self._open = (opener or _OPENER).open

    def post(self, action: str, body: dict | None = None) -> dict:
        if action not in ("heartbeat", "drain", "offline"):
            raise AgentError("unsupported action")  # fixed, typed endpoints only
        request = urllib.request.Request(
            self._base + action,
            data=json.dumps(body or {}).encode("utf-8"),
            headers={
                "Authorization": "Bearer " + self._credential,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with self._open(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read(MAX_RESPONSE_BYTES).decode("utf-8"))
        except urllib.error.HTTPError as err:
            err.close()
            raise AgentError(f"{action} failed: HTTP {err.code}") from None
        except (OSError, ValueError) as err:
            raise AgentError(f"{action} failed: {type(err).__name__}") from None
        server = payload.get("server") if isinstance(payload, dict) else None
        if not isinstance(server, dict) or not isinstance(server.get("status"), str):
            raise AgentError(f"{action} returned an unexpected body")
        return server


# --- main loop -------------------------------------------------------------------


class Agent:
    def __init__(self, config: dict, client: ApiClient, probe=probe_rfd, clock=time.time):
        self.config = config
        self.client = client
        self.probe = probe
        self.clock = clock
        self.failed_probes = 0
        self.reported_offline = False
        self.stop = threading.Event()

    def tick(self) -> str:
        """One cycle. Returns what happened (for logs/tests). Never raises."""
        c = self.config
        try:
            if not self.probe(c["rfd_host"], c["rfd_port"]):
                self.failed_probes += 1
                if self.failed_probes >= PROBE_FAILURES_BEFORE_OFFLINE and not self.reported_offline:
                    self.client.post("offline")
                    self.reported_offline = True
                    log.warning("RFD port not reachable; reported offline")
                    return "offline"
                return "probe-failed"
            self.failed_probes = 0
            count = estimate_player_count(c["join_ledger_path"], c["player_window_seconds"], c["max_players"], self.clock())
            server = self.client.post("heartbeat", {"playerCount": count, "maxPlayers": c["max_players"], "status": "online"})
            self.reported_offline = False
            log.info("heartbeat ok: status=%s players=%d/%d", server["status"], count, c["max_players"])
            return "heartbeat"
        except AgentError as err:
            log.warning("%s", err)  # retried next interval; a missed beat makes the server go stale, not joinable
            return "error"
        except Exception as err:  # noqa: BLE001 - keep the agent alive; details never include secrets
            log.warning("unexpected error: %s", type(err).__name__)
            return "error"

    def shutdown(self) -> None:
        try:
            self.client.post("offline")
            log.info("reported offline")
        except AgentError as err:
            log.warning("%s (the server will go stale instead)", err)

    def run(self) -> None:
        while not self.stop.is_set():
            self.tick()
            self.stop.wait(self.config["interval_seconds"])
        self.shutdown()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="OurRevival RFD heartbeat agent")
    parser.add_argument("--config", required=True, help="path to heartbeat TOML config")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--drain", action="store_true", help="stop receiving new players, then exit")
    mode.add_argument("--offline", action="store_true", help="report offline, then exit")
    mode.add_argument("--once", action="store_true", help="one heartbeat cycle, then exit")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    try:
        config = load_config(args.config)
    except (AgentError, OSError, tomllib.TOMLDecodeError) as err:
        log.error("config error: %s", err)
        return 1
    client = ApiClient(config["api_url"], config["server_id"], config["credential"])

    if args.drain or args.offline:
        try:
            server = client.post("drain" if args.drain else "offline")
        except AgentError as err:
            log.error("%s", err)
            return 1
        log.info("server status: %s", server["status"])
        return 0

    agent = Agent(config, client)
    if args.once:
        return 0 if agent.tick() == "heartbeat" else 1

    def _stop(signum, _frame):
        log.info("signal %d received; shutting down", signum)
        agent.stop.set()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    agent.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
