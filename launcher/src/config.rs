//! Launcher configuration (JSON). Written by the installer/admin, not by URLs.
//!
//! Location: `%APPDATA%\OurRevival\launcher.json` on Windows,
//! `$XDG_CONFIG_HOME/ourrevival/launcher.json` (or `~/.config/...`) elsewhere,
//! or the path in `OURREVIVAL_LAUNCHER_CONFIG`.
//!
//! It contains NO secrets: no passwords, cookies, database or server credentials.

use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Config {
    /// Public API origin, e.g. "https://play.example.com". https only, except loopback for development.
    pub api_base_url: String,
    /// Absolute path to the RFD 2018/v347 player entry point (e.g. C:\RFD\RFD.exe).
    pub rfd_executable: PathBuf,
    /// Fixed arguments placed before the join arguments. Default: ["player"].
    #[serde(default = "default_prefix")]
    pub rfd_args_prefix: Vec<String>,
    /// Optional allow-list of game-server hosts the launcher will connect to.
    #[serde(default)]
    pub allowed_server_hosts: Option<Vec<String>>,
}

fn default_prefix() -> Vec<String> {
    vec!["player".to_string()]
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
    let text = std::fs::read_to_string(path).map_err(|_| ConfigError::NotFound(path.to_path_buf()))?;
    let config: Config = serde_json::from_str(&text).map_err(|e| ConfigError::Invalid(e.to_string()))?;
    validate(&config)?;
    Ok(config)
}

/// Returns the API base without a trailing slash.
pub fn api_base(config: &Config) -> &str {
    config.api_base_url.trim_end_matches('/')
}

pub fn validate(c: &Config) -> Result<(), ConfigError> {
    let bad = |m: &str| Err(ConfigError::Invalid(m.to_string()));
    let base = api_base(c);
    let (scheme, rest) = match base.split_once("://") {
        Some(x) => x,
        None => return bad("apiBaseUrl must be an absolute URL"),
    };
    if rest.is_empty() || rest.contains(['@', '?', '#', ' ', '\\']) {
        return bad("apiBaseUrl must not contain credentials, a query, a fragment or spaces");
    }
    let host = rest.split('/').next().unwrap_or("");
    let host_only = if host.starts_with('[') { host.split(']').next().unwrap_or("").trim_start_matches('[') } else { host.split(':').next().unwrap_or("") };
    let loopback = matches!(host_only, "localhost" | "127.0.0.1" | "::1");
    match scheme {
        "https" => {}
        "http" if loopback => {}
        _ => return bad("apiBaseUrl must use https (http is allowed only for localhost)"),
    }
    if !c.rfd_executable.is_absolute() {
        return bad("rfdExecutable must be an absolute path");
    }
    if !c.rfd_executable.is_file() {
        return bad("rfdExecutable does not exist or is not a file");
    }
    if cfg!(windows) {
        // Never let Windows route the launch through cmd.exe (.bat/.cmd files).
        let ext = c.rfd_executable.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        if ext != "exe" {
            return bad("rfdExecutable must be an .exe file");
        }
    }
    if c.rfd_args_prefix.iter().any(|a| a.is_empty() || a.len() > 64) {
        return bad("rfdArgsPrefix entries must be 1-64 characters");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(base: &str, exe: PathBuf) -> Config {
        Config { api_base_url: base.into(), rfd_executable: exe, rfd_args_prefix: default_prefix(), allowed_server_hosts: None }
    }

    fn existing_file() -> PathBuf {
        std::env::current_exe().unwrap()
    }

    #[test]
    fn accepts_https_and_loopback_http() {
        if cfg!(windows) {
            return;
        }
        assert!(validate(&cfg("https://play.example.com", existing_file())).is_ok());
        assert!(validate(&cfg("http://127.0.0.1:3000/", existing_file())).is_ok());
        assert!(validate(&cfg("http://localhost:3000", existing_file())).is_ok());
    }

    #[test]
    fn rejects_insecure_or_odd_api_urls() {
        for base in ["http://play.example.com", "ftp://x", "play.example.com", "https://user:pw@x.example", "https://x.example/?a=1", "https://"] {
            assert!(validate(&cfg(base, existing_file())).is_err(), "{base}");
        }
    }

    #[test]
    fn rejects_missing_or_relative_executable() {
        assert!(validate(&cfg("https://x.example", PathBuf::from("RFD.exe"))).is_err());
        assert!(validate(&cfg("https://x.example", PathBuf::from("/definitely/not/here/RFD.exe"))).is_err());
    }

    #[test]
    fn rejects_unknown_config_fields() {
        let json = r#"{"apiBaseUrl":"https://x.example","rfdExecutable":"/bin/true","password":"hunter2"}"#;
        assert!(serde_json::from_str::<Config>(json).is_err());
    }
}
