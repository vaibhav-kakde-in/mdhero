mod commands;
mod menu;
mod watcher;

use std::sync::Mutex;
use tauri::Manager;

/// Stores file paths received from OS "Open With" events.
/// These arrive before the webview is ready, so we buffer them.
pub struct OpenedFiles {
    pub paths: Mutex<Vec<String>>,
}

impl Default for OpenedFiles {
    fn default() -> Self {
        Self {
            paths: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
fn get_opened_files(state: tauri::State<'_, OpenedFiles>) -> Vec<String> {
    let mut paths = state.paths.lock().unwrap();
    let result = paths.clone();
    paths.clear();
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        .manage(watcher::WatcherState::default())
        .manage(OpenedFiles::default())
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown_file,
            commands::write_markdown_file,
            commands::list_claude_plans,
            commands::list_folder_md_files,
            commands::quit_app,
            watcher::start_watching,
            watcher::stop_watching,
            get_opened_files,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let menu = menu::create_menu(&handle)?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if let Some(window) = app_handle.get_webview_window("main") {
                    match event.id().as_ref() {
                        "open" => { let _ = window.eval("window.__mdhero_open_file?.()"); }
                        "paste_md" => { let _ = window.eval("window.__mdhero_paste?.()"); }
                        "theme" => { let _ = window.eval("window.__mdhero_toggle_theme?.()"); }
                        "find" => { let _ = window.eval("window.__mdhero_find?.()"); }
                        "check_updates" => { let _ = window.eval("window.__mdhero_check_updates?.()"); }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let app_handle = _app_handle;
                let mut file_paths: Vec<String> = Vec::new();

                for url in urls {
                    let path = if url.scheme() == "file" {
                        url.to_file_path().ok().map(|p| p.to_string_lossy().to_string())
                    } else {
                        Some(url.to_string())
                    };

                    if let Some(p) = path {
                        file_paths.push(p);
                    }
                }

                if file_paths.is_empty() {
                    return;
                }

                // Try to send directly to frontend if webview is ready
                if let Some(window) = app_handle.get_webview_window("main") {
                    for file_path in &file_paths {
                        let js = format!(
                            "window.__mdhero_open_path?.({})",
                            serde_json::json!(file_path)
                        );
                        let _ = window.eval(&js);
                    }
                }

                // Also buffer in state in case webview isn't ready yet
                if let Some(state) = app_handle.try_state::<OpenedFiles>() {
                    if let Ok(mut paths) = state.paths.lock() {
                        paths.extend(file_paths);
                    }
                }
            }
        });
}
