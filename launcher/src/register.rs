//! Registers `ourrevival://` for the current user.
//!
//! Windows: HKCU\Software\Classes\ourrevival -> "<launcher.exe>" "%1"
//! (per-user; no admin rights). Linux: writes a .desktop handler file; the
//! user then runs `xdg-mime default ourrevival-launcher.desktop x-scheme-handler/ourrevival`.
//! Nothing here runs a shell or other programs.

use std::path::Path;

#[cfg(windows)]
pub fn register(exe: &Path) -> std::io::Result<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(r"Software\Classes\ourrevival")?;
    key.set_value("", &"URL:OurRevival Protocol")?;
    key.set_value("URL Protocol", &"")?;
    let (cmd, _) = key.create_subkey(r"shell\open\command")?;
    cmd.set_value("", &format!("\"{}\" \"%1\"", exe.display()))?;
    Ok(r"registered HKCU\Software\Classes\ourrevival".to_string())
}

#[cfg(windows)]
pub fn unregister() -> std::io::Result<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(r"Software\Classes\ourrevival")?;
    Ok("unregistered".to_string())
}

#[cfg(not(windows))]
pub fn desktop_entry(exe: &Path) -> String {
    format!(
        "[Desktop Entry]\nType=Application\nName=OurRevival Launcher\nExec=\"{}\" %u\nNoDisplay=true\nMimeType=x-scheme-handler/ourrevival;\n",
        exe.display()
    )
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
    let path = desktop_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(&path, desktop_entry(exe))?;
    Ok(format!(
        "wrote {}; now run: xdg-mime default ourrevival-launcher.desktop x-scheme-handler/ourrevival",
        path.display()
    ))
}

#[cfg(not(windows))]
pub fn unregister() -> std::io::Result<String> {
    let path = desktop_path();
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    Ok(format!("removed {}", path.display()))
}
