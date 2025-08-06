use std::path::PathBuf;
use std::sync::{ Arc, Mutex };
use tauri::Emitter;

mod huggingface;
mod ovms;
mod chat;
mod rag;

#[tauri::command]
async fn check_downloaded_models(download_path: Option<String>) -> Result<Vec<String>, String> {
    let downloads_dir = if let Some(path) = download_path {
        PathBuf::from(path)
    } else {
        // Use .sparrow/models as default
        let home_dir = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            Ok(home) => home,
            Err(_) => {
                return Err("Failed to get user home directory".to_string());
            }
        };
        PathBuf::from(home_dir).join(".sparrow").join("models")
    };

    let mut downloaded_models = Vec::new();

    if downloads_dir.exists() && downloads_dir.is_dir() {
        match std::fs::read_dir(&downloads_dir) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(dir_name) = entry.file_name().to_str() {
                                // Only look for OpenVINO organization
                                if dir_name == "OpenVINO" {
                                    // Check if this is the OpenVINO org directory with models inside
                                    if let Ok(org_entries) = std::fs::read_dir(&path) {
                                        for org_entry in org_entries {
                                            if let Ok(org_entry) = org_entry {
                                                let model_path = org_entry.path();
                                                if model_path.is_dir() {
                                                    if
                                                        let Some(model_name) = org_entry
                                                            .file_name()
                                                            .to_str()
                                                    {
                                                        if has_model_files(&model_path) {
                                                            // This is OpenVINO/model structure
                                                            downloaded_models.push(
                                                                format!("OpenVINO/{}", model_name)
                                                            );
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                // Skip non-OpenVINO directories
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to read downloads directory: {}", e);
            }
        }
    }

    Ok(downloaded_models)
}

fn has_model_files(dir: &PathBuf) -> bool {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        // Check for common model files
                        if
                            file_name.ends_with(".json") ||
                            file_name.ends_with(".bin") ||
                            file_name.ends_with(".safetensors") ||
                            file_name.ends_with(".model") ||
                            file_name == "README.md"
                        {
                            return true;
                        }
                    }
                }
            }
        }
    }
    false
}

#[tauri::command]
async fn delete_downloaded_model(
    model_id: String,
    download_path: Option<String>
) -> Result<String, String> {
    // Ensure we're working with an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };

    let base_dir = if let Some(path) = download_path {
        PathBuf::from(path)
    } else {
        // Use .sparrow/models as default
        let home_dir = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            Ok(home) => home,
            Err(_) => {
                return Err("Failed to get user home directory".to_string());
            }
        };
        PathBuf::from(home_dir).join(".sparrow").join("models")
    };

    let model_dir = base_dir.join(&normalized_model_id);

    if !model_dir.exists() {
        return Err(format!("Model directory does not exist: {}", model_dir.display()));
    }

    match std::fs::remove_dir_all(&model_dir) {
        Ok(_) => {
            // If this was an org/model structure, check if the org directory is now empty
            if normalized_model_id.contains('/') {
                let org_name = normalized_model_id.split('/').next().unwrap();
                let org_dir = base_dir.join(org_name);

                if org_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(&org_dir) {
                        if entries.count() == 0 {
                            // Remove empty org directory
                            let _ = std::fs::remove_dir(&org_dir);
                        }
                    }
                }
            }

            Ok(format!("Successfully deleted model: {}", normalized_model_id))
        }
        Err(e) => Err(format!("Failed to delete model {}: {}", normalized_model_id, e)),
    }
}

#[tauri::command]
async fn open_model_folder(
    model_id: String,
    download_path: Option<String>
) -> Result<String, String> {
    // Ensure we're working with an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };

    let base_dir = if let Some(path) = download_path {
        PathBuf::from(path)
    } else {
        // Use .sparrow/models as default
        let home_dir = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            Ok(home) => home,
            Err(_) => {
                return Err("Failed to get user home directory".to_string());
            }
        };
        PathBuf::from(home_dir).join(".sparrow").join("models")
    };

    let model_dir = base_dir.join(&normalized_model_id);

    if !model_dir.exists() {
        return Err(format!("Model directory does not exist: {}", model_dir.display()));
    }

    // Use different commands based on the OS
    let result = if cfg!(target_os = "windows") {
        // On Windows, use forward slashes for explorer or convert path
        let windows_path = model_dir.to_string_lossy().replace('/', "\\");
        std::process::Command
            ::new("explorer")
            .arg(&windows_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))
    } else {
        Err("Unsupported operating system".to_string())
    };

    match result {
        Ok(_) => Ok(format!("Opened folder: {}", model_dir.display())),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn get_default_download_path() -> Result<String, String> {
    // Get user's Downloads directory
    let home_dir = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        Ok(home) => PathBuf::from(home),
        Err(_) => {
            return Err("Failed to get user home directory".to_string());
        }
    };

    let default_path = home_dir.join(".sparrow").join("models");

    // Create the directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&default_path) {
        return Err(format!("Failed to create default download directory: {}", e));
    }

    // Return the absolute path
    match std::fs::canonicalize(&default_path) {
        Ok(abs_path) => Ok(abs_path.to_string_lossy().to_string()),
        Err(_) => Ok(default_path.to_string_lossy().to_string()),
    }
}

#[tauri::command]
async fn get_initialization_status() -> Result<InitializationStatus, String> {
    let status_mutex = INIT_STATUS.get_or_init(||
        Arc::new(
            Mutex::new(InitializationStatus {
                step: "not_started".to_string(),
                message: "Initialization not started".to_string(),
                progress: 0,
                is_complete: false,
                has_error: false,
                error_message: None,
            })
        )
    );

    let status = status_mutex.lock().unwrap();
    Ok(status.clone())
}

#[derive(Clone, serde::Serialize)]
struct InitializationStatus {
    step: String,
    message: String,
    progress: u8,
    is_complete: bool,
    has_error: bool,
    error_message: Option<String>,
}

// Global initialization status
static INIT_STATUS: std::sync::OnceLock<Arc<Mutex<InitializationStatus>>> = std::sync::OnceLock::new();

async fn initialize_ovms(app_handle: tauri::AppHandle) {
    let status_mutex = INIT_STATUS.get_or_init(||
        Arc::new(
            Mutex::new(InitializationStatus {
                step: "starting".to_string(),
                message: "Initializing OVMS...".to_string(),
                progress: 0,
                is_complete: false,
                has_error: false,
                error_message: None,
            })
        )
    );

    // Update status: Starting
    {
        let mut status = status_mutex.lock().unwrap();
        status.step = "checking".to_string();
        status.message = "Checking if OVMS is present...".to_string();
        status.progress = 10;
        app_handle
            .emit("ovms-init-status", &*status)
            .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
    }

    // Check if OVMS is present
    if !ovms::is_ovms_present(Some(&app_handle)) {
        // Update status: Downloading
        {
            let mut status = status_mutex.lock().unwrap();
            status.step = "downloading".to_string();
            status.message = "OVMS not found, downloading...".to_string();
            status.progress = 20;
            app_handle
                .emit("ovms-init-status", &*status)
                .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
        }

        match ovms::download_ovms(app_handle.clone()).await {
            Ok(msg) => {
                println!("OVMS download: {}", msg);
                let mut status = status_mutex.lock().unwrap();
                status.step = "downloaded".to_string();
                status.message = "OVMS downloaded successfully".to_string();
                status.progress = 70;
                app_handle
                    .emit("ovms-init-status", &*status)
                    .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
            }
            Err(e) => {
                eprintln!("Failed to download OVMS: {}", e);
                let mut status = status_mutex.lock().unwrap();
                status.has_error = true;
                status.error_message = Some(format!("Failed to download OVMS: {}", e));
                status.message = "Download failed".to_string();
                app_handle
                    .emit("ovms-init-status", &*status)
                    .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
                return;
            }
        }
    } else {
        println!("OVMS already present");
        let mut status = status_mutex.lock().unwrap();
        status.step = "present".to_string();
        status.message = "OVMS already present".to_string();
        status.progress = 70;
        app_handle
            .emit("ovms-init-status", &*status)
            .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
    }

    // Start OVMS server
    {
        let mut status = status_mutex.lock().unwrap();
        status.step = "starting_server".to_string();
        status.message = "Starting OVMS server...".to_string();
        status.progress = 80;
        app_handle
            .emit("ovms-init-status", &*status)
            .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
    }

    match ovms::start_ovms_server(app_handle.clone()).await {
        Ok(msg) => {
            println!("OVMS startup: {}", msg);
            let mut status = status_mutex.lock().unwrap();
            status.step = "complete".to_string();
            status.message = "OVMS initialization complete".to_string();
            status.progress = 100;
            status.is_complete = true;
            app_handle
                .emit("ovms-init-status", &*status)
                .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
        }
        Err(e) => {
            eprintln!("Failed to start OVMS server: {}", e);
            let mut status = status_mutex.lock().unwrap();
            status.has_error = true;
            status.error_message = Some(format!("Failed to start OVMS server: {}", e));
            status.message = "Server startup failed".to_string();
            app_handle
                .emit("ovms-init-status", &*status)
                .unwrap_or_else(|e| eprintln!("Failed to emit status: {}", e));
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder
        ::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(
            tauri::generate_handler![
                huggingface::search_models,
                huggingface::get_model_info,
                huggingface::download_entire_model,
                check_downloaded_models,
                delete_downloaded_model,
                open_model_folder,
                get_default_download_path,
                get_initialization_status,
                ovms::download_ovms,
                ovms::check_ovms_present,
                ovms::start_ovms_server,
                ovms::create_ovms_config,
                ovms::update_ovms_config,
                ovms::reload_ovms_config,
                ovms::load_model,
                ovms::unload_model,
                ovms::get_loaded_model,
                chat::chat_with_loaded_model_streaming,
                ovms::check_ovms_status,
                ovms::get_ovms_model_metadata,
                chat::get_chat_sessions,
                chat::create_chat_session,
                chat::create_temporary_chat_session,
                chat::persist_temporary_session,
                chat::add_message_to_temporary_session,
                chat::update_chat_session,
                chat::delete_chat_session,
                chat::set_active_chat_session,
                chat::add_message_to_session,
                chat::get_session_messages,
                chat::get_conversation_history,
                chat::chat_with_rag_streaming,
                rag::documents::process_document,
                rag::documents::save_temp_file,
                rag::embeddings::create_document_embeddings,
                rag::embeddings::create_query_embedding,
                rag::vector_store::store_documents,
                rag::vector_store::search_documents,
                rag::vector_store::get_all_documents,
                rag::vector_store::delete_document_by_id,
                rag::vector_store::get_document_count,
                rag::vector_store::clear_all_documents,
                rag::reranker::rerank_search_results,
                rag::reranker::rerank_search_results_simple,
                rag::search::search_documents_by_query,
                rag::search::get_search_suggestions
            ]
        )
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                initialize_ovms(handle).await;
            });
            Ok(())
        })

        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Stop OVMS server when app is closing
                if let Err(e) = ovms::stop_ovms_server() {
                    eprintln!("Failed to stop OVMS server: {}", e);
                } else {
                    println!("OVMS server stopped on app shutdown");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
