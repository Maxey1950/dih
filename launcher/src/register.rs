//! Registers `ourrevival://` for the current user.
//!
//! Windows: HKCU\Software\Classes\ourrevival\shell\open\command =
//!   "<absolute launcher.exe>" "%1"
//! (per-user; no admin rights). Windows substitutes the clicked URL for %1 and
//! starts the launcher directly with CreateProcess: no cmd.exe, no PowerShell.
//! Linux: writes a .desktop handler file; the user then runs
//! `xdg-mime default ourrevival-launcher.desktop x-scheme-handler/ourrevival`.
//! Nothing here runs a shell or other programs.
//!
//! Argument boundary: the exe path is quoted and may not contain `"` or `%`,
//! and `%1` is quoted as one argument. Even if a crafted URL contained quotes
//! and split into several argv entries, the launcher accepts exactly ONE
//! argument that must match the strict `ourrevival://join?ticket=rvjt_...`
//! grammar; anything else exits before any network call or process start.

use std::path::Path;

#[derive(Debug, PartialEq, Eq)]
pub struct UnsafePath(pub &'static str);

impl std::fmt::Display for UnsafePath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.0)
    }
}

/// The exact `shell\open\command` value. Pure, so it is unit-tested on every platform.
pub fn protocol_command(exe: &str) -> Result<String, UnsafePath> {
    let b = exe.as_bytes();
    let drive_absolute = b.len() > 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && b[2] == b'\\';
    if !drive_absolute {
        return Err(UnsafePath("launcher path must be an absolute local path like C:\\...\\RevivalLauncher.exe"));
    }
    if exe.chars().any(|c| c == '"' || c == '%' || c.is_control()) {
        return Err(UnsafePath("launcher path must not contain quotes, % or control characters"));
    }
    if exe.ends_with('\\') {
        return Err(UnsafePath("launcher path must name a file"));
    }
    Ok(format!("\"{exe}\" \"%1\""))
}

/// The `.desktop` file for Linux. Exec quoting per the Desktop Entry spec; paths
/// needing escapes (`"`, `` ` ``, `$`, `\`) or containing `%` are refused.
pub fn desktop_entry(exe: &str) -> Result<String, UnsafePath> {
    if !exe.starts_with('/') {
        return Err(UnsafePath("launcher path must be absolute"));
    }
    if exe.chars().any(|c| matches!(c, '"' | '`' | '$' | '\\' | '%') || c.is_control()) {
        return Err(UnsafePath("launcher path contains characters that are not allowed"));
    }
    Ok(format!(
        "[Desktop Entry]\nType=Application\nName=OurRevival Launcher\nExec=\"{exe}\" %u\nNoDisplay=true\nMimeType=x-scheme-handler/ourrevival;\n"
    ))
}

fn path_str(exe: &Path) -> std::io::Result<&str> {
    exe.to_str()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "launcher path is not valid Unicode"))
}

fn invalid(e: UnsafePath) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidInput, e.0)
}

#[cfg(windows)]
pub fn register(exe: &Path) -> std::io::Result<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let command = protocol_command(path_str(exe)?).map_err(invalid)?;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(r"Software\Classes\ourrevival")?;
    key.set_value("", &"URL:OurRevival Protocol")?;
    key.set_value("URL Protocol", &"")?;
    let (cmd, _) = key.create_subkey(r"shell\open\command")?;
    cmd.set_value("", &command)?; // REG_SZ, not REG_EXPAND_SZ: no environment expansion
    Ok(format!(r"registered HKCU\Software\Classes\ourrevival -> {command}"))
}

#[cfg(windows)]
pub fn unregister() -> std::io::Result<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    match RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(r"Software\Classes\ourrevival") {
        Ok(()) => Ok("unregistered".to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("was not registered".to_string()),
        Err(e) => Err(e),
    }
}

#[cfg(not(windows))]
fn desktop_path() -> std::path::PathBuf {
    let data = std::env::var_os("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| Path::new(&h).join(".local/share")))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    data.join("applications").join("ourrevival-launcher.desktop")
}

#[cfg(not(windows))]
pub fn register(exe: &Path) -> std::io::Result<String> {
    let entry = desktop_entry(path_str(exe)?).map_err(invalid)?;
    let path = desktop_path();
    let dir = path.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(dir)?;
    // Write-then-rename so two simultaneous --register runs never leave a torn file.
    let tmp = dir.join(format!(".ourrevival-launcher.desktop.{}", std::process::id()));
    std::fs::write(&tmp, entry)?;
    std::fs::rename(&tmp, &path)?;
    Ok(format!(
        "wrote {}; now run: xdg-mime default ourrevival-launcher.desktop x-scheme-handler/ourrevival",
        path.display()
    ))
}

#[cfg(not(windows))]
pub fn unregister() -> std::io::Result<String> {
    let path = desktop_path();
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(format!("removed {}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("was not registered".to_string()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::parse_launch_url;

    /// Windows' command-line splitting rules (CommandLineToArgvW / MSVC CRT),
    /// used to check what argv the launcher would receive.
    fn windows_argv(cmdline: &str) -> Vec<String> {
        let mut args = Vec::new();
        let mut cur = String::new();
        let mut in_quotes = false;
        let mut have_arg = false;
        let chars: Vec<char> = cmdline.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            if c == '\\' {
                let mut n = 0;
                while i < chars.len() && chars[i] == '\\' {
                    n += 1;
                    i += 1;
                }
                if i < chars.len() && chars[i] == '"' {
                    cur.extend(std::iter::repeat_n('\\', n / 2));
                    if n % 2 == 1 {
                        cur.push('"');
                        i += 1;
                    }
                } else {
                    cur.extend(std::iter::repeat_n('\\', n));
                }
                have_arg = true;
                continue;
            }
            if c == '"' {
                if in_quotes && i + 1 < chars.len() && chars[i + 1] == '"' {
                    cur.push('"');
                    i += 2;
                    continue;
                }
                in_quotes = !in_quotes;
                have_arg = true;
            } else if (c == ' ' || c == '\t') && !in_quotes {
                if have_arg {
                    args.push(std::mem::take(&mut cur));
                    have_arg = false;
                }
            } else {
                cur.push(c);
                have_arg = true;
            }
            i += 1;
        }
        if have_arg {
            args.push(cur);
        }
        args
    }

    const EXE: &str = r"C:\Program Files\OurRevival\RevivalLauncher.exe";
    const GOOD_URL: &str = "ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";

    #[test]
    fn exact_command_string() {
        assert_eq!(protocol_command(EXE).unwrap(), r#""C:\Program Files\OurRevival\RevivalLauncher.exe" "%1""#);
    }

    #[test]
    fn command_has_no_shell() {
        let cmd = protocol_command(EXE).unwrap().to_ascii_lowercase();
        for needle in ["cmd.exe", "cmd /c", "powershell", "pwsh", "rundll32", "start ", "&", "|"] {
            assert!(!cmd.contains(needle), "{needle}");
        }
    }

    #[test]
    fn unsafe_launcher_paths_are_refused() {
        for bad in [
            r"RevivalLauncher.exe",
            r"\\server\share\RevivalLauncher.exe",
            r#"C:\a" "--evil"#,
            r"C:\%USERPROFILE%\RevivalLauncher.exe",
            "C:\\a\nb.exe",
            r"C:\dir\",
        ] {
            assert!(protocol_command(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn good_url_is_exactly_one_argument() {
        let cmd = protocol_command(EXE).unwrap().replace("%1", GOOD_URL);
        let argv = windows_argv(&cmd);
        assert_eq!(argv, vec![EXE.to_string(), GOOD_URL.to_string()]);
        assert!(parse_launch_url(&argv[1]).is_ok());
    }

    #[test]
    fn malicious_urls_cannot_produce_an_accepted_argument_list() {
        let attacks = [
            r#"ourrevival://join?ticket=rvjt_x" --api https://evil.example ""#,
            r#"ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE" "-h" "evil"#,
            r#"ourrevival://x\" & calc.exe & \""#,
            "ourrevival://join?ticket=a b c",
            r#"ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE\"#,
            r#"ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE&host=evil.example"#,
            "ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE%22%20--x",
            "ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE\t-u\tother",
        ];
        for url in attacks {
            let cmd = protocol_command(EXE).unwrap().replace("%1", url);
            let argv = windows_argv(&cmd);
            assert_eq!(argv[0], EXE, "the program is never changed: {url}");
            let accepted = argv.len() == 2 && parse_launch_url(&argv[1]).is_ok();
            assert!(!accepted, "must be rejected: {url} -> {argv:?}");
        }
    }

    #[test]
    fn desktop_entry_quoting() {
        assert!(desktop_entry("/opt/ourrevival/ourrevival-launcher").unwrap().contains("Exec=\"/opt/ourrevival/ourrevival-launcher\" %u\n"));
        for bad in ["relative", "/opt/a\"b", "/opt/$HOME/x", "/opt/`id`", "/opt/a%u", "/opt/a\\b", "/opt/a\nExec=evil"] {
            assert!(desktop_entry(bad).is_err(), "{bad}");
        }
    }
}
