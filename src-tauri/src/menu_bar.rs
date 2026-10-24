//! "Hide Menu Bar" / "Show Menu Bar" at the end of WebView2's own right-click
//! menu, the one the toolbar and the other parts of the page without a menu of
//! their own already show, rather than a menu of ours in its place.
//!
//! Windows only: macOS keeps its menu in the system menu bar, and on Linux GTK
//! stops firing a menu item's shortcut once its bar is hidden. On Windows,
//! Tauri runs the shortcuts through an accelerator table that doesn't depend
//! on the bar being shown.
//!
//! The choice is saved in a file rather than localStorage so that `setup` can
//! hide the bar before the window is first drawn.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{menu::Menu, webview::PlatformWebview, AppHandle, Manager, WebviewWindow, Wry};
use webview2_com::{
    ContextMenuRequestedEventHandler, CustomItemSelectedEventHandler,
    Microsoft::Web::WebView2::Win32::*,
};
use windows::core::{Interface, BOOL, HSTRING};

use crate::menu::MenuLabels;

const PREFS_FILE: &str = "menu-bar.json";

/// The labels the frontend last sent for the native menu, which is where the
/// item's two labels come from. Empty until it sends them (it does so at launch
/// when the language is not English, and whenever the language changes), so the
/// item starts in English.
static LABELS: Mutex<Option<MenuLabels>> = Mutex::new(None);

#[derive(Serialize, Deserialize)]
struct MenuBarPrefs {
    hidden: bool,
}

fn prefs_path(window: &WebviewWindow) -> Option<PathBuf> {
    window
        .path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(PREFS_FILE))
}

fn parse_hidden(json: &str) -> bool {
    serde_json::from_str::<MenuBarPrefs>(json)
        .map(|prefs| prefs.hidden)
        .unwrap_or(false)
}

fn save_hidden(window: &WebviewWindow, hidden: bool) -> Result<(), String> {
    let path = prefs_path(window)
        .ok_or_else(|| "Could not determine the config directory".to_string())?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let json = serde_json::to_string(&MenuBarPrefs { hidden }).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save setting: {}", e))
}

/// Called from `setup`, once the menu is set and before the window is first
/// drawn: hides the menu bar if it was hidden when the app last ran, and adds
/// the item to the webview's right-click menu.
pub fn setup(window: &WebviewWindow) {
    let hidden = prefs_path(window)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|json| parse_hidden(&json))
        .unwrap_or(false);
    if hidden {
        let _ = window.hide_menu();
    }

    let target = window.clone();
    let _ = window.with_webview(move |webview| {
        // SAFETY: `with_webview` runs this on the UI thread, where WebView2's
        // COM objects live.
        if let Err(e) = unsafe { add_context_menu_item(&webview, target) } {
            eprintln!("Menu bar item not added to the context menu: {:?}", e);
        }
    });
}

/// The item's label: "Hide Menu Bar" while the bar is shown, "Show Menu Bar"
/// while it is hidden, in the interface language.
fn item_label(bar_shown: bool) -> String {
    let (key, english) = if bar_shown {
        ("menu.hideMenuBar", "Hide Menu Bar")
    } else {
        ("menu.showMenuBar", "Show Menu Bar")
    };
    LABELS
        .lock()
        .ok()
        .and_then(|labels| labels.as_ref().and_then(|l| l.get(key).cloned()))
        .unwrap_or_else(|| english.to_string())
}

/// Replaces the app menu, as `set_menu_language` does when the language
/// changes, and keeps `labels` for the item. Setting a menu attaches it to
/// every window again, which brings back a menu bar the user hid, so the
/// windows that had it hidden hide it again afterwards.
pub fn set_menu(app: &AppHandle, menu: Menu<Wry>, labels: &MenuLabels) -> tauri::Result<()> {
    let hidden: Vec<_> = app
        .webview_windows()
        .into_values()
        .filter(|window| matches!(window.is_menu_visible(), Ok(false)))
        .collect();
    app.set_menu(menu)?;
    for window in hidden {
        let _ = window.hide_menu();
    }
    if let Ok(mut current) = LABELS.lock() {
        *current = Some(labels.clone());
    }
    Ok(())
}

/// Hides the menu bar if it is shown, shows it if not, and remembers which.
fn toggle(window: &WebviewWindow) {
    let hide = window.is_menu_visible().unwrap_or(false);
    let result = if hide {
        window.hide_menu()
    } else {
        window.show_menu()
    };
    if result.is_ok() {
        let _ = save_hidden(window, hide);
    }
}

/// Appends a separator and the item to WebView2's menu each time it opens.
/// Only on the page itself: a text field, selected text, an image or a video
/// get their menu as it is.
unsafe fn add_context_menu_item(
    webview: &PlatformWebview,
    window: WebviewWindow,
) -> windows::core::Result<()> {
    let core = webview
        .controller()
        .CoreWebView2()?
        .cast::<ICoreWebView2_11>()?;
    let environment = webview.environment().cast::<ICoreWebView2Environment9>()?;

    let handler = ContextMenuRequestedEventHandler::create(Box::new(move |_, args| unsafe {
        let Some(args) = args else { return Ok(()) };

        let target = args.ContextMenuTarget()?;
        let mut kind = COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND::default();
        target.Kind(&mut kind)?;
        let mut editable = BOOL::default();
        target.IsEditable(&mut editable)?;
        if kind != COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND_PAGE || editable.as_bool() {
            return Ok(());
        }

        let label = item_label(window.is_menu_visible().unwrap_or(false));
        let separator = environment.CreateContextMenuItem(
            &HSTRING::new(),
            None,
            COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR,
        )?;
        let item = environment.CreateContextMenuItem(
            &HSTRING::from(label.as_str()),
            None,
            COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND,
        )?;
        let selected = window.clone();
        let mut token = 0;
        item.add_CustomItemSelected(
            &CustomItemSelectedEventHandler::create(Box::new(move |_, _| {
                toggle(&selected);
                Ok(())
            })),
            &mut token,
        )?;

        let items = args.MenuItems()?;
        let mut count = 0;
        items.Count(&mut count)?;
        items.InsertValueAtIndex(count, &separator)?;
        items.InsertValueAtIndex(count + 1, &item)?;
        Ok(())
    }));

    let mut token = 0;
    core.add_ContextMenuRequested(&handler, &mut token)
}
