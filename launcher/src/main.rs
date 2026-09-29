//! ourrevival-launcher
//!
//! ```text
//! ourrevival-launcher "ourrevival://join?ticket=rvjt_..."   (invoked by the OS)
//! ourrevival-launcher --register | --unregister | --config-path
//! ```
//!
//! Never logs the ticket. Exits non-zero on any failure, without starting anything.

use ourrevival_launcher::{api, config, handle_launch, launch::SystemRunner, register};
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("--register") if args.len() == 1 => {
            let exe = match std::env::current_exe() {
                Ok(p) => p,
                Err(e) => return fail(&format!("cannot find launcher path: {e}")),
            };
            match register::register(&exe) {
                Ok(msg) => ok(&msg),
                Err(e) => fail(&format!("registration failed: {e}")),
            }
        }
        Some("--unregister") if args.len() == 1 => match register::unregister() {
            Ok(msg) => ok(&msg),
            Err(e) => fail(&format!("unregistration failed: {e}")),
        },
        Some("--config-path") if args.len() == 1 => ok(&config::default_config_path().display().to_string()),
        _ => {
            let path = config::default_config_path();
            let cfg = match config::load(&path) {
                Ok(c) => c,
                Err(e) => return fail(&e.to_string()),
            };
            let allowed = cfg.allowed_server_hosts.clone();
            let base = config::api_base(&cfg).to_string();
            match handle_launch(&args, &cfg, |t| api::resolve(&base, t, allowed.as_deref()), &SystemRunner) {
                Ok(()) => ok("started RFD"),
                Err(e) => fail(&e.to_string()),
            }
        }
    }
}

fn ok(msg: &str) -> ExitCode {
    eprintln!("ourrevival-launcher: {msg}");
    ExitCode::SUCCESS
}

fn fail(msg: &str) -> ExitCode {
    eprintln!("ourrevival-launcher: error: {msg}");
    ExitCode::FAILURE
}
