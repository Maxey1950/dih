//! Strict parser for launch URLs. The ONLY accepted form is:
//!
//! ```text
//! ourrevival://join?ticket=rvjt_<43 base64url chars>
//! ```
//!
//! Everything else is rejected: other schemes or actions, extra path segments,
//! extra/duplicate parameters, fragments, percent-encoding, whitespace,
//! quotes, oversized input. The parsed ticket is the only value that leaves
//! this module, and it can only contain [A-Za-z0-9_-] after the prefix.

pub const SCHEME: &str = "ourrevival";
const PREFIX: &str = "join?ticket=";
const TICKET_PREFIX: &str = "rvjt_";
const TICKET_BODY_LEN: usize = 43;
/// Longest valid URL is 13 + 12 + 48 = 73 bytes; anything much longer is hostile.
pub const MAX_URL_LEN: usize = 128;

#[derive(Debug, PartialEq, Eq)]
pub enum ParseError {
    TooLong,
    NotAscii,
    WrongScheme,
    WrongActionOrParameters,
    MalformedTicket,
}

/// A validated join ticket. Construct only through `parse_launch_url`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ticket(String);

impl Ticket {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub fn is_valid_ticket(t: &str) -> bool {
    t.len() == TICKET_PREFIX.len() + TICKET_BODY_LEN
        && t.starts_with(TICKET_PREFIX)
        && t[TICKET_PREFIX.len()..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

pub fn parse_launch_url(input: &str) -> Result<Ticket, ParseError> {
    if input.len() > MAX_URL_LEN {
        return Err(ParseError::TooLong);
    }
    if !input.is_ascii() {
        return Err(ParseError::NotAscii);
    }
    // Scheme is case-insensitive per RFC 3986; everything after it is exact.
    let rest = match input.split_once("://") {
        Some((scheme, rest)) if scheme.eq_ignore_ascii_case(SCHEME) => rest,
        _ => return Err(ParseError::WrongScheme),
    };
    let ticket = rest.strip_prefix(PREFIX).ok_or(ParseError::WrongActionOrParameters)?;
    if ticket.contains(['&', '?', '#', '=', '/']) {
        return Err(ParseError::WrongActionOrParameters);
    }
    if !is_valid_ticket(ticket) {
        return Err(ParseError::MalformedTicket);
    }
    Ok(Ticket(ticket.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const T: &str = "rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";

    fn url(s: &str) -> String {
        format!("ourrevival://join?ticket={s}")
    }

    #[test]
    fn fixture_is_valid_length() {
        assert!(is_valid_ticket(&T[..48]));
    }

    #[test]
    fn accepts_exact_form() {
        let t = &T[..48];
        assert_eq!(parse_launch_url(&url(t)).unwrap().as_str(), t);
        assert!(parse_launch_url(&format!("OurRevival://join?ticket={t}")).is_ok(), "scheme is case-insensitive");
    }

    #[test]
    fn rejects_wrong_scheme() {
        let t = &T[..48];
        for u in [
            format!("http://join?ticket={t}"),
            format!("ourrevivalx://join?ticket={t}"),
            format!("roblox-player://join?ticket={t}"),
            format!("ourrevival:join?ticket={t}"),
            format!("join?ticket={t}"),
            String::new(),
        ] {
            assert_eq!(parse_launch_url(&u), Err(ParseError::WrongScheme), "{u}");
        }
    }

    #[test]
    fn rejects_wrong_action() {
        let t = &T[..48];
        for u in [
            format!("ourrevival://play?ticket={t}"),
            format!("ourrevival://JOIN?ticket={t}"),
            format!("ourrevival://join/?ticket={t}"),
            format!("ourrevival://join?Ticket={t}"),
            format!("ourrevival://join/../../cmd.exe?ticket={t}"),
            "ourrevival://join".to_string(),
            "ourrevival://join?".to_string(),
        ] {
            assert_eq!(parse_launch_url(&u), Err(ParseError::WrongActionOrParameters), "{u}");
        }
    }

    #[test]
    fn rejects_missing_duplicate_or_extra_parameters() {
        let t = &T[..48];
        assert_eq!(parse_launch_url("ourrevival://join?ticket="), Err(ParseError::MalformedTicket));
        for u in [
            format!("ourrevival://join?ticket={t}&ticket={t}"),
            format!("ourrevival://join?ticket={t}&host=evil.example"),
            format!("ourrevival://join?ticket={t}#frag"),
            format!("ourrevival://join?ticket={t}?x"),
            format!("ourrevival://join?ticket={t}=x"),
        ] {
            // Duplicates also exceed MAX_URL_LEN; either way they must be rejected.
            assert!(parse_launch_url(&u).is_err(), "{u}");
        }
    }

    #[test]
    fn rejects_shell_metacharacters_and_arguments() {
        let t = &T[..48];
        for u in [
            format!("ourrevival://join?ticket={t} --run calc.exe"),
            format!("ourrevival://join?ticket={t}\" --evil"),
            format!("ourrevival://join?ticket={t};calc"),
            format!("ourrevival://join?ticket={t}|calc"),
            format!("ourrevival://join?ticket={}\"", &t[..47]),
            "ourrevival://join?ticket=-h 1.2.3.4".to_string(),
        ] {
            assert!(parse_launch_url(&u).is_err(), "{u}");
        }
    }

    #[test]
    fn rejects_malformed_tickets_and_encoding() {
        let t = &T[..48];
        for bad in [
            &t[..47],                                   // too short
            "rvgs_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_A", // server-credential prefix
            "rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789%2FA", // percent-encoding
            "rvjt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/AB", // base64 (not url-safe)
        ] {
            assert!(parse_launch_url(&url(bad)).is_err(), "{bad}");
        }
        assert_eq!(parse_launch_url(&url(&format!("{t}A"))), Err(ParseError::MalformedTicket));
    }

    #[test]
    fn rejects_oversized_and_non_ascii() {
        assert_eq!(parse_launch_url(&url(&"A".repeat(200))), Err(ParseError::TooLong));
        assert_eq!(parse_launch_url(&url("rvjt_ÄbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_A")), Err(ParseError::NotAscii));
    }
}
