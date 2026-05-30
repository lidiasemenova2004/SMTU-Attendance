use serde_json::Value;
use std::{fs, path::PathBuf};

#[tauri::command]
fn load_attendance_report() -> Result<Value, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let candidates: Vec<PathBuf> = vec![
        current_dir.join("attendance_report.json"),
        current_dir.join("services").join("attendance_report.json"),
        current_dir
            .parent()
            .map(|path| path.join("services").join("attendance_report.json"))
            .unwrap_or_else(|| current_dir.join("services").join("attendance_report.json")),
    ];

    let report_path = candidates
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| "File attendance_report.json was not found".to_string())?;

    let content = fs::read_to_string(&report_path)
        .map_err(|error| format!("Failed to read {}: {error}", report_path.display()))?;

    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse {}: {error}", report_path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init()) 
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_attendance_report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
