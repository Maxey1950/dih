# launcher/ — `ourrevival://` handler (Rust)

Handles `ourrevival://join?ticket=rvjt_…`:

1. strictly parses the link (anything else is rejected before any network call)
2. resolves the one-time ticket with `POST /api/launcher/ticket/resolve` (the ticket is the only proof; no cookies or passwords)
3. starts the configured RFD v347 player with an argv array (no shell): `RFD player --skip_download -h <host> -p <port> -u <ticket>`
4. exits

Design and the full join sequence: [`docs/phase-4-join-launcher.md`](../docs/phase-4-join-launcher.md).
Config rules, TLS, protocol-registration safety, dependency audit, packaging and code signing:
[`docs/launcher-security.md`](../docs/launcher-security.md).

```bash
cargo test
cargo build --release                                  # Linux
cargo build --release --target x86_64-pc-windows-gnu   # Windows .exe (needs gcc-mingw-w64-x86-64)
cargo audit                                            # dependency advisories (cargo install cargo-audit)
npm run launcher:package                               # (from the repo root) -> launcher/dist/windows-x64/
```

Setup:

- Write the config (no secrets) to the path printed by `ourrevival-launcher --config-path`. See `launcher.example.json`.
- `apiBaseUrl` must be an `https://` origin. Local development over plain HTTP needs `"developmentAllowHttpLocalhost": true` and a `localhost`/`127.0.0.1`/`[::1]` origin.
- `rfdExecutable` must be an absolute path to an existing RFD 2018/v347 executable file (an `.exe` on Windows), never a command line. The launcher never downloads RFD and passes `--skip_download` so RFD doesn't either. Never point it at anything from AlphaBlox's `2015/` directory.
- Register the protocol: `ourrevival-launcher --register` (per-user). Undo with `--unregister`.
