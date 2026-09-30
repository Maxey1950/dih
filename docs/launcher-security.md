# Launcher security (`launcher/`)

This document covers the `ourrevival://` handler: how it is configured, what it trusts, its dependencies, packaging
and signing. The join protocol itself is in [`phase-4-join-launcher.md`](phase-4-join-launcher.md), and the RFD side
is in [`phase-4.5-rfd-hardening.md`](phase-4.5-rfd-hardening.md).

## What the launcher trusts

| Input | Source | Trusted for |
|---|---|---|
| Launch URL (`argv[1]`) | Browser / OS | **Only** the one-time ticket. It must match `ourrevival://join?ticket=rvjt_<43 base64url>` exactly, at most 128 bytes. Any other host, path, parameter, encoding or extra argv entry is rejected before any network call. |
| Config file | Installer / user, local disk | API origin, RFD executable path, allowed server hosts, timeout. |
| Resolve response | The configured API over HTTPS | Game server host/port (validated; optional allow-list) and display info. Unknown fields fail closed. |

The URL **cannot** override:

- the API host or scheme;
- the RFD path;
- the server host or port;
- anything else.

Tests (`url_cannot_override_origin_executable_or_server`) reject `&api=…`, `&rfd=…`, `&port=…`, other hosts and
other schemes, all without any network call.

## Config hardening (`launcher/src/config.rs`)

Location:

- Windows: `%APPDATA%\OurRevival\launcher.json`
- Elsewhere: `$XDG_CONFIG_HOME/ourrevival/launcher.json` or `~/.config/ourrevival/launcher.json`
- Override: `OURREVIVAL_LAUNCHER_CONFIG`
- `--config-path` prints the path in use.

The config is JSON. That was chosen over TOML because `serde_json` is already required for the API response;
TOML would add a parser crate for no security gain. Unknown keys are rejected (`deny_unknown_fields`), so there is
no way to add an `ignoreTlsErrors` or `password` field. The file is capped at 64 KiB.

**`apiBaseUrl`**

- Must be an origin only: `scheme://host[:port]` with an optional trailing `/`.
- No path, query, fragment, userinfo, `%`, backslash or whitespace.
- The host must be a valid DNS name or IP; the port must be 1–65535.
- HTTPS is required.
- Plain HTTP needs **both** `"developmentAllowHttpLocalhost": true` **and** an exact `localhost`, `127.0.0.1` or
  `[::1]` host. These are rejected: `localhost.evil.example`, `127.0.0.1.nip.io`, `127.0.0.2`, `0.0.0.0`, private
  IPs.

**`rfdExecutable`** is a file path, never a command line.

- Absolute; no `.` or `..` components; no leading/trailing whitespace; at most 1024 characters.
- Refused characters: `"`, `%`, `^`, `&`, `|`, `<`, `>`, `` ` ``, `$`, `;`, `*`, `?`, and control characters.
- The file name may not start with `-` or contain ` -`. So `C:\RFD\RFD.exe --argument` is rejected, as is any
  quoted-exe-plus-arguments string.
- Windows:
  - drive-absolute (`C:\…`) only; no UNC (`\\server\share`) or device (`\\?\`) paths, and no forward slashes;
  - must end in `.exe`. This means no `.bat` or `.cmd`, which Windows would route through `cmd.exe`.
- It must exist and be a regular file (not a directory).
- The launcher never downloads RFD.

**`rfdArgsPrefix`** (default `["player"]`) is at most 4 plain words, with no leading `-` or `/`. It cannot inject
flags or override `-h`, `-p` or `-u`.

**`rfdAllowAutoDownload`** (default `false`). When false, the launcher passes `--skip_download`, so **RFD never
fetches binaries from the internet**. RFD does that by default.

**`requestTimeoutSeconds`** is 1–30 (default 10).

**`allowedServerHosts`** is optional, 1–64 entries, each a valid host. When set, a resolve response naming any other
host is refused.

## Process start: no shell

`launch.rs` uses `std::process::Command::new(<configured exe>).args([...])`:

- one argv entry per value;
- `stdin` null;
- working directory set to the exe's folder.

The spec is `<prefix…> --skip_download -h <host> -p <port> -u <ticket>`. Host and port come from the validated
resolve response; the ticket comes from the strict URL parser.

Nothing is concatenated into a command string, and nothing is started through `cmd.exe`, PowerShell, `sh` or
`ShellExecute`. Rust's standard library quotes each argument for `CreateProcessW` on Windows. Because the exe must be
a `.exe`, the batch-file argument-escaping class of bugs (CVE-2024-24576) does not apply.

## TLS

`ureq` 2 uses its `rustls` backend with the bundled `webpki-roots` store. Certificate and hostname validation are
always on:

- there is no code path, config key or environment variable that disables them;
- redirects are disabled (`redirects(0)`);
- responses are capped at 64 KiB.

**Development:** the only exception is plain `http://localhost|127.0.0.1|[::1]`, and only with
`developmentAllowHttpLocalhost: true`. That is a different scheme, not a weakened TLS check.

**Production:** the API is served over HTTPS with a certificate from a public CA, valid for the configured host. A
self-signed or private-CA API is **not supported** by the launcher: there is no option to pin or trust extra roots.
Adding one would be a deliberate, reviewed change.

## Windows protocol registration (`launcher/src/register.rs`)

`--register` writes per-user keys under `HKCU\Software\Classes\ourrevival`. It needs no admin rights.

- `(default) = "URL:OurRevival Protocol"`
- `URL Protocol = ""`
- `shell\open\command (default) = "<absolute path>\RevivalLauncher.exe" "%1"` (REG_SZ, not REG_EXPAND_SZ, so no
  environment expansion)

How the argument boundary is protected:

- `protocol_command()` is a pure function, unit-tested on every platform. The exe path must be drive-absolute, must
  name a file, and may not contain `"`, `%` or control characters. So the path can't break out of its quotes or be
  expanded.
- `%1` is quoted, so a normal URL is exactly **one** argument. `good_url_is_exactly_one_argument` checks this by
  splitting the final command line with the Windows `CommandLineToArgvW` rules.
- The command line starts the launcher directly. There is no `cmd.exe`, `powershell`, `rundll32`, `start`, `&` or
  `|` (`command_has_no_shell`).
- **Malicious URL characters.** If a crafted link contains quotes, backslashes, tabs or percent-encodings, Windows
  may split it into several argv entries. `malicious_urls_cannot_produce_an_accepted_argument_list` shows two
  things:
  - the program never changes;
  - the result is never exactly one strict-grammar ticket argument.

  The launcher exits with a usage/URL error before any network call.
- `--unregister` deletes the key. It succeeds if the key is already absent.

**Linux:** `--register` writes `~/.local/share/applications/ourrevival-launcher.desktop` with
`Exec="<abs path>" %u`, atomically (write-then-rename). Paths that would need Desktop-Entry escaping (`"`, `` ` ``,
`$`, `\`, `%`) are refused.

## Repeated Play clicks and single-instance behavior

No daemon or single-instance lock is needed, and none was added:

- The launcher **never writes** its config. Only the user or installer edits it. Concurrent launchers only read it,
  so they cannot corrupt it.
- Each click issues a **new** ticket, and issuing one revokes the user's previous unused ticket (one live ticket per
  user). A launcher still holding the older ticket gets `TICKET_INVALID` at resolve and starts nothing.
- A launcher that already resolved its ticket starts its own RFD player. The server side stops a ticket from being
  used twice: a single-use redemption plus the adapter's one-admission join state.
- `--register` is idempotent. Two simultaneous runs write the same values; the Linux file is renamed into place
  atomically.
- The launcher has no other shared state: no lock files, caches or logs.

## Dependency audit (`cargo audit`, `cargo tree`)

`cargo audit` (cargo-audit 0.22.2, RustSec database fetched 2026-09-30, 1277 advisories) scanned 72 crates in
`Cargo.lock`, including the Windows-only `winreg`/`windows-sys`:

- **0 vulnerabilities, 0 unmaintained/unsound/yanked warnings.**
- No upgrades were needed and no breaking major upgrades were made.

Direct dependencies, each needed:

| Crate | Why |
|---|---|
| `serde` (derive) | Typed, `deny_unknown_fields` parsing of the config and the resolve response |
| `serde_json` | The JSON config and the API body |
| `ureq` 2, `default-features = false`, feature `tls` | Blocking HTTPS client (rustls + ring + webpki-roots). The `json` feature was **removed** this phase; the body is serialized with `serde_json` directly. Gzip, cookies, proxies and native-tls are all off. |
| `winreg` (Windows only) | Per-user protocol registration |

Strict URL parsing is our own code (`protocol.rs`, `config.rs`); no URL crate is used for trust decisions. `ureq` 2
pulls in `url` → `idna` → ICU crates for request URLs. That is the largest part of the tree. `ureq` 3 drops `url`,
but it is a breaking major with a new API. It is a reasonable later clean-up, not a security fix, so it was not done
here.

Re-run with:

```bash
cd launcher
cargo audit
cargo tree -e normal
```

## Release packaging (no auto-updater)

```bash
cd launcher && cargo build --release --target x86_64-pc-windows-gnu && cd ..
npm run launcher:package
```

This produces `launcher/dist/windows-x64/`:

- `RevivalLauncher.exe`
- `launcher.example.json` (placeholders only, no secrets)
- `README.txt` (install, config location, register/unregister, uninstall)
- `SHA256SUMS.txt`

`dist/`, `*.exe`, `*.pfx` and `*.p12` are git-ignored; **binaries are never committed**. The packaging script only
copies files and hashes them. It does not compile, sign, download or execute anything.

For users:

- **Install:** copy the `.exe` to a stable folder, e.g. `%LOCALAPPDATA%\Programs\OurRevival\`.
- **Configure:** write `%APPDATA%\OurRevival\launcher.json`.
- **Register:** `RevivalLauncher.exe --register`.
- **Unregister:** `RevivalLauncher.exe --unregister`.

There is no auto-updater. Updates are a manual download, verified against the published SHA-256.

## Code signing

The builds produced here are **unsigned development builds**. No certificate was created, faked or self-signed for
distribution. Windows SmartScreen will warn about them, and the README says so.

For public releases:

1. Obtain an Authenticode code-signing certificate from a CA, in the project's legal name (OV, or EV for immediate
   SmartScreen reputation). Keep the private key in a hardware token or cloud HSM, never in the repo or on CI disks.
2. Sign on a release machine:
   `signtool sign /fd SHA256 /tr <CA RFC3161 timestamp URL> /td SHA256 RevivalLauncher.exe`. Verify with
   `signtool verify /pa /v`.
3. Publish the SHA-256 of the signed file next to the download link.
4. Sign every release; never ship a re-signed third-party binary (for example, RFD itself).

## Remaining risks

- **Unsigned binaries** until a certificate is obtained.
- **A user who edits their own config** can point `rfdExecutable` at any `.exe`. This is local-user trust, not
  remote: nothing in a link or API response can change it.
- **`allowedServerHosts` is optional.** Distributed configs should set it.
- **No update channel**, so users must fetch fixes manually.
