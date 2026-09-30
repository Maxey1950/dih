//! Calls POST {apiBaseUrl}/api/launcher/ticket/resolve with the ticket as the
//! only credential, and validates the response strictly (fail closed).

use crate::protocol::Ticket;
use serde::Deserialize;
use std::io::Read;
use std::time::Duration;

const MAX_RESPONSE_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ResolvedGame {
    pub id: String,
    pub place_id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ResolvedServer {
    pub host: String,
    pub port: u32,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ResolvedPlayer {
    pub id: String,
    pub numeric_id: u64,
    pub username: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ResolvedTicketInfo {
    pub expires_at: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Resolved {
    pub game: ResolvedGame,
    pub server: ResolvedServer,
    pub player: ResolvedPlayer,
    pub ticket: ResolvedTicketInfo,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ResolveError {
    /// The API said the ticket is invalid/expired/used (HTTP 404).
    TicketRejected,
    RateLimited,
    Http(u16),
    Network(String),
    BadResponse(String),
}

impl std::fmt::Display for ResolveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResolveError::TicketRejected => write!(f, "this Play link has expired or was already used; press Play again"),
            ResolveError::RateLimited => write!(f, "too many attempts; wait a moment and press Play again"),
            ResolveError::Http(c) => write!(f, "the server returned HTTP {c}"),
            ResolveError::Network(m) => write!(f, "could not reach the server: {m}"),
            ResolveError::BadResponse(m) => write!(f, "unexpected server response: {m}"),
        }
    }
}

/// Hostname, IPv4 or bare IPv6. Never starts with '-' (would look like a flag
/// to RFD), no spaces, quotes or shell metacharacters.
pub fn is_valid_host(host: &str) -> bool {
    if host.is_empty() || host.len() > 253 || host.starts_with('-') {
        return false;
    }
    let ipv6 = host.contains(':') && host.bytes().all(|b| b.is_ascii_hexdigit() || b == b':' || b == b'.');
    let hostname = host.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
    });
    ipv6 || hostname
}

/// Parse and validate a response body. Fails closed on anything unexpected.
pub fn parse_resolved(body: &str, allowed_hosts: Option<&[String]>) -> Result<Resolved, ResolveError> {
    let r: Resolved = serde_json::from_str(body).map_err(|e| ResolveError::BadResponse(e.to_string()))?;
    if !is_valid_host(&r.server.host) {
        return Err(ResolveError::BadResponse("invalid server host".into()));
    }
    if !(1..=65535).contains(&r.server.port) {
        return Err(ResolveError::BadResponse("invalid server port".into()));
    }
    if let Some(allowed) = allowed_hosts {
        if !allowed.iter().any(|h| h.eq_ignore_ascii_case(&r.server.host)) {
            return Err(ResolveError::BadResponse("server host is not in allowedServerHosts".into()));
        }
    }
    if r.game.place_id == 0 || r.player.numeric_id == 0 {
        return Err(ResolveError::BadResponse("invalid ids".into()));
    }
    Ok(r)
}

/// TLS: ureq's rustls backend with the bundled webpki root store. Certificate
/// and hostname validation are always on; there is deliberately no option to
/// disable them. Plain http is only reachable when the config explicitly
/// allows a localhost development origin (see config::validate_api_origin).
pub fn resolve(api_base: &str, ticket: &Ticket, allowed_hosts: Option<&[String]>, timeout_seconds: u64) -> Result<Resolved, ResolveError> {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(timeout_seconds))
        .redirects(0)
        .user_agent(concat!("ourrevival-launcher/", env!("CARGO_PKG_VERSION")))
        .build();
    let url = format!("{api_base}/api/launcher/ticket/resolve");
    let response = agent
        .post(&url)
        .set("Accept", "application/json")
        .set("Content-Type", "application/json")
        .send_string(&serde_json::json!({ "ticket": ticket.as_str() }).to_string());
    let response = match response {
        Ok(r) => r,
        Err(ureq::Error::Status(404, _)) => return Err(ResolveError::TicketRejected),
        Err(ureq::Error::Status(429, _)) => return Err(ResolveError::RateLimited),
        Err(ureq::Error::Status(code, _)) => return Err(ResolveError::Http(code)),
        Err(e) => return Err(ResolveError::Network(e.kind().to_string())),
    };
    let mut body = String::new();
    response
        .into_reader()
        .take(MAX_RESPONSE_BYTES)
        .read_to_string(&mut body)
        .map_err(|e| ResolveError::BadResponse(e.to_string()))?;
    parse_resolved(&body, allowed_hosts)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(host: &str, port: u32) -> String {
        format!(
            r#"{{"game":{{"id":"g","placeId":7,"name":"Arena"}},"server":{{"host":"{host}","port":{port}}},"player":{{"id":"u","numericId":3,"username":"bob"}},"ticket":{{"expiresAt":"2026-01-01T00:00:00.000Z"}}}}"#
        )
    }

    #[test]
    fn parses_valid_response() {
        let r = parse_resolved(&body("10.0.0.5", 2005), None).unwrap();
        assert_eq!(r.server, ResolvedServer { host: "10.0.0.5".into(), port: 2005 });
        assert_eq!(r.player.numeric_id, 3);
        assert!(parse_resolved(&body("games-1.internal.example", 53640), None).is_ok());
        assert!(parse_resolved(&body("fd00::1", 2005), None).is_ok());
    }

    #[test]
    fn rejects_hosts_that_could_inject_arguments() {
        for host in ["-rp 1", "--config=x", "a b", "evil.example\\\" --x", "host;calc", "", "a..b", "-evil.example", "x.example -u other"] {
            assert!(parse_resolved(&body(host, 2005), None).is_err(), "{host}");
        }
    }

    #[test]
    fn rejects_bad_ports_and_malformed_bodies() {
        assert!(parse_resolved(&body("10.0.0.5", 0), None).is_err());
        assert!(parse_resolved(&body("10.0.0.5", 70000), None).is_err());
        for bad in ["", "null", "{}", "[]", r#"{"game":1}"#, "not json", r#"{"error":{"code":"TICKET_INVALID"}}"#] {
            assert!(parse_resolved(bad, None).is_err(), "{bad}");
        }
        let extra = body("10.0.0.5", 2005).replacen('{', r#"{"command":"calc.exe","#, 1);
        assert!(parse_resolved(&extra, None).is_err(), "unknown fields fail closed");
        let string_port = body("10.0.0.5", 2005).replace("\"port\":2005", "\"port\":\"2005\"");
        assert!(parse_resolved(&string_port, None).is_err());
    }

    #[test]
    fn enforces_allow_list_when_configured() {
        let allowed = vec!["games.example.com".to_string()];
        assert!(parse_resolved(&body("games.example.com", 2005), Some(&allowed)).is_ok());
        assert!(parse_resolved(&body("attacker.example", 2005), Some(&allowed)).is_err());
    }
}
