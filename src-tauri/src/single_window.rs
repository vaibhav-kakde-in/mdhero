//! Opt-in "open files in the existing window" mode (#71).
//!
//! Whether a launch joins the running window has to be decided by the new
//! process before it builds its own window — long before its webview, and the
//! settings kept in localStorage, exist. So this one preference lives in a file
//! Rust reads at startup.
//!
//! Off by default: a launch opening its own window stays the behaviour, as the
//! discussion on #71 asked. On macOS the setting does not apply, since the OS
//! already routes a file opened while MDHero runs to the running app
//! (`RunEvent::Opened`).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const PREFS_FILE: &str = "window-mode.json";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowMode {
    open_in_existing_window: bool,
}

/// Tauri's `app_config_dir()` is `config_dir()/<identifier>` on desktop. It is
/// rebuilt here because the preference is read before the app, and its path
/// resolver, exist.
fn prefs_path(identifier: &str) -> Option<PathBuf> {
    dirs::config_dir().map(|dir| dir.join(identifier).join(PREFS_FILE))
}

fn parse_enabled(json: &str) -> bool {
    serde_json::from_str::<WindowMode>(json)
        .map(|mode| mode.open_in_existing_window)
        .unwrap_or(false)
}

pub fn is_enabled(identifier: &str) -> bool {
    prefs_path(identifier)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|json| parse_enabled(&json))
        .unwrap_or(false)
}

/// Whether the single-instance plugin can be registered on this machine.
///
/// On Linux the plugin claims a D-Bus name and panics when no session bus
/// address can be resolved, which would stop MDHero from starting at all — with
/// the setting that caused it out of reach. zbus resolves the address from
/// these two places, so without either the mode is skipped instead.
#[cfg(target_os = "linux")]
pub fn can_register() -> bool {
    std::env::var_os("DBUS_SESSION_BUS_ADDRESS").is_some()
        || std::env::var_os("XDG_RUNTIME_DIR")
            .map(|dir| std::path::Path::new(&dir).join("bus").exists())
            .unwrap_or(false)
}

#[cfg(target_os = "windows")]
pub fn can_register() -> bool {
    true
}

/// The files named on a later launch's command line. `argv[0]` is the
/// executable, and a relative path is relative to the directory that launch
/// was started from — not to this process's.
#[cfg(any(target_os = "windows", target_os = "linux"))]
fn file_args(argv: &[String], cwd: &str) -> Vec<String> {
    argv.iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| {
            let path = std::path::Path::new(arg);
            if path.is_absolute() {
                arg.clone()
            } else {
                std::path::Path::new(cwd)
                    .join(path)
                    .to_string_lossy()
                    .into_owned()
            }
        })
        .collect()
}

/// Runs in the first instance when a later launch hands over its command line
/// and exits.
#[cfg(any(target_os = "windows", target_os = "linux"))]
pub fn on_second_instance(app: &AppHandle, argv: Vec<String>, cwd: String) {
    use tauri::Manager;

    crate::deliver_opened_files(app, file_args(&argv, &cwd));

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn get_open_in_existing_window(app: AppHandle) -> bool {
    is_enabled(&app.config().identifier)
}

#[tauri::command]
pub fn set_open_in_existing_window(app: AppHandle, enabled: bool) -> Result<(), String> {
    let path = prefs_path(&app.config().identifier)
        .ok_or_else(|| "Could not determine the config directory".to_string())?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let json = serde_json::to_string(&WindowMode {
        open_in_existing_window: enabled,
    })
    .map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save setting: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_back_what_the_command_writes() {
        for enabled in [true, false] {
            let json = serde_json::to_string(&WindowMode {
                open_in_existing_window: enabled,
            })
            .unwrap();
            assert_eq!(parse_enabled(&json), enabled);
        }
    }

    #[test]
    fn anything_unreadable_means_off() {
        assert!(!parse_enabled(""));
        assert!(!parse_enabled("not json"));
        assert!(!parse_enabled("{}"));
        assert!(!parse_enabled(r#"{"openInExistingWindow":"yes"}"#));
    }

    #[test]
    fn no_preference_file_means_off() {
        assert!(!is_enabled("com.mdhero.test.no-such-identifier"));
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn file_args_skips_the_executable_and_flags() {
        let cwd = std::env::temp_dir();
        let argv = vec![
            "mdhero".to_string(),
            "--verbose".to_string(),
            "notes.md".to_string(),
        ];
        assert_eq!(
            file_args(&argv, cwd.to_str().unwrap()),
            vec![cwd.join("notes.md").to_string_lossy().into_owned()]
        );
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn file_args_keeps_absolute_paths_as_given() {
        let absolute = std::env::temp_dir().join("doc.md");
        let absolute = absolute.to_string_lossy().into_owned();
        let argv = vec!["mdhero".to_string(), absolute.clone()];
        assert_eq!(file_args(&argv, "/somewhere/else"), vec![absolute]);
    }
}
