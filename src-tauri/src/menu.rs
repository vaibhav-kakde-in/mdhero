use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu, WINDOW_SUBMENU_ID},
    AppHandle, Runtime,
};

pub fn create_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    // macOS app menu (app name menu with Quit, Hide, etc.)
    let app_menu = Submenu::with_items(
        app,
        "MDHero",
        true,
        &[
            &MenuItem::with_id(app, "about", "About MDHero", true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "check_updates",
                "Check for Updates…",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(
                app,
                "paste_md",
                "Paste Markdown...",
                true,
                Some("CmdOrCtrl+Shift+V"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "close", "Close Tab", true, Some("CmdOrCtrl+W"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "find", "Find...", true, Some("CmdOrCtrl+F"))?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(
                app,
                "theme",
                "Toggle Theme",
                true,
                Some("CmdOrCtrl+Shift+T"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
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
    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
    )?;

    Ok(menu)
}
