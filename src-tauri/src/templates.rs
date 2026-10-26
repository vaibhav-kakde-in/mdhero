//! User document templates: one folder per template under
//! `<app config dir>/templates/`, holding `template.json` and `template.css`.
//!
//! These commands only ever touch that directory, and only those two file
//! names inside a folder whose name passes `is_valid_id`, so they cannot be
//! turned into a general file read/write from the web view. The CSS is
//! returned raw; the frontend scopes and strips it before it reaches the page.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_mini::{new_debouncer, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

const TEMPLATE_JSON: &str = "template.json";
const TEMPLATE_CSS: &str = "template.css";
/// A stylesheet past this is not a document template; refusing it keeps a
/// stray file from being read into memory and pushed through IPC.
const MAX_FILE_BYTES: u64 = 1024 * 1024;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserTemplateFiles {
    id: String,
    json: Option<String>,
    css: String,
}

/// Folder names usable as ids: lowercase so `template: Memo` and `memo` agree
/// on every filesystem, and no separators or dots, so an id can't climb out
/// of the templates directory.
fn is_valid_id(id: &str) -> bool {
    let mut chars = id.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit())
        && id.len() <= 64
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

fn slugify(name: &str) -> String {
    let mut slug = String::new();
    for c in name.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
    }
    let slug: String = slug.trim_end_matches('-').chars().take(48).collect();
    let slug = slug.trim_end_matches('-').to_string();
    if slug.is_empty() {
        "template".to_string()
    } else {
        slug
    }
}

fn read_capped(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn list_in(dir: &Path) -> Vec<UserTemplateFiles> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found: Vec<UserTemplateFiles> = entries
        .flatten()
        .filter_map(|entry| {
            let id = entry.file_name().to_str()?.to_string();
            if !is_valid_id(&id) || !entry.path().is_dir() {
                return None;
            }
            let css = read_capped(&entry.path().join(TEMPLATE_CSS))?;
            let json = read_capped(&entry.path().join(TEMPLATE_JSON));
            Some(UserTemplateFiles { id, json, css })
        })
        .collect();
    found.sort_by(|a, b| a.id.cmp(&b.id));
    found
}

/// A free id derived from `base`: `memo`, then `memo-2`, `memo-3`, …
fn unique_id(dir: &Path, base: &str) -> String {
    let base = slugify(base);
    if !dir.join(&base).exists() {
        return base;
    }
    (2..)
        .map(|n| format!("{}-{}", base, n))
        .find(|id| !dir.join(id).exists())
        .expect("an unbounded range always yields a free id")
}

fn create_in(dir: &Path, base_id: &str, json: &str, css: &str) -> Result<String, String> {
    if json.len() as u64 > MAX_FILE_BYTES || css.len() as u64 > MAX_FILE_BYTES {
        return Err("Template files are limited to 1 MB each.".to_string());
    }
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create the templates folder: {}", e))?;
    let id = unique_id(dir, base_id);
    let folder = dir.join(&id);
    fs::create_dir(&folder).map_err(|e| format!("Failed to create template {}: {}", id, e))?;
    fs::write(folder.join(TEMPLATE_JSON), json).map_err(|e| format!("Failed to write {}: {}", TEMPLATE_JSON, e))?;
    fs::write(folder.join(TEMPLATE_CSS), css).map_err(|e| format!("Failed to write {}: {}", TEMPLATE_CSS, e))?;
    Ok(id)
}

fn import_css_in(dir: &Path, source: &Path) -> Result<String, String> {
    let is_css = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("css"))
        .unwrap_or(false);
    if !is_css {
        return Err("Only .css files can be imported as a template.".to_string());
    }
    let css = read_capped(source).ok_or_else(|| "The file could not be read, or is over 1 MB.".to_string())?;
    let name = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Imported")
        .to_string();
    let json = serde_json::to_string_pretty(&serde_json::json!({ "name": name }))
        .map_err(|e| e.to_string())?;
    create_in(dir, &name, &json, &css)
}

/// Removes the two template files and then the folder, never recursively: a
/// folder holding anything else (fonts, notes, a backup) is left for the user.
fn delete_in(dir: &Path, id: &str) -> Result<(), String> {
    if !is_valid_id(id) {
        return Err(format!("Not a template id: {}", id));
    }
    let folder = dir.join(id);
    if !folder.is_dir() {
        return Err(format!("Template not found: {}", id));
    }
    for name in [TEMPLATE_JSON, TEMPLATE_CSS] {
        let file = folder.join(name);
        if file.exists() {
            fs::remove_file(&file).map_err(|e| format!("Failed to delete {}: {}", name, e))?;
        }
    }
    fs::remove_dir(&folder).map_err(|_| {
        format!(
            "The template files were removed, but the folder {} still holds other files.",
            folder.display()
        )
    })
}

fn templates_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("templates"))
        .map_err(|e| format!("No config directory: {}", e))
}

#[tauri::command]
pub fn list_user_templates(app: AppHandle) -> Result<Vec<UserTemplateFiles>, String> {
    Ok(list_in(&templates_dir(&app)?))
}

#[tauri::command]
pub fn create_user_template(app: AppHandle, base_id: String, json: String, css: String) -> Result<String, String> {
    create_in(&templates_dir(&app)?, &base_id, &json, &css)
}

#[tauri::command]
pub fn import_template_css(app: AppHandle, path: String) -> Result<String, String> {
    import_css_in(&templates_dir(&app)?, Path::new(&path))
}

#[tauri::command]
pub fn delete_user_template(app: AppHandle, id: String) -> Result<(), String> {
    delete_in(&templates_dir(&app)?, &id)
}

/// Opened from Rust so the web view needs no permission to open directories.
#[tauri::command]
pub fn open_templates_folder(app: AppHandle) -> Result<(), String> {
    let dir = templates_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create the templates folder: {}", e))?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| format!("Failed to open the templates folder: {}", e))
}

#[derive(Default)]
pub struct TemplatesWatch(Mutex<Option<Debouncer<notify::RecommendedWatcher>>>);

/// Emit `templates-changed` whenever anything under the templates folder
/// changes, so edits made in another editor show up live. Idempotent.
#[tauri::command]
pub fn watch_templates(app: AppHandle) -> Result<(), String> {
    let state = app.state::<TemplatesWatch>();
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if slot.is_some() {
        return Ok(());
    }
    let dir = templates_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create the templates folder: {}", e))?;
    let app_handle = app.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(300), move |res: notify_debouncer_mini::DebounceEventResult| {
        if res.is_ok() {
            let _ = app_handle.emit("templates-changed", ());
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;
    debouncer
        .watcher()
        .watch(&dir, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch the templates folder: {}", e))?;
    *slot = Some(debouncer);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn scratch() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mdhero-templates-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn ids_cannot_leave_the_templates_folder() {
        for bad in ["", "..", "../x", "a/b", "a\\b", ".hidden", "Memo", "-memo", "memo.css", "a b"] {
            assert!(!is_valid_id(bad), "{:?} must be rejected", bad);
        }
        for good in ["memo", "acme-letter", "report_2", "2026"] {
            assert!(is_valid_id(good), "{:?} must be accepted", good);
        }
        assert!(!is_valid_id(&"a".repeat(65)));
    }

    #[test]
    fn slugs_are_always_valid_ids() {
        assert_eq!(slugify("Acme Letter (Blue)"), "acme-letter-blue");
        assert_eq!(slugify("../../etc"), "etc");
        assert_eq!(slugify("***"), "template");
        assert!(is_valid_id(&slugify(&"Long name ".repeat(20))));
    }

    #[test]
    fn create_picks_a_free_id_and_list_reads_it_back() {
        let dir = scratch();
        assert_eq!(create_in(&dir, "Memo", "{}", ".doc-page{}").unwrap(), "memo");
        assert_eq!(create_in(&dir, "memo", "{}", "b").unwrap(), "memo-2");
        let listed = list_in(&dir);
        assert_eq!(listed.iter().map(|t| t.id.as_str()).collect::<Vec<_>>(), ["memo", "memo-2"]);
        assert_eq!(listed[0].css, ".doc-page{}");
        assert_eq!(listed[0].json.as_deref(), Some("{}"));
    }

    #[test]
    fn list_skips_folders_without_css_or_with_unusable_names() {
        let dir = scratch();
        fs::create_dir_all(dir.join("no-css")).unwrap();
        fs::write(dir.join("no-css").join(TEMPLATE_JSON), "{}").unwrap();
        fs::create_dir_all(dir.join("Bad Name")).unwrap();
        fs::write(dir.join("Bad Name").join(TEMPLATE_CSS), "x").unwrap();
        fs::write(dir.join("loose.css"), "x").unwrap();
        fs::create_dir_all(dir.join("ok")).unwrap();
        fs::write(dir.join("ok").join(TEMPLATE_CSS), "x").unwrap();
        let ids: Vec<_> = list_in(&dir).into_iter().map(|t| t.id).collect();
        assert_eq!(ids, ["ok"]);
    }

    #[test]
    fn import_accepts_only_css() {
        let dir = scratch();
        let src = scratch();
        fs::write(src.join("Night Owl.css"), "#write { color: red }").unwrap();
        fs::write(src.join("secrets.txt"), "x").unwrap();
        assert_eq!(import_css_in(&dir, &src.join("Night Owl.css")).unwrap(), "night-owl");
        let listed = list_in(&dir);
        assert_eq!(listed[0].css, "#write { color: red }");
        assert!(listed[0].json.as_deref().unwrap().contains("\"Night Owl\""));
        assert!(import_css_in(&dir, &src.join("secrets.txt")).is_err());
    }

    #[test]
    fn delete_removes_only_template_files() {
        let dir = scratch();
        create_in(&dir, "plain", "{}", "x").unwrap();
        delete_in(&dir, "plain").unwrap();
        assert!(!dir.join("plain").exists());

        create_in(&dir, "kept", "{}", "x").unwrap();
        fs::write(dir.join("kept").join("notes.md"), "mine").unwrap();
        assert!(delete_in(&dir, "kept").is_err());
        assert!(dir.join("kept").join("notes.md").exists(), "other files are never deleted");

        assert!(delete_in(&dir, "..").is_err());
        assert!(delete_in(&dir, "missing").is_err());
    }
}
