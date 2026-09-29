//! OurRevival launcher: `ourrevival://join?ticket=...` -> resolve -> RFD player.
pub mod api;
pub mod config;
pub mod launch;
pub mod protocol;
pub mod register;

use api::{Resolved, ResolveError};
use config::Config;
use launch::{build_launch_spec, ProcessRunner};
use protocol::{parse_launch_url, Ticket};

#[derive(Debug)]
pub enum LaunchError {
    Usage,
    BadUrl(protocol::ParseError),
    Resolve(ResolveError),
    Spawn(String),
}

impl std::fmt::Display for LaunchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LaunchError::Usage => write!(f, "expected exactly one ourrevival://join?ticket=... argument"),
            LaunchError::BadUrl(e) => write!(f, "rejected launch link ({e:?})"),
            LaunchError::Resolve(e) => write!(f, "{e}"),
            LaunchError::Spawn(e) => write!(f, "could not start RFD: {e}"),
        }
    }
}

/// The whole launch flow, with the network call and process creation injected
/// so it can be tested without a server or RFD. `url_args` must be exactly the
/// one argument the OS passed (the launch URL).
pub fn handle_launch(
    url_args: &[String],
    config: &Config,
    resolve: impl FnOnce(&Ticket) -> Result<Resolved, ResolveError>,
    runner: &dyn ProcessRunner,
) -> Result<(), LaunchError> {
    let [url] = url_args else { return Err(LaunchError::Usage) };
    let ticket = parse_launch_url(url).map_err(LaunchError::BadUrl)?;
    let resolved = resolve(&ticket).map_err(LaunchError::Resolve)?;
    let spec = build_launch_spec(config, &resolved, &ticket);
    runner.spawn(&spec).map_err(|e| LaunchError::Spawn(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use api::parse_resolved;
    use launch::LaunchSpec;
    use std::cell::RefCell;
    use std::path::PathBuf;

    struct Recorder(RefCell<Vec<LaunchSpec>>);
    impl ProcessRunner for Recorder {
        fn spawn(&self, spec: &LaunchSpec) -> std::io::Result<()> {
            self.0.borrow_mut().push(spec.clone());
            Ok(())
        }
    }

    const URL: &str = "ourrevival://join?ticket=rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";

    fn config() -> Config {
        Config { api_base_url: "https://x.example".into(), rfd_executable: PathBuf::from("/opt/rfd/RFD"), rfd_args_prefix: vec!["player".into()], allowed_server_hosts: None }
    }

    #[test]
    fn happy_path_spawns_once() {
        let rec = Recorder(RefCell::new(vec![]));
        let ok = r#"{"game":{"id":"g","placeId":7,"name":"A"},"server":{"host":"10.0.0.5","port":2005},"player":{"id":"u","numericId":3,"username":"b"},"ticket":{"expiresAt":"x"}}"#;
        handle_launch(&[URL.into()], &config(), |_| parse_resolved(ok, None), &rec).unwrap();
        assert_eq!(rec.0.borrow().len(), 1);
    }

    #[test]
    fn malformed_api_response_fails_closed() {
        let rec = Recorder(RefCell::new(vec![]));
        let err = handle_launch(&[URL.into()], &config(), |_| parse_resolved("{\"server\":{}}", None), &rec);
        assert!(matches!(err, Err(LaunchError::Resolve(_))));
        assert!(rec.0.borrow().is_empty(), "nothing may be spawned");
    }

    #[test]
    fn rejected_ticket_spawns_nothing() {
        let rec = Recorder(RefCell::new(vec![]));
        let err = handle_launch(&[URL.into()], &config(), |_| Err(ResolveError::TicketRejected), &rec);
        assert!(matches!(err, Err(LaunchError::Resolve(ResolveError::TicketRejected))));
        assert!(rec.0.borrow().is_empty());
    }

    #[test]
    fn extra_argv_entries_are_rejected_before_any_network_call() {
        let rec = Recorder(RefCell::new(vec![]));
        let mut called = false;
        let err = handle_launch(&[URL.into(), "--evil".into()], &config(), |_| { called = true; Err(ResolveError::TicketRejected) }, &rec);
        assert!(matches!(err, Err(LaunchError::Usage)));
        assert!(!called);
        assert!(matches!(handle_launch(&[], &config(), |_| Err(ResolveError::TicketRejected), &rec), Err(LaunchError::Usage)));
        let bad = handle_launch(&["ourrevival://join?ticket=x&host=y".into()], &config(), |_| Err(ResolveError::TicketRejected), &rec);
        assert!(matches!(bad, Err(LaunchError::BadUrl(_))));
        assert!(rec.0.borrow().is_empty());
    }
}
