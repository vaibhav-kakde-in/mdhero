use std::fs;
use std::path::Path;

/// Explicitly quit the app — used by the "Close on Escape" setting when
/// closing the last tab. On macOS this is needed because the standard
/// "close window" behavior leaves the app running in the dock.
///
/// SAFETY: this bypasses any pending dirty-tab confirmation. Callers MUST
/// close all dirty tabs via the frontend tab store (which surfaces a
/// confirm() prompt) before invoking this. Currently only invoked from the
/// close-on-ESC flow in `+page.svelte`, which guarantees this — either the
/// last tab is closed via `handleCloseTab` first (dirty prompt included), or
/// the invocation only happens from the home tab when no file tabs exist.
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);

    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !p.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);

    if p.exists() && !p.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::write(p, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn list_claude_plans() -> Result<Vec<PlanFile>, String> {
    let home = std::env::var("HOME").map_err(|_| "Cannot determine home directory".to_string())?;
    let plans_dir = Path::new(&home).join(".claude").join("plans");

    if !plans_dir.exists() {
        return Ok(Vec::new());
    }

    let mut plans: Vec<PlanFile> = Vec::new();

    let entries = fs::read_dir(&plans_dir).map_err(|e| format!("Failed to read plans directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "markdown" {
                    let name = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let modified = entry.metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    plans.push(PlanFile {
                        name,
                        path: path.to_string_lossy().to_string(),
                        modified,
                    });
                }
            }
        }
    }

    // Sort by most recent first
    plans.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(plans)
}

#[derive(serde::Serialize)]
pub struct PlanFile {
    pub name: String,
    pub path: String,
    pub modified: u64,
}

#[tauri::command]
pub fn list_folder_md_files(folder: String, max_depth: Option<u32>) -> Result<Vec<MdFile>, String> {
    let root = Path::new(&folder);
    if !root.exists() || !root.is_dir() {
        return Ok(Vec::new());
    }

    let depth_limit = max_depth.unwrap_or(3);
    let mut files: Vec<MdFile> = Vec::new();
    collect_md_files(root, root, depth_limit, 0, &mut files);

    // Sort by most recent first
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    // Cap at 50 files to keep UI fast
    files.truncate(50);

    Ok(files)
}

fn collect_md_files(root: &Path, dir: &Path, max_depth: u32, current_depth: u32, files: &mut Vec<MdFile>) {
    if current_depth > max_depth {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        // Skip hidden directories/files
        if let Some(name) = path.file_name() {
            if name.to_string_lossy().starts_with('.') {
                continue;
            }
        }

        // Skip common non-content directories
        if path.is_dir() {
            if let Some(name) = path.file_name() {
                let n = name.to_string_lossy();
                if matches!(n.as_ref(), "node_modules" | "target" | "dist" | "build" | ".git" | "__pycache__" | "vendor") {
                    continue;
                }
            }
            collect_md_files(root, &path, max_depth, current_depth + 1, files);
            continue;
        }

        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "markdown" || ext == "mdown" || ext == "mkd" {
                    let name = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    // Relative path from the root folder
                    let rel_path = path.strip_prefix(root)
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let modified = entry.metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);

                    files.push(MdFile {
                        name,
                        path: path.to_string_lossy().to_string(),
                        rel_path,
                        modified,
                    });
                }
            }
        }
    }
}

#[derive(serde::Serialize)]
pub struct MdFile {
    pub name: String,
    pub path: String,
    pub rel_path: String,
    pub modified: u64,
}
