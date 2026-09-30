# rfd/heartbeat_agent — game-server heartbeat

Standard-library Python (3.11+). Run one per RFD server, as the same
unprivileged account, next to RFD:

```bash
python3 revival_heartbeat_agent.py --config /etc/revival/heartbeat.toml          # run (every 30 s)
python3 revival_heartbeat_agent.py --config /etc/revival/heartbeat.toml --drain  # stop new players
python3 revival_heartbeat_agent.py --config /etc/revival/heartbeat.toml --offline
python3 -m unittest discover -s tests
```

- Config: copy `heartbeat.example.toml` (placeholders only). The credential is
  read from `credential_file` (absolute, chmod 600) or
  `REVIVAL_GAME_SERVER_CREDENTIAL`; it may not appear in the TOML.
- Liveness: TCP connect to the local RFD web port; two failures → `offline`.
- Player count: an over-estimate from the adapter's join ledger (RFD v347 has no
  presence API). Set the adapter's `REVIVAL_JOIN_LEDGER_PATH` to the same file
  as `join_ledger_path`.
- Never spawns processes, runs commands or Lua, or accepts inbound connections.

Details: `docs/phase-4.5-rfd-hardening.md` §6–7.
