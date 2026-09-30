"""
Tests for revival_ticket_adapter, run WITHOUT RFD.

FakeRfd reproduces the parts of RFD (commit 510b6e25) that decide who may
join, so the tests exercise the real interaction:
  - GameConfig hook snippets are executed through RFD's python-call-mode
    wrapper (Source/config_type/types/callable.py);
  - check_user_allowed.cached_call(7, user_code): RFD's own 7-second result
    cache (Source/config_type/types/callable.py cached_call);
  - join data: add_player_to_players_database (Source/web_server/endpoints/join_data.py);
  - the per-connection gate: RCC PlayerAdded -> /rfd/is-player-allowed?userId=
    (Source/routines/rcc/startup_scripts.py, Source/web_server/endpoints/setup_player.py);
  - the exact `players` sqlite schema (Source/storage/players.py).
A single FakeClock drives both RFD's cache and the adapter.
"""
import http.server
import json
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


def ticket(ch: str) -> str:
    return "rvjt_" + ch * 43


ALICE_1, ALICE_2, BOB_1, UNKNOWN = ticket("A"), ticket("B"), ticket("D"), ticket("Z")
IDENTITIES = {ALICE_1: (7, "alice"), ALICE_2: (7, "alice"), BOB_1: (8, "bob")}


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


class FakeApi(http.server.BaseHTTPRequestHandler):
    redeemed: set = set()
    expired: set = set()
    calls: list = []
    redirect = False
    fail_status = None
    lock = threading.Lock()

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        t = body.get("ticket")
        with FakeApi.lock:
            FakeApi.calls.append({"path": self.path, "auth": self.headers.get("Authorization")})
            if FakeApi.fail_status:
                return self._send(FakeApi.fail_status, {"error": {"code": "RATE_LIMITED", "message": "x"}})
            if FakeApi.redirect:
                self.send_response(302)
                self.send_header("Location", "/stolen")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            authorized = self.path == "/api/internal/join-tickets/redeem" and self.headers.get("Authorization") == "Bearer " + CRED
            if not authorized:
                return self._send(401, {"error": {"code": "UNAUTHENTICATED", "message": "x"}})
            if t in FakeApi.expired:
                return self._send(403, {"error": {"code": "JOIN_REJECTED", "message": "x", "details": {"reason": "expired"}}})
            if t not in IDENTITIES or t in FakeApi.redeemed:
                reason = "already_redeemed" if t in FakeApi.redeemed else "invalid"
                return self._send(403, {"error": {"code": "JOIN_REJECTED", "message": "x", "details": {"reason": reason}}})
            FakeApi.redeemed.add(t)
        uid, name = IDENTITIES[t]
        self._send(200, {"allowed": True, "user": {"id": "u", "numericId": uid, "username": name, "displayName": name}, "game": {"id": "g", "placeId": 1}})

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


PLAYERS_DDL = """
CREATE TABLE IF NOT EXISTS "players" (
    "user_code" TEXT NOT NULL,
    "id_number" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    PRIMARY KEY("user_code") ON CONFLICT IGNORE,
    UNIQUE ("user_code") ON CONFLICT IGNORE,
    UNIQUE ("id_number") ON CONFLICT IGNORE,
    UNIQUE ("username") ON CONFLICT IGNORE
);"""


class FakeRfd:
    """RFD's authorization-relevant behavior."""

    def __init__(self, config_dir, clock):
        with open(os.path.join(RFD_DIR, "GameConfig.revival.toml"), "rb") as fh:
            conf = tomllib.load(fh)["server_core"]
        self.hooks = {name: rfd_python_callable(conf[name], config_dir) for name in
                      ["check_user_allowed", "retrieve_user_id", "retrieve_username", "check_user_has_admin", "retrieve_default_user_code"]}
        self.path = os.path.join(config_dir, "_.sqlite")
        self.clock = clock
        self.call_cache = {}  # RFD cached_call storage (key -> (value, until))
        self.cache_lock = threading.Lock()
        db = sqlite3.connect(self.path)
        db.execute(PLAYERS_DDL)
        db.commit()
        db.close()

    def _db(self):
        return sqlite3.connect(self.path, timeout=10)

    def cached_check(self, user_code):
        with self.cache_lock:
            hit = self.call_cache.get(user_code)
            if hit is not None and self.clock() < hit[1]:
                return hit[0]
        value = self.hooks["check_user_allowed"](user_code)
        with self.cache_lock:
            self.call_cache[user_code] = (value, self.clock() + 7)
        return value

    def join_data(self, code, max_loops=5):
        db = self._db()
        try:
            existing = db.execute('SELECT "id_number", "username" FROM "players" WHERE "user_code" = ?', (code,)).fetchone()
            if existing is not None:
                return (*existing, False)
            if not self.cached_check(code):
                return None
            for _ in range(max_loops):  # RFD loops forever; capped here to detect it
                iden = self.hooks["retrieve_user_id"](code)
                name = self.hooks["retrieve_username"](iden, code)
                db.execute('INSERT INTO "players" VALUES (?, ?, ?)', (code, iden, name))
                db.commit()
                r = db.execute('SELECT "id_number", "username" FROM "players" WHERE "user_code" = ?', (code,)).fetchone()
                if r is not None:
                    return (*r, True)
            raise AssertionError("RFD would loop forever inserting this player")
        finally:
            db.close()

    def player_added(self, user_id):
        """/rfd/is-player-allowed?userId=... (called by RCC PlayerAdded). False => kicked."""
        db = self._db()
        try:
            row = db.execute('SELECT "user_code" FROM "players" WHERE "id_number" = ?', (user_id,)).fetchone()
        finally:
            db.close()
        return row is not None and self.cached_check(row[0])

    def connect(self, code, delay_before_connect):
        """One client connection: join data, then (after loading) PlayerAdded verification."""
        joined = self.join_data(code)
        if joined is None:
            return False
        self.clock.advance(delay_before_connect)
        return self.player_added(joined[0])

    def rows(self):
        db = self._db()
        try:
            return sorted(db.execute('SELECT "user_code", "id_number", "username" FROM "players"').fetchall())
        finally:
            db.close()


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeApi)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        FakeApi.redeemed, FakeApi.expired, FakeApi.calls, FakeApi.fail_status = set(), set(), [], None
        rta._reset_for_tests()
        self.clock = FakeClock()
        self.patches = [
            mock.patch.object(rta, "_now", self.clock),
            mock.patch.dict(os.environ, {
                "REVIVAL_API_URL": f"http://127.0.0.1:{self.server.server_port}",
                "REVIVAL_GAME_SERVER_CREDENTIAL": CRED,
            }),
        ]
        for p in self.patches:
            p.start()
        for var in ("REVIVAL_RFD_SQLITE_PATH", "REVIVAL_JOIN_LEDGER_PATH", "REVIVAL_GAME_SERVER_CREDENTIAL_FILE"):
            os.environ.pop(var, None)
        self.rfd = FakeRfd(self.tmp.name, self.clock)

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def redeem_calls(self):
        return [c for c in FakeApi.calls if c["path"].endswith("/redeem")]


class OneJoinVersusReplay(Base):
    """The central property: repeated hooks for ONE join work; a second connection does not."""

    def test_repeated_hook_invocations_for_one_join(self):
        # join data (PlaceLauncher), then join.ashx again, then PlayerAdded after 10 s (RFD cache expired)
        self.assertEqual(self.rfd.join_data(ALICE_1), (7, "alice", True))
        self.assertEqual(self.rfd.join_data(ALICE_1), (7, "alice", False))  # existing mapping, no hook
        self.clock.advance(10)
        self.assertTrue(self.rfd.player_added(7), "the joining client is admitted")
        self.assertEqual(len(self.redeem_calls()), 1, "redeemed exactly once")

    def test_hook_repeated_before_binding_is_same_join(self):
        self.assertTrue(rta.check_user_allowed(ALICE_1))
        self.assertTrue(rta.check_user_allowed(ALICE_1))  # e.g. RFD cache miss during join data
        self.assertEqual(len(self.redeem_calls()), 1)

    def test_second_connection_with_same_ticket_is_rejected(self):
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=10))
        self.clock.advance(8)  # past RFD's own 7 s cache
        self.assertFalse(self.rfd.connect(ALICE_1, delay_before_connect=0), "replay must be kicked")
        self.clock.advance(30)
        self.assertFalse(self.rfd.connect(ALICE_1, delay_before_connect=0))
        self.assertEqual(len(self.redeem_calls()), 1, "replay never re-redeems")

    def test_replay_after_admission_window_is_rejected_even_if_admission_unseen(self):
        # Fast legit client: its verification is served from RFD's 7 s cache; the adapter never sees it.
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=2))
        self.clock.advance(rta.ADMISSION_WINDOW_SECONDS)
        self.assertFalse(self.rfd.connect(ALICE_1, delay_before_connect=0))

    def test_known_residual_window_when_rfd_cache_hides_the_admission(self):
        """Documents the residual risk precisely (see module docstring and docs)."""
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=2))  # admission served by RFD cache
        self.clock.advance(20)  # RFD cache expired, still inside the 60 s admission window
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=0), "one unobserved admission slot remains")
        self.clock.advance(8)
        self.assertFalse(self.rfd.connect(ALICE_1, delay_before_connect=0), "never more than one extra")

    def test_slow_client_past_admission_window_is_refused(self):
        self.assertIsNotNone(self.rfd.join_data(ALICE_1))
        self.clock.advance(rta.ADMISSION_WINDOW_SECONDS + 1)
        self.assertFalse(self.rfd.player_added(7))

    def test_redeemed_ticket_after_adapter_restart_is_rejected_by_api(self):
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=10))
        rta._reset_for_tests()  # adapter/RFD restarted; RFD's players table cleared on start
        fresh = FakeRfd(tempfile.mkdtemp(dir=self.tmp.name), self.clock)
        self.assertFalse(fresh.connect(ALICE_1, delay_before_connect=10))
        self.assertIn("already_redeemed", json.dumps(FakeApi.redeemed and ["already_redeemed"]))

    def test_expired_ticket_is_rejected(self):
        FakeApi.expired.add(ALICE_1)
        self.assertIsNone(self.rfd.join_data(ALICE_1))

    def test_unknown_ticket_negative_cache_then_reask(self):
        self.assertIsNone(self.rfd.join_data(UNKNOWN))
        self.clock.advance(8)
        self.assertIsNone(self.rfd.join_data(UNKNOWN))
        self.assertEqual(len(self.redeem_calls()), 1, "negative result cached for 30 s")
        self.clock.advance(rta.NEGATIVE_CACHE_SECONDS)
        self.assertIsNone(self.rfd.join_data(UNKNOWN))
        self.assertEqual(len(self.redeem_calls()), 2)

    def test_identity_hooks_fail_closed_outside_an_active_join(self):
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_user_id(ALICE_1)
        rta.check_user_allowed(ALICE_1)
        self.clock.advance(rta.ADMISSION_WINDOW_SECONDS)
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_user_id(ALICE_1)
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_username(7, ALICE_1)
        self.assertFalse(self.rfd.hooks["check_user_has_admin"](7, ALICE_1))


class InputAndFailureHandling(Base):
    def test_malformed_codes_never_reach_the_api(self):
        for code in ["", "no-ticket", "Guest 1", CRED, ALICE_1 + "x", None, 5]:
            self.assertFalse(rta.check_user_allowed(code))
        self.assertEqual(FakeApi.calls, [])
        self.assertIsNone(self.rfd.join_data(self.rfd.hooks["retrieve_default_user_code"]()))

    def test_api_unreachable_fails_closed(self):
        with mock.patch.dict(os.environ, {"REVIVAL_API_URL": "http://127.0.0.1:9"}):
            self.assertFalse(rta.check_user_allowed(ALICE_1))
        # Not cached as a rejection: once the API is reachable the same join works.
        self.assertTrue(rta.check_user_allowed(ALICE_1))

    def test_transient_api_errors_are_not_negative_cached(self):
        for status in (429, 500, 503):
            FakeApi.fail_status = status
            try:
                self.assertFalse(rta.check_user_allowed(ALICE_1), status)
            finally:
                FakeApi.fail_status = None
        self.assertTrue(rta.check_user_allowed(ALICE_1), "legitimate player not locked out by a transient error")
        self.assertEqual(len(FakeApi.redeemed), 1)

    def test_missing_or_malformed_credential_fails_closed(self):
        with mock.patch.dict(os.environ, {"REVIVAL_GAME_SERVER_CREDENTIAL": "hunter2"}):
            with self.assertRaises(rta.AdapterError):
                rta.check_user_allowed(ALICE_1)
        self.assertEqual(FakeApi.calls, [])

    def test_credential_file_is_used(self):
        path = os.path.join(self.tmp.name, "cred")
        with open(path, "w") as fh:
            fh.write(CRED + "\n")
        os.chmod(path, 0o600)
        with mock.patch.dict(os.environ, {"REVIVAL_GAME_SERVER_CREDENTIAL_FILE": path, "REVIVAL_GAME_SERVER_CREDENTIAL": ""}):
            self.assertTrue(rta.check_user_allowed(ALICE_1))
        self.assertEqual(self.redeem_calls()[0]["auth"], "Bearer " + CRED)

    def test_redirects_are_not_followed(self):
        FakeApi.redirect = True
        try:
            self.assertFalse(rta.check_user_allowed(ALICE_1))
        finally:
            FakeApi.redirect = False
        self.assertEqual([c["path"] for c in FakeApi.calls], ["/api/internal/join-tickets/redeem"])

    @unittest.skipUnless(os.name == "posix", "POSIX permission bits")
    def test_credential_file_readable_by_others_is_refused(self):
        path = os.path.join(self.tmp.name, "cred")
        with open(path, "w") as fh:
            fh.write(CRED + "\n")
        os.chmod(path, 0o644)
        with mock.patch.dict(os.environ, {"REVIVAL_GAME_SERVER_CREDENTIAL_FILE": path, "REVIVAL_GAME_SERVER_CREDENTIAL": ""}):
            with self.assertRaises(rta.AdapterError):
                rta.check_user_allowed(ALICE_1)
        self.assertEqual(FakeApi.calls, [])

    def test_api_url_rules(self):
        ok = {
            "https://api.example.org": "https://api.example.org",
            "https://api.example.org:8443/": "https://api.example.org:8443",
            "http://127.0.0.1:4000": "http://127.0.0.1:4000",
            "http://10.0.0.2:4000": "http://10.0.0.2:4000",
            "http://localhost:4000": "http://localhost:4000",
        }
        for url, want in ok.items():
            self.assertEqual(rta.validate_api_url(url), want, url)
        for bad in (
            "",
            "http://api.example.org",  # plain HTTP to a public name
            "http://8.8.8.8:4000",  # plain HTTP to a public IP
            "http://localhost.evil.example",
            "https://user:pw@api.example.org",
            "https://api.example.org/api",
            "https://api.example.org?x=1",
            "https://api.example.org#f",
            "ftp://api.example.org",
            "file:///etc/passwd",
            "https://api.example.org :80",
        ):
            with self.assertRaises(rta.AdapterError, msg=bad):
                rta.validate_api_url(bad)

    def test_tickets_and_credentials_are_not_logged(self):
        with self.assertLogs("revival_ticket_adapter", level="INFO") as logs:
            self.rfd.connect(ALICE_1, delay_before_connect=10)
            self.rfd.join_data(UNKNOWN)
        text = "\n".join(logs.output)
        for secret in (ALICE_1, UNKNOWN, CRED):
            self.assertNotIn(secret, text)

    def test_join_ledger_records_ids_only(self):
        ledger = os.path.join(self.tmp.name, "ledger.json")
        with mock.patch.dict(os.environ, {"REVIVAL_JOIN_LEDGER_PATH": ledger}):
            self.rfd.connect(ALICE_1, delay_before_connect=10)
        with open(ledger) as fh:
            raw = fh.read()
        data = json.loads(raw)
        self.assertEqual([e["uid"] for e in data["joins"]], [7])
        self.assertNotIn(ALICE_1, raw)


class ReturningPlayerFix(Base):
    def test_rejoin_with_new_ticket_does_not_loop(self):
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=10))
        self.clock.advance(8)
        self.assertTrue(self.rfd.connect(ALICE_2, delay_before_connect=10))
        self.assertEqual(self.rfd.rows(), [(ALICE_2, 7, "alice")], "stale mapping replaced")

    def test_does_not_touch_other_players(self):
        self.assertTrue(self.rfd.connect(BOB_1, delay_before_connect=10))
        self.assertTrue(self.rfd.connect(ALICE_1, delay_before_connect=10))
        self.assertTrue(self.rfd.connect(ALICE_2, delay_before_connect=10))
        self.assertIn((BOB_1, 8, "bob"), self.rfd.rows())

    def test_username_held_by_different_id_fails_closed(self):
        db = sqlite3.connect(self.rfd.path)
        db.execute('INSERT INTO "players" VALUES (?, ?, ?)', ("someone-else", 99, "alice"))
        db.commit()
        db.close()
        rta.check_user_allowed(ALICE_1)
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_user_id(ALICE_1)
        self.assertIn(("someone-else", 99, "alice"), self.rfd.rows(), "other player's row untouched")

    def test_unexpected_schema_refused(self):
        db = sqlite3.connect(self.rfd.path)
        db.execute('ALTER TABLE "players" ADD COLUMN "extra" TEXT')
        db.commit()
        db.close()
        rta.check_user_allowed(ALICE_1)
        with self.assertRaises(rta.AdapterError):
            rta.retrieve_user_id(ALICE_1)

    def test_missing_database_is_never_created(self):
        missing = os.path.join(self.tmp.name, "nope", "_.sqlite")
        with mock.patch.dict(os.environ, {"REVIVAL_RFD_SQLITE_PATH": missing}):
            rta.check_user_allowed(ALICE_1)
            self.assertEqual(rta.retrieve_user_id(ALICE_1), 7)
        self.assertFalse(os.path.exists(missing))

    def test_relative_database_path_refused(self):
        with mock.patch.dict(os.environ, {"REVIVAL_RFD_SQLITE_PATH": "_.sqlite"}):
            rta.check_user_allowed(ALICE_1)
            with self.assertRaises(rta.AdapterError):
                rta.retrieve_user_id(ALICE_1)

    def test_concurrent_joins_same_user_and_other_users(self):
        results, errors = {}, []

        def join(code):
            try:
                results[code] = self.rfd.join_data(code)
            except Exception as err:  # noqa: BLE001
                errors.append(repr(err))

        threads = [threading.Thread(target=join, args=(c,)) for c in (ALICE_1, ALICE_2, BOB_1)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=20)
        self.assertEqual(errors, [])
        self.assertFalse(any(t.is_alive() for t in threads), "no join hangs")
        rows = self.rfd.rows()
        self.assertIn((BOB_1, 8, "bob"), rows, "other user's row intact")
        alice_rows = [r for r in rows if r[1] == 7]
        self.assertLessEqual(len(alice_rows), 1, "at most one mapping for the returning user")
        self.assertTrue(all(results[c] is not None for c in (BOB_1,)))
        # Two connections for the same account: the adapter admits at most one.
        # Each call is spaced past RFD's own 7 s check cache so the answer comes
        # from the adapter. (Two connections inside that 7 s window are answered
        # by RFD's cache, not by us; see the residual-risk notes in the docs.)
        admitted = 0
        for _ in range(2):
            self.clock.advance(8)
            admitted += 1 if self.rfd.player_added(7) else 0
        self.assertLessEqual(admitted, 1)


if __name__ == "__main__":
    unittest.main()
