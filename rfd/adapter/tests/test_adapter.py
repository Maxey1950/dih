"""
Tests for revival_ticket_adapter, run WITHOUT RFD:
- the GameConfig hook snippets are executed through a copy of RFD's own
  python-call-mode wrapper (Source/config_type/types/callable.py @ 510b6e25);
- RFD's join flow (Source/web_server/endpoints/join_data.py
  add_player_to_players_database) and its exact `players` sqlite schema
  (Source/storage/players.py) are reproduced here;
- the API is a local fake HTTP server.
"""
import http.server
import json
import logging
import os
import sqlite3
import sys
import tempfile
import textwrap
import threading
import tomllib
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ADAPTER_DIR = os.path.dirname(HERE)
RFD_DIR = os.path.dirname(ADAPTER_DIR)
sys.path.insert(0, ADAPTER_DIR)
import revival_ticket_adapter as rta  # noqa: E402

CRED = "rvgs_" + "C" * 43
TICKET_A1 = "rvjt_" + "A" * 43
TICKET_A2 = "rvjt_" + "B" * 43
TICKET_BAD = "rvjt_" + "Z" * 43


class FakeApi(http.server.BaseHTTPRequestHandler):
    tickets = {}          # ticket -> identity
    redeemed = set()
    calls = []

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeApi.calls.append({"path": self.path, "auth": self.headers.get("Authorization"), "ticket": body.get("ticket")})
        ok = self.path == "/api/internal/join-tickets/redeem" and self.headers.get("Authorization") == "Bearer " + CRED
        t = body.get("ticket")
        if ok and t in FakeApi.tickets and t not in FakeApi.redeemed:
            FakeApi.redeemed.add(t)
            ident = FakeApi.tickets[t]
            payload = {"allowed": True, "user": {"id": "u", "numericId": ident[0], "username": ident[1], "displayName": ident[1]}, "game": {"id": "g", "placeId": 1}}
            self._send(200, payload)
        else:
            self._send(403, {"error": {"code": "JOIN_REJECTED", "message": "x", "details": {"reason": "already_redeemed" if t in FakeApi.redeemed else "invalid"}}})

    def _send(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def rfd_python_callable(rep: str, config_dir: str):
    """Verbatim logic of RFD's call_mode_enum.python branch."""
    local_vars = {}
    modded_rep = textwrap.dedent("""\
        def func():
        %(func_body)s
            return next(
                v
                for v in reversed(locals().values())
                if callable(v)
            )
        """) % {"func_body": textwrap.indent(rep, " " * 4)}
    exec(modded_rep, {"CONFIG_DIR": config_dir}, local_vars)
    return local_vars["func"]()


class FakeRfd:
    """Minimal reproduction of RFD's players table and join-data flow."""

    def __init__(self, config_dir):
        conf = tomllib.load(open(os.path.join(RFD_DIR, "GameConfig.revival.toml"), "rb"))["server_core"]
        self.hooks = {name: rfd_python_callable(conf[name], config_dir) for name in
                      ["check_user_allowed", "retrieve_user_id", "retrieve_username", "check_user_has_admin", "retrieve_default_user_code"]}
        self.db = sqlite3.connect(os.path.join(config_dir, "_.sqlite"))
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS "players" (
                "user_code" TEXT NOT NULL,
                "id_number" INTEGER NOT NULL,
                "username" TEXT NOT NULL,
                PRIMARY KEY("user_code") ON CONFLICT IGNORE,
                UNIQUE ("user_code") ON CONFLICT IGNORE,
                UNIQUE ("id_number") ON CONFLICT IGNORE,
                UNIQUE ("username") ON CONFLICT IGNORE
            );""")
        self.db.commit()

    def check(self, code):
        r = self.db.execute('SELECT "id_number", "username" FROM "players" WHERE "user_code" = ?', (code,)).fetchone()
        return r

    def join(self, code, max_loops=5):
        existing = self.check(code)
        if existing is not None:
            return (*existing, False)
        if not self.hooks["check_user_allowed"](code):
            return None
        for _ in range(max_loops):  # RFD loops forever; we cap to detect the bug
            iden = self.hooks["retrieve_user_id"](code)
            name = self.hooks["retrieve_username"](iden, code)
            self.db.execute('INSERT INTO "players" VALUES (?, ?, ?)', (code, iden, name))
            self.db.commit()
            r = self.check(code)
            if r is not None:
                return (*r, True)
        raise AssertionError("RFD would loop forever inserting this player")

    def verify_player(self, code):
        """/rfd/verify-player re-checks check_user_allowed."""
        return self.hooks["check_user_allowed"](code)


class AdapterTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeApi)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        FakeApi.tickets = {TICKET_A1: (7, "alice"), TICKET_A2: (7, "alice")}
        FakeApi.redeemed = set()
        FakeApi.calls = []
        rta._reset_for_tests()
        self.env = mock.patch.dict(os.environ, {
            "REVIVAL_API_URL": f"http://127.0.0.1:{self.server.server_port}",
            "REVIVAL_GAME_SERVER_CREDENTIAL": CRED,
        }, clear=False)
        self.env.start()
        os.environ.pop("REVIVAL_RFD_SQLITE_PATH", None)
        self.rfd = FakeRfd(self.tmp.name)

    def tearDown(self):
        self.env.stop()
        self.rfd.db.close()
        self.tmp.cleanup()

    def test_first_join_redeems_once_and_maps_identity(self):
        self.assertEqual(self.rfd.join(TICKET_A1), (7, "alice", True))
        self.assertTrue(self.rfd.verify_player(TICKET_A1), "re-check within admit window")
        self.assertTrue(self.rfd.verify_player(TICKET_A1))
        redeems = [c for c in FakeApi.calls if c["path"].endswith("/redeem")]
        self.assertEqual(len(redeems), 1, "ticket redeemed exactly once despite repeated hooks")
        self.assertEqual(redeems[0]["auth"], "Bearer " + CRED)

    def test_rejoin_with_new_ticket_does_not_loop(self):
        self.assertEqual(self.rfd.join(TICKET_A1)[:2], (7, "alice"))
        self.assertEqual(self.rfd.join(TICKET_A2), (7, "alice", True))
        rows = self.rfd.db.execute('SELECT "user_code" FROM "players"').fetchall()
        self.assertEqual(rows, [(TICKET_A2,)], "stale mapping replaced")

    def test_replay_after_admission_window_is_refused(self):
        self.rfd.join(TICKET_A1)
        with mock.patch("time.time", return_value=rta.time.time() + rta.ADMIT_WINDOW_SECONDS + 1):
            self.assertFalse(self.rfd.verify_player(TICKET_A1))
        rta._reset_for_tests()  # e.g. adapter restarted: API refuses the used ticket
        self.assertFalse(self.rfd.verify_player(TICKET_A1))

    def test_unknown_or_used_ticket_rejected_and_negative_cached(self):
        self.assertIsNone(self.rfd.join(TICKET_BAD))
        self.assertIsNone(self.rfd.join(TICKET_BAD))
        self.assertEqual(len(FakeApi.calls), 1, "negative result cached")

    def test_malformed_codes_never_reach_the_api(self):
        for code in ["", "no-ticket", "Guest 1", "rvgs_" + "C" * 43, TICKET_A1 + "x", None, 5]:
            self.assertFalse(rta.check_user_allowed(code))
        self.assertEqual(FakeApi.calls, [])
        self.assertIsNone(self.rfd.join(self.rfd.hooks["retrieve_default_user_code"]()))

    def test_identity_hooks_fail_closed_without_admission(self):
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_user_id(TICKET_A1)
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_username(7, TICKET_A1)
        self.assertFalse(self.rfd.hooks["check_user_has_admin"](7, TICKET_A1))

    def test_api_unreachable_fails_closed(self):
        with mock.patch.dict(os.environ, {"REVIVAL_API_URL": "http://127.0.0.1:9"}):
            self.assertFalse(rta.check_user_allowed(TICKET_A1))

    def test_missing_or_malformed_credential_fails_closed(self):
        with mock.patch.dict(os.environ, {"REVIVAL_GAME_SERVER_CREDENTIAL": "hunter2"}):
            with self.assertRaises(rta.AdapterError):
                rta.check_user_allowed(TICKET_A1)
        self.assertEqual(FakeApi.calls, [])

    def test_unexpected_players_schema_refused(self):
        self.rfd.join(TICKET_A1)
        self.rfd.db.execute('ALTER TABLE "players" ADD COLUMN "extra" TEXT')
        self.rfd.db.commit()
        rta.check_user_allowed(TICKET_A2)
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_user_id(TICKET_A2)

    def test_tickets_and_credentials_are_not_logged(self):
        with self.assertLogs("revival_ticket_adapter", level="INFO") as logs:
            self.rfd.join(TICKET_A1)
            self.rfd.join(TICKET_BAD)
        text = "\n".join(logs.output)
        self.assertNotIn(TICKET_A1, text)
        self.assertNotIn(TICKET_BAD, text)
        self.assertNotIn(CRED, text)


if __name__ == "__main__":
    logging.basicConfig(level=logging.CRITICAL)
    unittest.main()
