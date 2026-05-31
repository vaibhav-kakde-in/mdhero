use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub struct WatcherState {
    watcher: Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>>,
    watched_path: Mutex<Option<String>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn start_watching(app: AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    let mut path_lock = state.watched_path.lock().map_err(|e| e.to_string())?;

    // Stop existing watcher
    *watcher_lock = None;

    let watch_path = PathBuf::from(&path);
    let target_file = watch_path.clone();

    // Watch the parent directory to survive atomic saves (delete + rename)
    let watch_dir = watch_path
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?
        .to_path_buf();

    let app_handle = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            match res {
                Ok(events) => {
                    for event in events {
                        if event.kind == DebouncedEventKind::Any {
                            // Only emit if the changed file matches our target
                            if event.path == target_file {
                                let _ = app_handle.emit(
                                    "file-changed",
                                    serde_json::json!({
                                        "path": event.path.to_string_lossy()
                                    }),
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {:?}", e);
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    debouncer
        .watcher()
        .watch(&watch_dir, notify::RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    *watcher_lock = Some(debouncer);
    *path_lock = Some(path);

    Ok(())
}

#[tauri::command]
pub fn stop_watching(app: AppHandle) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    let mut path_lock = state.watched_path.lock().map_err(|e| e.to_string())?;
    *watcher_lock = None;
    *path_lock = None;
    Ok(())
}
