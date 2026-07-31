use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

pub struct BackendProcess(pub Mutex<Option<CommandChild>>);

fn spawn_backend(app: &AppHandle) -> Result<CommandChild, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_dir = app_dir.join("backend");
    std::fs::create_dir_all(&db_dir).map_err(|e| e.to_string())?;

    let db_path = db_dir.join("models.db");
    let db_url = format!("sqlite:///{}", db_path.to_string_lossy());

    let sidecar = app
        .shell()
        .sidecar("backend")
        .map_err(|e| e.to_string())?
        .env("AI_MODEL_BROWSER_DB_URL", db_url)
        .env("AI_MODEL_BROWSER_APP_DIR", app_dir.to_string_lossy().to_string())
        .args(["--host", "127.0.0.1", "--port", "8000"]);

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("failed to spawn backend: {}", e))?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    println!("[backend stdout] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    eprintln!("[backend stderr] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Error(err) => {
                    eprintln!("[backend error] {}", err);
                    let _ = app_handle.emit("backend-error", err);
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    println!("[backend terminated] {:?}", payload);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let app_handle = app.handle().clone();
            match spawn_backend(&app_handle) {
                Ok(child) => {
                    app.state::<BackendProcess>().0.lock().unwrap().replace(child);
                }
                Err(err) => {
                    eprintln!("Failed to start backend sidecar: {}", err);
                }
            }
            Ok(())
        })
        .on_window_event(|app, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(child) = app.state::<BackendProcess>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
