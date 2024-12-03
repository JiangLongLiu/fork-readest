#[cfg(target_os = "macos")]
#[macro_use]
extern crate cocoa;

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

#[cfg(target_os = "macos")]
mod menu;
#[cfg(target_os = "macos")]
mod tauri_traffic_light_positioner_plugin;

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Listener, Manager, Url};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog;
use tauri_plugin_fs::FsExt;

fn handle_file_associations(app: AppHandle, files: Vec<PathBuf>) {
    let asset_protocol_scope = app.asset_protocol_scope();
    let fs_scope = app.fs_scope();
    for file in &files {
        let _ = fs_scope.allow_file(file);
        let _ = asset_protocol_scope.allow_file(file);
    }

    let files = files
        .into_iter()
        .map(|f| {
            let file = f.to_string_lossy().replace("\\", "\\\\");
            format!("\"{file}\"",)
        })
        .collect::<Vec<_>>()
        .join(",");
    let window = app.get_webview_window("main").unwrap();
    let script = format!("window.TAURI_CLI_ARGS = [{}];", files);
    if let Err(e) = window.eval(&script) {
        eprintln!("Failed to set open files variable: {}", e);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_traffic_light_positioner_plugin::init());

    builder
        .setup(|#[allow(unused_variables)] app| {
            #[cfg(desktop)]
            {
                let mut files = Vec::new();
                // NOTICE: `args` may include URL protocol (`your-app-protocol://`)
                // or arguments (`--`) if your app supports them.
                // files may aslo be passed as `file://path/to/file`
                for maybe_file in std::env::args().skip(1) {
                    // skip flags like -f or --flag
                    if maybe_file.starts_with("-") {
                        continue;
                    }
                    // handle `file://` path urls and skip other urls
                    if let Ok(url) = Url::parse(&maybe_file) {
                        if let Ok(path) = url.to_file_path() {
                            files.push(path);
                        }
                    } else {
                        files.push(PathBuf::from(maybe_file))
                    }
                }
                let asset_protocol_scope = app.asset_protocol_scope();
                let fs_scope = app.fs_scope();
                for file in &files {
                    let _ = fs_scope.allow_file(file);
                    let _ = asset_protocol_scope.allow_file(file);
                }
            }
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_cli::init())?;
            #[cfg(desktop)]
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("")
                .inner_size(800.0, 600.0)
                .resizable(true)
                .maximized(true);

            #[cfg(target_os = "macos")]
            let win_builder = win_builder
                .decorations(true)
                .title_bar_style(TitleBarStyle::Overlay);

            #[cfg(not(target_os = "macos"))]
            let win_builder = win_builder.decorations(false).transparent(true);

            win_builder.build().unwrap();
            // let win = win_builder.build().unwrap();
            // win.open_devtools();

            #[cfg(target_os = "macos")]
            menu::setup_macos_menu(&app.handle())?;

            app.handle().emit("window-ready", {}).unwrap();

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = event {
                let files = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .collect::<Vec<_>>();

                let app_handle = app.clone();
                app.listen("window-ready", move |_| {
                    println!("Window is ready, proceeding to handle files.");
                    handle_file_associations(app_handle.clone(), files.clone());
                });
            }
        });
}
