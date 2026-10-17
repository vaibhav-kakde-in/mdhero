use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Runtime,
};

pub fn create_menu<R: Runtime>(app: &AppHandle<R>, locale: &str) -> Result<Menu<R>, tauri::Error> {
    let ru = locale == "ru";
    let about = if ru { "О MDHero" } else { "About MDHero" };
    let check_updates = if ru { "Проверить обновления…" } else { "Check for Updates…" };
    let quit = if ru { "Выйти из MDHero" } else { "Quit MDHero" };
    let file_menu_label = if ru { "Файл" } else { "File" };
    let open_item = if ru { "Открыть…" } else { "Open..." };
    let paste_item = if ru { "Вставка Markdown…" } else { "Paste Markdown..." };
    let print_item = if ru { "Печать…" } else { "Print..." };
    let close_tab_item = if ru { "Закрыть вкладку" } else { "Close Tab" };
    let edit_menu_label = if ru { "Правка" } else { "Edit" };
    let find_item = if ru { "Найти…" } else { "Find..." };
    let view_menu_label = if ru { "Вид" } else { "View" };
    let toggle_theme_item = if ru { "Переключить тему" } else { "Toggle Theme" };
    let window_menu_label = if ru { "Окно" } else { "Window" };
    // macOS app menu (app name menu with Quit, Hide, etc.)
    let app_menu = Submenu::with_items(
        app,
        "MDHero",
        true,
        &[
            &MenuItem::with_id(app, "about", about, true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "check_updates",
                check_updates,
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            // Custom Quit (not PredefinedMenuItem::quit) so Cmd+Q / menu Quit
            // fire a "quit" menu event instead of terminating outright — the
            // frontend guards it for unsaved changes (#54).
            &MenuItem::with_id(app, "quit", quit, true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        file_menu_label,
        true,
        &[
            &MenuItem::with_id(app, "open", open_item, true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(
                app,
                "paste_md",
                paste_item,
                true,
                Some("CmdOrCtrl+Shift+V"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            // Native print dialog for the rendered document (#89). Windows had
            // no way in but WebView2's own Ctrl+P, which nothing advertised.
            &MenuItem::with_id(app, "print", print_item, true, Some("CmdOrCtrl+P"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "close", close_tab_item, true, Some("CmdOrCtrl+W"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        edit_menu_label,
        true,
        &[
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "find", find_item, true, Some("CmdOrCtrl+F"))?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        view_menu_label,
        true,
        &[
            &MenuItem::with_id(
                app,
                "theme",
                toggle_theme_item,
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
    //
    // Not built on Linux. Its two entries, `minimize` and `maximize`, are
    // documented by muda as "Linux: Unsupported" — GTK creates nothing for
    // them, so the menu opened as an empty panel (#62, Ubuntu screenshot).
    // Windows implements both, so it keeps the submenu.
    #[cfg(not(target_os = "linux"))]
    let window_menu = Submenu::with_id_and_items(
        app,
        tauri::menu::WINDOW_SUBMENU_ID,
        window_menu_label,
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    #[cfg(not(target_os = "linux"))]
    let items: [&dyn IsMenuItem<R>; 5] = [&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu];
    #[cfg(target_os = "linux")]
    let items: [&dyn IsMenuItem<R>; 4] = [&app_menu, &file_menu, &edit_menu, &view_menu];

    let menu = Menu::with_items(app, &items)?;

    Ok(menu)
}
