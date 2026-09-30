//! Launcher configuration (JSON). Written by the installer/admin, never by URLs.
//!
//! Location: `%APPDATA%\OurRevival\launcher.json` on Windows,
//! `$XDG_CONFIG_HOME/ourrevival/launcher.json` (or `~/.config/...`) elsewhere,
//! or the path in `OURREVIVAL_LAUNCHER_CONFIG`.
//!
//! It contains NO secrets: no passwords, cookies, database or server credentials.
//! The launcher only ever READS this file, so any number of launcher instances
//! can run at once without corrupting it.
//!
//! This file is the ONLY source of the API origin and the RFD path. The launch
//! URL carries nothing but the one-time ticket and cannot override either.

use serde::Deserialize;
use std::path::{Component, Path, PathBuf};

const MAX_CONFIG_BYTES: u64 = 64 * 1024;
pub const DEFAULT_TIMEOUT_SECONDS: u64 = 10;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Config {
    /// Public API origin only, e.g. "https://play.example.com" (no path, query, credentials).
    pub api_base_url: String,
    /// Absolute path to the RFD 2018/v347 player executable (e.g. C:\RFD\RFD.exe).
    /// A file path only; never a command line.
    pub rfd_executable: PathBuf,
    /// Fixed subcommand words placed before the join arguments. Default: ["player"].
    #[serde(default = "default_prefix")]
    pub rfd_args_prefix: Vec<String>,
    /// Optional allow-list of game-server hosts the launcher will connect to.
    #[serde(default)]
    pub allowed_server_hosts: Option<Vec<String>>,
    /// DEVELOPMENT ONLY: permit `http://localhost|127.0.0.1|[::1]` as the API origin.
    /// Production configs leave this out (false): HTTPS with normal certificate validation.
    #[serde(default)]
    pub development_allow_http_localhost: bool,
    /// RFD downloads game binaries from the internet on first run unless it is
    /// given `--skip_download`. The launcher passes that flag unless this is
    /// explicitly set to true. Install RFD's v347 files ahead of time instead.
    #[serde(default)]
    pub rfd_allow_auto_download: bool,
    /// Resolve request timeout, 1-30 seconds. Default 10.
    #[serde(default = "default_timeout")]
    pub request_timeout_seconds: u64,
}

fn default_prefix() -> Vec<String> {
    vec!["player".to_string()]
}

fn default_timeout() -> u64 {
    DEFAULT_TIMEOUT_SECONDS
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    NotFound(PathBuf),
    Invalid(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::NotFound(p) => write!(f, "launcher config not found at {}", p.display()),
            ConfigError::Invalid(m) => write!(f, "invalid launcher config: {m}"),
        }
    }
}

pub fn default_config_path() -> PathBuf {
    if let Some(p) = std::env::var_os("OURREVIVAL_LAUNCHER_CONFIG") {
        return PathBuf::from(p);
    }
    if cfg!(windows) {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            return Path::new(&appdata).join("OurRevival").join("launcher.json");
        }
    }
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| Path::new(&h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("ourrevival").join("launcher.json")
}

pub fn load(path: &Path) -> Result<Config, ConfigError> {
    use std::io::Read;
    let file = std::fs::File::open(path).map_err(|_| ConfigError::NotFound(path.to_path_buf()))?;
    let mut text = String::new();
    file.take(MAX_CONFIG_BYTES + 1)
        .read_to_string(&mut text)
        .map_err(|e| ConfigError::Invalid(e.to_string()))?;
    if text.len() as u64 > MAX_CONFIG_BYTES {
        return Err(ConfigError::Invalid("config file is too large".into()));
    }
    let config: Config = serde_json::from_str(&text).map_err(|e| ConfigError::Invalid(e.to_string()))?;
    validate(&config)?;
    Ok(config)
}

/// Returns the validated API origin without a trailing slash.
pub fn api_base(config: &Config) -> &str {
    config.api_base_url.strip_suffix('/').unwrap_or(&config.api_base_url)
}

fn invalid<T>(m: &str) -> Result<T, ConfigError> {
    Err(ConfigError::Invalid(m.to_string()))
}

fn is_dns_name(host: &str) -> bool {
    !host.is_empty()
        && host.len() <= 253
        && host.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
}

/// Validates `scheme://host[:port][/]` and nothing else.
pub fn validate_api_origin(url: &str, allow_http_localhost: bool) -> Result<(), ConfigError> {
    let base = url.strip_suffix('/').unwrap_or(url);
    let Some((scheme, authority)) = base.split_once("://") else {
        return invalid("apiBaseUrl must be an absolute https:// origin");
    };
    if authority.is_empty() || !authority.bytes().all(|b| b.is_ascii_graphic()) || authority.contains(['/', '@', '?', '#', '\\', '%']) {
        return invalid("apiBaseUrl must be an origin only (no path, credentials, query, fragment or spaces)");
    }
    let (host, port) = if let Some(rest) = authority.strip_prefix('[') {
        let Some((v6, after)) = rest.split_once(']') else { return invalid("apiBaseUrl has a malformed IPv6 host") };
        if v6.parse::<std::net::Ipv6Addr>().is_err() {
            return invalid("apiBaseUrl has a malformed IPv6 host");
        }
        let port = match after {
            "" => None,
            p => Some(p.strip_prefix(':').ok_or_else(|| ConfigError::Invalid("apiBaseUrl has a malformed port".into()))?),
        };
        (format!("[{v6}]"), port)
    } else {
        match authority.split_once(':') {
            Some((h, p)) => (h.to_ascii_lowercase(), Some(p)),
            None => (authority.to_ascii_lowercase(), None),
        }
    };
    if let Some(p) = port {
        if p.is_empty() || p.len() > 5 || !p.bytes().all(|b| b.is_ascii_digit()) || !(1..=65535).contains(&p.parse::<u32>().unwrap_or(0)) {
            return invalid("apiBaseUrl has a malformed port");
        }
    }
    if !host.starts_with('[') && !is_dns_name(&host) {
        return invalid("apiBaseUrl has a malformed host");
    }
    match scheme {
        "https" => Ok(()),
        "http" if allow_http_localhost && matches!(host.as_str(), "localhost" | "127.0.0.1" | "[::1]") => Ok(()),
        "http" => invalid("apiBaseUrl must use https (plain http needs developmentAllowHttpLocalhost and a localhost origin)"),
        _ => invalid("apiBaseUrl must use https"),
    }
}

/// String-level rules for the RFD executable path, independent of the host OS
/// so they can be unit-tested for Windows on any platform.
pub fn check_executable_path(path: &str, windows: bool) -> Result<(), ConfigError> {
    if path.is_empty() || path.len() > 1024 || path.trim() != path {
        return invalid("rfdExecutable must be a plain path without leading/trailing whitespace");
    }
    // Quote, percent (registry/env expansion), shell metacharacters and control
    // characters have no business in an executable path; refusing them makes it
    // impossible to smuggle a command line into this setting.
    if path.chars().any(|c| c.is_control() || matches!(c, '"' | '%' | '^' | '&' | '|' | '<' | '>' | '`' | '$' | ';' | '*' | '?')) {
        return invalid("rfdExecutable contains characters that are not allowed in an executable path");
    }
    let file_name = if windows {
        let b = path.as_bytes();
        // Drive-absolute only (C:\...): no relative, UNC (\\server\share) or device (\\?\) paths.
        if !(b.len() > 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && b[2] == b'\\') || path.contains('/') {
            return invalid(r"rfdExecutable must be an absolute local path like C:\RFD\RFD.exe");
        }
        if path.split('\\').any(|c| c == ".." || c == ".") {
            return invalid("rfdExecutable must not contain . or .. components");
        }
        let name = path.rsplit('\\').next().unwrap_or("");
        // Never let Windows route the launch through cmd.exe (.bat/.cmd) or a script host.
        if !name.to_ascii_lowercase().ends_with(".exe") || name.len() <= 4 {
            return invalid("rfdExecutable must be an .exe file");
        }
        name.to_string()
    } else {
        let p = Path::new(path);
        if !p.is_absolute() || p.components().any(|c| matches!(c, Component::ParentDir | Component::CurDir)) {
            return invalid("rfdExecutable must be an absolute path without . or .. components");
        }
        p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string()
    };
    if file_name.is_empty() || file_name.starts_with('-') || file_name.contains(" -") {
        return invalid("rfdExecutable must be a file path, not a command line");
    }
    Ok(())
}

fn is_prefix_word(a: &str) -> bool {
    !a.is_empty() && a.len() <= 64 && !a.starts_with(['-', '/']) && a.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'-'))
}

pub fn validate(c: &Config) -> Result<(), ConfigError> {
    validate_api_origin(&c.api_base_url, c.development_allow_http_localhost)?;
    let exe = c.rfd_executable.to_str().ok_or_else(|| ConfigError::Invalid("rfdExecutable must be valid Unicode".into()))?;
    check_executable_path(exe, cfg!(windows))?;
    if !c.rfd_executable.is_file() {
        return invalid("rfdExecutable does not exist or is not a file");
    }
    // Subcommand words only (e.g. "player"): no flags, so the prefix cannot
    // override the -h/-p/-u values that come from the resolved ticket.
    if c.rfd_args_prefix.len() > 4 || !c.rfd_args_prefix.iter().all(|a| is_prefix_word(a)) {
        return invalid("rfdArgsPrefix must be at most 4 plain words like \"player\" (no flags)");
    }
    if !(1..=30).contains(&c.request_timeout_seconds) {
        return invalid("requestTimeoutSeconds must be between 1 and 30");
    }
    if let Some(hosts) = &c.allowed_server_hosts {
        if hosts.is_empty() || hosts.len() > 64 || !hosts.iter().all(|h| crate::api::is_valid_host(h)) {
            return invalid("allowedServerHosts must list 1-64 valid host names or IPs");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(base: &str, exe: PathBuf) -> Config {
        Config {
            api_base_url: base.into(),
            rfd_executable: exe,
            rfd_args_prefix: default_prefix(),
            allowed_server_hosts: None,
            development_allow_http_localhost: false,
            rfd_allow_auto_download: false,
            request_timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
        }
    }

    fn existing_file() -> PathBuf {
        std::env::current_exe().unwrap()
    }

    #[test]
    fn production_origins() {
        for ok in ["https://play.example.com", "https://play.example.com/", "https://play.example.com:8443", "https://[2001:db8::1]:443", "https://127.0.0.1"] {
            assert!(validate_api_origin(ok, false).is_ok(), "{ok}");
        }
        for bad in [
            "http://play.example.com",
            "http://localhost:3000", // needs the development flag
            "ftp://x.example",
            "play.example.com",
            "https://user:pw@x.example",
            "https://x.example@evil.example",
            "https://x.example/api",
            "https://x.example/?a=1",
            "https://x.example#f",
            "https://",
            "https://x.example:0",
            "https://x.example:99999",
            "https://x.example:80:80",
            "https://x .example",
            "https://x.example\\@evil",
            "https://%65vil.example",
            "HTTPS://x.example",
            "https://[::1",
        ] {
            assert!(validate_api_origin(bad, false).is_err(), "{bad}");
        }
    }

    #[test]
    fn development_http_is_exact_localhost_only() {
        for ok in ["http://localhost:3000", "http://127.0.0.1:4000/", "http://[::1]:4000"] {
            assert!(validate_api_origin(ok, true).is_ok(), "{ok}");
        }
        for bad in ["http://localhost.evil.example", "http://127.0.0.1.nip.io", "http://10.0.0.5:4000", "http://evil.example", "http://127.0.0.2", "http://0.0.0.0"] {
            assert!(validate_api_origin(bad, true).is_err(), "{bad}");
        }
    }

    #[test]
    fn full_config_validation() {
        if cfg!(windows) {
            return;
        }
        assert!(validate(&cfg("https://play.example.com", existing_file())).is_ok());
        let mut dev = cfg("http://127.0.0.1:3000", existing_file());
        assert!(validate(&dev).is_err());
        dev.development_allow_http_localhost = true;
        assert!(validate(&dev).is_ok());
    }

    #[test]
    fn executable_must_be_a_file_not_a_command_line() {
        let dir = std::env::temp_dir();
        assert!(validate(&cfg("https://x.example", PathBuf::from("RFD.exe"))).is_err());
        assert!(validate(&cfg("https://x.example", PathBuf::from("/definitely/not/here/RFD.exe"))).is_err());
        assert!(validate(&cfg("https://x.example", dir)).is_err(), "a directory is not a file");
        let exe = existing_file().display().to_string();
        let with_args = PathBuf::from(format!("{exe} --argument"));
        assert!(validate(&cfg("https://x.example", with_args)).is_err());
    }

    #[test]
    fn windows_executable_path_rules() {
        assert!(check_executable_path(r"C:\Program Files\RFD\RFD.exe", true).is_ok());
        assert!(check_executable_path(r"D:\Games\RFD - Copy\RFD.EXE", true).is_ok());
        for bad in [
            r"RFD.exe",
            r"\RFD\RFD.exe",
            r"\\server\share\RFD.exe",
            r"\\?\C:\RFD\RFD.exe",
            r"C:/RFD/RFD.exe",
            r"C:\RFD\run.bat",
            r"C:\RFD\run.cmd",
            r"C:\RFD\RFD.ps1",
            r"C:\RFD\.exe",
            r"C:\RFD\RFD.exe --argument",
            r#""C:\RFD\RFD.exe" --argument"#,
            r"C:\RFD\RFD.exe & calc.exe",
            r"C:\RFD\RFD.exe | calc",
            r"%APPDATA%\RFD\RFD.exe",
            r"C:\RFD\..\Windows\System32\cmd.exe",
            r"C:\RFD\-x.exe",
            " C:\\RFD\\RFD.exe",
            "C:\\RFD\\RFD.exe\n",
            r"C:\RFD\RFD^.exe",
        ] {
            assert!(check_executable_path(bad, true).is_err(), "{bad}");
        }
    }

    #[test]
    fn unix_executable_path_rules() {
        assert!(check_executable_path("/opt/rfd/RFD", false).is_ok());
        for bad in ["RFD", "./RFD", "/opt/rfd/../bin/sh", "/opt/rfd/RFD --argument", "/opt/rfd/$(id)", "/opt/rfd/-x", "/opt/rfd/RFD;id"] {
            assert!(check_executable_path(bad, false).is_err(), "{bad}");
        }
    }

    #[test]
    fn prefix_timeout_and_hosts() {
        if cfg!(windows) {
            return;
        }
        let mut c = cfg("https://x.example", existing_file());
        for prefix in [vec!["-h".to_string()], vec!["player".into(), "--host=evil".into()], vec!["a b".into()], vec!["".into()]] {
            c.rfd_args_prefix = prefix.clone();
            assert!(validate(&c).is_err(), "{prefix:?}");
        }
        c.rfd_args_prefix = default_prefix();
        for t in [0, 31, 1000] {
            c.request_timeout_seconds = t;
            assert!(validate(&c).is_err(), "{t}");
        }
        c.request_timeout_seconds = 30;
        assert!(validate(&c).is_ok());
        c.allowed_server_hosts = Some(vec![]);
        assert!(validate(&c).is_err());
        c.allowed_server_hosts = Some(vec!["-evil".into()]);
        assert!(validate(&c).is_err());
        c.allowed_server_hosts = Some(vec!["games.example.com".into()]);
        assert!(validate(&c).is_ok());
    }

    #[test]
    fn rejects_unknown_config_fields() {
        for json in [
            r#"{"apiBaseUrl":"https://x.example","rfdExecutable":"/bin/true","password":"hunter2"}"#,
            r#"{"apiBaseUrl":"https://x.example","rfdExecutable":"/bin/true","ignoreTlsErrors":true}"#,
            r#"{"apiBaseUrl":"https://x.example","rfdExecutable":"/bin/true","dangerAcceptInvalidCerts":true}"#,
        ] {
            assert!(serde_json::from_str::<Config>(json).is_err(), "{json}");
        }
    }

    #[test]
    fn oversized_config_file_is_refused() {
        let path = std::env::temp_dir().join(format!("ourrevival-big-{}.json", std::process::id()));
        std::fs::write(&path, " ".repeat((MAX_CONFIG_BYTES + 10) as usize)).unwrap();
        let result = load(&path);
        std::fs::remove_file(&path).ok();
        assert_eq!(result.unwrap_err(), ConfigError::Invalid("config file is too large".into()));
    }
}
