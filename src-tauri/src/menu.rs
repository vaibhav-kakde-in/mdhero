use std::collections::HashMap;
use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Runtime,
};

/// Localized display labels for the native menu, keyed by the frontend's
/// `menu.*` message keys. Missing keys fall back to the English defaults.
pub type MenuLabels = HashMap<String, String>;

fn tr(labels: &MenuLabels, key: &str, fallback: &str) -> String {
    labels
        .get(key)
        .map(String::as_str)
        .unwrap_or(fallback)
        .to_string()
}

/// Label for a predefined item (Cut/Copy/Paste/…). Without a translation the
/// item keeps muda's built-in text, exactly as before localization existed.
fn predefined_label<'a>(labels: &'a MenuLabels, key: &str) -> Option<&'a str> {
    labels.get(key).map(String::as_str)
}

pub fn create_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    create_menu_with_labels(app, &MenuLabels::new())
}

/// Builds the full app menu. When `labels` (from the frontend's active locale)
/// is non-empty the menu is rebuilt with those labels, which is how the native
/// menubar switches language.
pub fn create_menu_with_labels<R: Runtime>(
    app: &AppHandle<R>,
    labels: &MenuLabels,
) -> Result<Menu<R>, tauri::Error> {
    // macOS app menu (app name menu with Quit, Hide, etc.)
    let app_menu = Submenu::with_items(
        app,
        "MDHero",
        true,
        &[
            &MenuItem::with_id(
                app,
                "about",
                tr(labels, "menu.about", "About MDHero"),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                "check_updates",
                tr(labels, "menu.checkUpdates", "Check for Updates…"),
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, predefined_label(labels, "menu.hide"))?,
            &PredefinedMenuItem::hide_others(app, predefined_label(labels, "menu.hideOthers"))?,
            &PredefinedMenuItem::show_all(app, predefined_label(labels, "menu.showAll"))?,
            &PredefinedMenuItem::separator(app)?,
            // Custom Quit (not PredefinedMenuItem::quit) so Cmd+Q / menu Quit
            // fire a "quit" menu event instead of terminating outright — the
            // frontend guards it for unsaved changes (#54).
            &MenuItem::with_id(
                app,
                "quit",
                tr(labels, "menu.quit", "Quit MDHero"),
                true,
                Some("CmdOrCtrl+Q"),
            )?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        tr(labels, "menu.file", "File"),
        true,
        &[
            &MenuItem::with_id(
                app,
                "open",
                tr(labels, "menu.open", "Open..."),
                true,
                Some("CmdOrCtrl+O"),
            )?,
            &MenuItem::with_id(
                app,
                "paste_md",
                tr(labels, "menu.pasteMarkdown", "Paste Markdown..."),
                true,
                Some("CmdOrCtrl+Shift+V"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            // Native print dialog for the rendered document (#89). Windows had
            // no way in but WebView2's own Ctrl+P, which nothing advertised.
            &MenuItem::with_id(
                app,
                "print",
                tr(labels, "menu.print", "Print..."),
                true,
                Some("CmdOrCtrl+P"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "close",
                tr(labels, "menu.closeTab", "Close Tab"),
                true,
                Some("CmdOrCtrl+W"),
            )?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        tr(labels, "menu.edit", "Edit"),
        true,
        &[
            &PredefinedMenuItem::cut(app, predefined_label(labels, "menu.cut"))?,
            &PredefinedMenuItem::copy(app, predefined_label(labels, "menu.copy"))?,
            &PredefinedMenuItem::paste(app, predefined_label(labels, "menu.paste"))?,
            &PredefinedMenuItem::select_all(
                app,
                predefined_label(labels, "menu.selectAll"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "find",
                tr(labels, "menu.find", "Find..."),
                true,
                Some("CmdOrCtrl+F"),
            )?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        tr(labels, "menu.view", "View"),
        true,
        &[
            &MenuItem::with_id(
                app,
                "theme",
                tr(labels, "menu.toggleTheme", "Toggle Theme"),
                true,
                Some("CmdOrCtrl+Shift+T"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(
                app,
                predefined_label(labels, "menu.fullscreen"),
            )?,
        ],
    )?;

    // Standard macOS "Window" menu. The submenu MUST use Tauri's
    // `WINDOW_SUBMENU_ID` so that `AppHandle::set_menu` registers it as the
    // NSApp windows menu (`set_as_windows_menu_for_nsapp`). That registration
    // is what makes macOS inject the standard window commands — including the
    // Sequoia "Move & Resize" window-tiling shortcuts (fn+Control+arrows) — and
    // the live window list. Without a submenu carrying this id the tiling
    // shortcuts (and Cmd+M minimize) never exist for the app.
    //
    // `close_window` is intentionally omitted: its default accelerator is
    // Cmd+W, which the app already binds in the File menu to "Close Tab".
    //
    // Not built on Linux. Its two entries, `minimize` and `maximize`, are
    // documented by muda as "Linux: Unsupported" — GTK creates nothing for
    // them, so the menu opened as an empty panel (#62, Ubuntu screenshot).
    // Windows implements both, so it keeps the submenu.
    #[cfg(not(target_os = "linux"))]
    let window_menu = Submenu::with_id_and_items(
        app,
        tauri::menu::WINDOW_SUBMENU_ID,
        tr(labels, "menu.window", "Window"),
        true,
        &[
            &PredefinedMenuItem::minimize(
                app,
                predefined_label(labels, "menu.minimize"),
            )?,
            &PredefinedMenuItem::maximize(
                app,
                predefined_label(labels, "menu.maximize"),
            )?,
        ],
    )?;

    #[cfg(not(target_os = "linux"))]
    let items: [&dyn IsMenuItem<R>; 5] = [&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu];
    #[cfg(target_os = "linux")]
    let items: [&dyn IsMenuItem<R>; 4] = [&app_menu, &file_menu, &edit_menu, &view_menu];

    let menu = Menu::with_items(app, &items)?;

    Ok(menu)
}

/// Relabels the native menubar for the given locale. Called by the frontend
/// whenever the user changes the interface language.
#[tauri::command]
pub fn set_menu_language(app: tauri::AppHandle, labels: MenuLabels) -> Result<(), String> {
    let menu = create_menu_with_labels(&app, &labels).map_err(|e| e.to_string())?;
    app.set_menu(menu).map(|_| ()).map_err(|e| e.to_string())
}
