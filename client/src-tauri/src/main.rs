// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri::Emitter;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            tauri::async_runtime::spawn(async move {
                let sidecar_command = app_handle.shell()
                    .sidecar("main")
                    .expect("failed to create sidecar command");
                
                let (mut rx, mut child) = sidecar_command
                    .spawn()
                    .expect("Failed to spawn sidecar");
                
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line_bytes) = event {
                        let line = String::from_utf8_lossy(&line_bytes);
                        app_handle
                            .emit("message", Some(format!("'{}'", line)))
                            .expect("failed to emit event");
                        
                        // Write to stdin if needed
                        child.write("message from Rust\n".as_bytes()).unwrap();
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    app_lib::run();
}
