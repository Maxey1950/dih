"""Tests for the heartbeat agent. Run: python3 -m unittest discover -s tests"""

import http.server
import json
import logging
import os
import socket
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import revival_heartbeat_agent as hb  # noqa: E402

CRED = "rvgs_" + "C" * 43
SERVER_ID = "11111111-2222-4333-8444-555555555555"


class FakeApi(http.server.BaseHTTPRequestHandler):
    calls: list = []
    status_code = 200
    redirect = False

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length) or b"{}")
        FakeApi.calls.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": body})
        if FakeApi.redirect:
            self.send_response(307)
            self.send_header("Location", "http://127.0.0.1:9/steal")
            self.end_headers()
            return
        action = self.path.rsplit("/", 1)[-1]
        status = {"heartbeat": "online", "drain": "draining", "offline": "offline"}[action]
        payload = json.dumps({"server": {"id": SERVER_ID, "status": status, "playerCount": 0, "maxPlayers": 12}}).encode()
        self.send_response(FakeApi.status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


class Base(unittest.TestCase):
    def setUp(self):
        FakeApi.calls, FakeApi.status_code, FakeApi.redirect = [], 200, False
        self.server = http.server.HTTPServer(("127.0.0.1", 0), FakeApi)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.tmp = tempfile.TemporaryDirectory()
        self.cred_path = os.path.join(self.tmp.name, "gs.credential")
        with open(self.cred_path, "w") as fh:
            fh.write(CRED + "\n")
        os.chmod(self.cred_path, 0o600)
        self.ledger = os.path.join(self.tmp.name, "ledger.json")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def write_config(self, **overrides):
        values = {
            "api_url": f'"http://127.0.0.1:{self.server.server_port}"',
            "server_id": f'"{SERVER_ID}"',
            "credential_file": f'"{self.cred_path}"',
            "join_ledger_path": f'"{self.ledger}"',
            "max_players": "12",
            "rfd_port": "2005",
        }
        values.update(overrides)
        path = os.path.join(self.tmp.name, "hb.toml")
        with open(path, "w") as fh:
            for k, v in values.items():
                if v is not None:
                    fh.write(f"{k} = {v}\n")
        return path

    def agent(self, probe_results=None, now=1_000_000.0):
        config = hb.load_config(self.write_config(), environ={})
        results = iter(probe_results or [True] * 100)
        client = hb.ApiClient(config["api_url"], config["server_id"], config["credential"])
        return hb.Agent(config, client, probe=lambda h, p: next(results), clock=lambda: now)

    def write_ledger(self, joins):
        with open(self.ledger, "w") as fh:
            json.dump({"version": 1, "joins": joins}, fh)


class ConfigTests(Base):
    def test_valid_config(self):
        conf = hb.load_config(self.write_config(), environ={})
        self.assertEqual(conf["server_id"], SERVER_ID)
        self.assertEqual(conf["interval_seconds"], 30)
        self.assertEqual(conf["rfd_host"], "127.0.0.1")

    def test_credential_in_toml_is_refused(self):
        with self.assertRaisesRegex(hb.AgentError, "unknown config keys"):
            hb.load_config(self.write_config(credential=f'"{CRED}"'), environ={})

    def test_credential_from_environment(self):
        conf = hb.load_config(self.write_config(credential_file=None), environ={"REVIVAL_GAME_SERVER_CREDENTIAL": CRED})
        self.assertEqual(conf["credential"], CRED)

    def test_missing_or_malformed_credential(self):
        with self.assertRaises(hb.AgentError):
            hb.load_config(self.write_config(credential_file=None), environ={})
        with self.assertRaises(hb.AgentError):
            hb.load_config(self.write_config(credential_file=None), environ={"REVIVAL_GAME_SERVER_CREDENTIAL": "hunter2"})

    @unittest.skipUnless(os.name == "posix", "POSIX permission bits")
    def test_world_readable_credential_file_refused(self):
        os.chmod(self.cred_path, 0o644)
        with self.assertRaisesRegex(hb.AgentError, "chmod 600"):
            hb.load_config(self.write_config(), environ={})

    def test_relative_paths_refused(self):
        with self.assertRaises(hb.AgentError):
            hb.load_config(self.write_config(credential_file='"gs.credential"'), environ={})
        with self.assertRaises(hb.AgentError):
            hb.load_config(self.write_config(join_ledger_path='"ledger.json"'), environ={})

    def test_bad_values_refused(self):
        for key, value in (
            ("server_id", '"../../admin"'),
            ("max_players", "0"),
            ("max_players", "true"),
            ("rfd_port", "70000"),
            ("rfd_host", '"8.8.8.8"'),
            ("rfd_host", '"example.org"'),
            ("interval_seconds", "1"),
            ("api_url", '"http://api.example.org"'),
            ("api_url", '"https://api.example.org/path"'),
            ("api_url", '"https://u:p@api.example.org"'),
        ):
            with self.assertRaises(hb.AgentError, msg=f"{key}={value}"):
                hb.load_config(self.write_config(**{key: value}), environ={})


class PlayerCountTests(Base):
    def test_no_ledger_is_zero(self):
        self.assertEqual(hb.estimate_player_count(self.ledger, 1200, 12, now=1000.0), 0)
        self.assertEqual(hb.estimate_player_count(None, 1200, 12, now=1000.0), 0)

    def test_distinct_recent_uids_capped(self):
        now = 10_000.0
        self.write_ledger([
            {"t": now - 10, "uid": 7},
            {"t": now - 20, "uid": 7},  # same user twice counts once
            {"t": now - 30, "uid": 8},
            {"t": now - 5000, "uid": 9},  # outside the window
            {"t": now - 1, "uid": True},  # junk ignored
            "junk",
        ])
        self.assertEqual(hb.estimate_player_count(self.ledger, 1200, 12, now=now), 2)
        self.assertEqual(hb.estimate_player_count(self.ledger, 1200, 1, now=now), 1)

    def test_corrupt_ledger_reports_full(self):
        with open(self.ledger, "w") as fh:
            fh.write("{not json")
        self.assertEqual(hb.estimate_player_count(self.ledger, 1200, 12), 12)


class LoopTests(Base):
    def test_heartbeat_sends_count_and_credential(self):
        self.write_ledger([{"t": 1_000_000.0 - 5, "uid": 7}])
        agent = self.agent()
        self.assertEqual(agent.tick(), "heartbeat")
        call = FakeApi.calls[0]
        self.assertEqual(call["path"], f"/api/internal/servers/{SERVER_ID}/heartbeat")
        self.assertEqual(call["auth"], "Bearer " + CRED)
        self.assertEqual(call["body"], {"playerCount": 1, "maxPlayers": 12, "status": "online"})

    def test_offline_after_two_failed_probes_then_recovers(self):
        agent = self.agent([False, False, False, True])
        self.assertEqual(agent.tick(), "probe-failed")
        self.assertEqual(agent.tick(), "offline")
        self.assertEqual(agent.tick(), "probe-failed")  # offline reported once, not every tick
        self.assertEqual(agent.tick(), "heartbeat")
        self.assertEqual([c["path"].rsplit("/", 1)[-1] for c in FakeApi.calls], ["offline", "heartbeat"])

    def test_api_errors_do_not_crash(self):
        FakeApi.status_code = 500
        agent = self.agent()
        self.assertEqual(agent.tick(), "error")
        self.server.shutdown()
        self.server.server_close()
        self.server = http.server.HTTPServer(("127.0.0.1", 0), FakeApi)  # replaced; old port now closed
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.assertEqual(agent.tick(), "error")  # connection refused on the old port

    def test_redirects_are_not_followed(self):
        FakeApi.redirect = True
        agent = self.agent()
        self.assertEqual(agent.tick(), "error")
        self.assertEqual(len(FakeApi.calls), 1)

    def test_run_stops_and_reports_offline(self):
        agent = self.agent()
        agent.config["interval_seconds"] = 60
        t = threading.Thread(target=agent.run)
        t.start()
        agent.stop.set()
        t.join(timeout=5)
        self.assertFalse(t.is_alive())
        self.assertEqual(FakeApi.calls[-1]["path"].rsplit("/", 1)[-1], "offline")

    def test_only_fixed_actions(self):
        client = hb.ApiClient("http://127.0.0.1:9", SERVER_ID, CRED)
        with self.assertRaises(hb.AgentError):
            client.post("execute")

    def test_drain_cli(self):
        path = self.write_config()
        self.assertEqual(hb.main(["--config", path, "--drain"]), 0)
        self.assertEqual(FakeApi.calls[0]["path"], f"/api/internal/servers/{SERVER_ID}/drain")

    def test_secrets_not_logged(self):
        FakeApi.status_code = 401
        agent = self.agent()
        with self.assertLogs("revival_heartbeat_agent", level="INFO") as logs:
            agent.tick()
            agent.shutdown()
        self.assertNotIn(CRED, "\n".join(logs.output))


class ProbeTests(unittest.TestCase):
    def test_probe_open_and_closed_port(self):
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            s.listen()
            port = s.getsockname()[1]
            self.assertTrue(hb.probe_rfd("127.0.0.1", port, timeout=1))
        self.assertFalse(hb.probe_rfd("127.0.0.1", port, timeout=1))


class NoDangerousPrimitives(unittest.TestCase):
    def test_source_has_no_process_or_eval(self):
        with open(hb.__file__, encoding="utf-8") as fh:
            src = fh.read()
        for needle in ("subprocess", "os.system", "os.popen", "exec(", "eval(", "import ctypes", "pickle", "getattr("):
            self.assertNotIn(needle, src, needle)


if __name__ == "__main__":
    logging.disable(logging.NOTSET)
    unittest.main()
