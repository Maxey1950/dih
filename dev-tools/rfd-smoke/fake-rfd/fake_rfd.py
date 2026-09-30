#!/usr/bin/env python3
"""
TEST DOUBLE for the smoke harness. NOT RFD, and a PASS with it is NOT a live
RFD verification. It exists only so `npm run rfd:smoke` can be exercised
end to end on machines without an RFD v347 build.

It mimics the two RFD behaviours the harness depends on:
  server --skip_download --config <GameConfig.toml> --web_port <p>
      loads revival_ticket_adapter.py from the config directory and serves
      /join?code=...                 (RFD join data: add_player_to_players_database)
      /rfd/is-player-allowed?userId= (RCC PlayerAdded verification)
  player --skip_download -h <host> -p <port> -u <user code>
      requests join data, then the connection verification.
Both modes refuse to run without --skip_download, so the harness and the
launcher are checked for never letting RFD download anything.
"""
import argparse
import http.server
import json
import os
import sqlite3
import sys
import threading
import tomllib
import urllib.parse
import urllib.request


def server(args):
    config_dir = os.path.dirname(os.path.abspath(args.config))
    with open(args.config, "rb") as fh:
        tomllib.load(fh)
    sys.path.insert(0, config_dir)
    import revival_ticket_adapter as rta  # noqa: E402

    rta.configure(config_dir=config_dir)
    db_path = os.path.join(config_dir, "_.sqlite")
    with sqlite3.connect(db_path) as db:
        db.execute("CREATE TABLE IF NOT EXISTS players (id_number INTEGER, user_code TEXT, username TEXT, "
                   "UNIQUE(id_number) ON CONFLICT IGNORE, UNIQUE(username) ON CONFLICT IGNORE)")
    lock = threading.Lock()

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def reply(self, code, obj):
            data = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # noqa: N802
            url = urllib.parse.urlsplit(self.path)
            q = dict(urllib.parse.parse_qsl(url.query))
            with lock, sqlite3.connect(db_path) as db:
                if url.path == "/join":
                    code = q.get("code", "")
                    row = db.execute("SELECT id_number, username FROM players WHERE user_code=?", (code,)).fetchone()
                    if row:
                        return self.reply(200, {"id": row[0]})
                    if not rta.check_user_allowed(code):
                        return self.reply(403, {"allowed": False})
                    uid = rta.retrieve_user_id(code)
                    name = rta.retrieve_username(uid, code)
                    db.execute("INSERT INTO players VALUES (?,?,?)", (uid, code, name))
                    return self.reply(200, {"id": uid})
                if url.path == "/rfd/is-player-allowed":
                    row = db.execute("SELECT user_code FROM players WHERE id_number=?", (int(q.get("userId", "0")),)).fetchone()
                    return self.reply(200, {"allowed": bool(row) and rta.check_user_allowed(row[0])})
            self.reply(404, {})

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", args.web_port), Handler)
    print(f"fake RFD server listening on 127.0.0.1:{args.web_port}", flush=True)
    httpd.serve_forever()


def player(args):
    base = f"http://{args.h}:{args.p}"
    try:
        with urllib.request.urlopen(f"{base}/join?code={urllib.parse.quote(args.u)}", timeout=10) as r:
            uid = json.load(r)["id"]
        with urllib.request.urlopen(f"{base}/rfd/is-player-allowed?userId={uid}", timeout=10) as r:
            allowed = json.load(r)["allowed"]
    except Exception as err:  # noqa: BLE001
        print(f"fake player: join failed ({type(err).__name__})", file=sys.stderr)
        return 2
    print(f"fake player: connection {'ADMITTED' if allowed else 'KICKED'}", file=sys.stderr)
    return 0 if allowed else 2


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    s = sub.add_parser("server")
    s.add_argument("--skip_download", action="store_true")
    s.add_argument("--config", required=True)
    s.add_argument("--web_port", type=int, required=True)
    p = sub.add_parser("player", add_help=False)
    p.add_argument("--skip_download", action="store_true")
    p.add_argument("-h", required=True)
    p.add_argument("-p", type=int, required=True)
    p.add_argument("-u", required=True)
    args = parser.parse_args()
    if not args.skip_download:
        print("fake RFD: refusing to run without --skip_download (real RFD would download binaries)", file=sys.stderr)
        return 3
    return server(args) if args.mode == "server" else player(args)


if __name__ == "__main__":
    sys.exit(main())
