// SENDA Command Center — Tauri v2 entry point.
//
// Security posture:
//   * No shell plugin, no arbitrary filesystem plugin, no remote origin.
//   * One read-only command, allowlisted, confined to the app data directory.
//   * The renderer never receives credentials or privileged OS access.
//
// The frontend is a normal Vite build; this shell only supplies a native window
// and a least-privilege bridge for locally imported evidence.

use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn runtime_info() -> serde_json::Value {
    serde_json::json!({
        "app": "SENDA Command Center",
        "shell": "tauri-v2",
        "offlineFirst": true,
        "autoDispatch": false,
        "note": "This shell never issues public emergency orders."
    })
}

/// Read a local evidence file from the per-user app data directory.
/// Any path traversal outside that directory is rejected.
#[tauri::command]
fn read_local_evidence(app: tauri::AppHandle, relative: String) -> Result<String, String> {
    if relative.trim().is_empty() {
        return Err("empty path".to_string());
    }

    let base: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app data dir unavailable: {error}"))?;

    let canonical_base = base
        .canonicalize()
        .map_err(|error| format!("app data dir not ready: {error}"))?;

    let candidate = base.join(&relative);
    let canonical = candidate
        .canonicalize()
        .map_err(|_| "evidence file not found".to_string())?;

    if !canonical.starts_with(&canonical_base) {
        return Err("path outside app data dir".to_string());
    }

    std::fs::read_to_string(canonical).map_err(|error| format!("read failed: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![runtime_info, read_local_evidence])
        .run(tauri::generate_context!())
        .expect("error while running SENDA Command Center");
}

fn main() {
    run();
}
