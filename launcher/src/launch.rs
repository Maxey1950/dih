//! Builds and starts the RFD player process.
//!
//! Safety rules:
//! - The program is the configured, validated executable path; never derived
//!   from the URL or the API.
//! - Arguments are passed as an argv array (std::process::Command::args):
//!   no shell, no cmd.exe, no string concatenation.
//! - host/port come only from the validated resolve response; the ticket only
//!   from the strict URL parser.

use crate::api::Resolved;
use crate::config::Config;
use crate::protocol::Ticket;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
}

/// `<rfd> <prefix...> [--skip_download] -h <host> -p <port> -u <ticket>` (RFD
/// `player` subcommand: -h/-p are the RFD web server host/port, -u is the user
/// code; --skip_download stops RFD fetching binaries from the internet).
pub fn build_launch_spec(config: &Config, resolved: &Resolved, ticket: &Ticket) -> LaunchSpec {
    let mut args = config.rfd_args_prefix.clone();
    if !config.rfd_allow_auto_download {
        args.push("--skip_download".to_string());
    }
    args.extend([
        "-h".to_string(),
        resolved.server.host.clone(),
        "-p".to_string(),
        resolved.server.port.to_string(),
        "-u".to_string(),
        ticket.as_str().to_string(),
    ]);
    LaunchSpec { program: config.rfd_executable.clone(), args }
}

pub trait ProcessRunner {
    fn spawn(&self, spec: &LaunchSpec) -> std::io::Result<()>;
}

/// Real runner: direct process creation, no shell.
pub struct SystemRunner;

impl ProcessRunner for SystemRunner {
    fn spawn(&self, spec: &LaunchSpec) -> std::io::Result<()> {
        let mut command = Command::new(&spec.program);
        command.args(&spec.args).stdin(Stdio::null());
        if let Some(dir) = spec.program.parent() {
            command.current_dir(dir);
        }
        command.spawn().map(|_child| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::{parse_resolved, ResolvedServer};
    use crate::protocol::parse_launch_url;
    use std::cell::RefCell;

    struct RecordingRunner(RefCell<Vec<LaunchSpec>>);
    impl ProcessRunner for RecordingRunner {
        fn spawn(&self, spec: &LaunchSpec) -> std::io::Result<()> {
            self.0.borrow_mut().push(spec.clone());
            Ok(())
        }
    }

    const TICKET: &str = "rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";

    fn fixture() -> (Config, Resolved, Ticket) {
        let config = Config {
            api_base_url: "https://play.example.com".into(),
            rfd_executable: PathBuf::from("/opt/rfd/RFD"),
            rfd_args_prefix: vec!["player".into()],
            allowed_server_hosts: None,
            development_allow_http_localhost: false,
            rfd_allow_auto_download: false,
            request_timeout_seconds: 10,
        };
        let body = r#"{"game":{"id":"g","placeId":7,"name":"Arena"},"server":{"host":"10.0.0.5","port":2005},"player":{"id":"u","numericId":3,"username":"bob"},"ticket":{"expiresAt":"x"}}"#;
        let resolved = parse_resolved(body, None).unwrap();
        let ticket = parse_launch_url(&format!("ourrevival://join?ticket={TICKET}")).unwrap();
        (config, resolved, ticket)
    }

    #[test]
    fn exact_argument_order_and_program() {
        let (config, resolved, ticket) = fixture();
        let spec = build_launch_spec(&config, &resolved, &ticket);
        assert_eq!(spec.program, PathBuf::from("/opt/rfd/RFD"));
        assert_eq!(spec.args, vec!["player", "--skip_download", "-h", "10.0.0.5", "-p", "2005", "-u", TICKET]);
        let mut allow = config.clone();
        allow.rfd_allow_auto_download = true;
        assert_eq!(build_launch_spec(&allow, &resolved, &ticket).args, vec!["player", "-h", "10.0.0.5", "-p", "2005", "-u", TICKET]);
    }

    #[test]
    fn values_stay_single_arguments() {
        let (config, mut resolved, ticket) = fixture();
        // Even if validation were bypassed, a hostile host is ONE argv entry, never split or shell-parsed.
        resolved.server = ResolvedServer { host: "a.example --evil x".into(), port: 1 };
        let spec = build_launch_spec(&config, &resolved, &ticket);
        assert_eq!(spec.args.len(), 8);
        assert_eq!(spec.args[3], "a.example --evil x");
    }

    #[test]
    fn runner_receives_spec_without_shell() {
        let (config, resolved, ticket) = fixture();
        let runner = RecordingRunner(RefCell::new(vec![]));
        let spec = build_launch_spec(&config, &resolved, &ticket);
        runner.spawn(&spec).unwrap();
        let calls = runner.0.borrow();
        assert_eq!(calls.len(), 1);
        assert!(!calls[0].program.to_string_lossy().contains("cmd"));
        assert!(!calls[0].args.iter().any(|a| a == "/c" || a == "-c"));
    }
}
