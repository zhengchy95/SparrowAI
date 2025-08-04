use std::path::PathBuf;

mod huggingface;
mod ovms;
mod tests;
mod chat_sessions;

fn generate_ovms_graph(model_dir: &PathBuf, model_id: &str) -> Result<(), String> {
    // Extract model name from ID (e.g., "OpenVINO/Phi-3.5-mini-instruct-int4-ov" -> "Phi-3.5-mini-instruct-int4-ov")
    let model_name = model_id.split('/').last().unwrap_or(model_id);

    // Check if we have OpenVINO IR files (.xml and .bin)
    let xml_files: Vec<_> = std::fs
        ::read_dir(model_dir)
        .map_err(|e| format!("Failed to read model directory: {}", e))?
        .filter_map(|entry| {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("xml") {
                    Some(path.file_stem().unwrap().to_string_lossy().to_string())
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    if xml_files.is_empty() {
        return Err("No OpenVINO IR files (.xml) found in model directory".to_string());
    }

    // For LLM models, look for common patterns
    let main_model_name = xml_files
        .iter()
        .find(|name| (name.contains("model") || name.contains("openvino")))
        .or_else(|| xml_files.first())
        .ok_or("No suitable model file found")?;

    // Check for tokenizer and detokenizer
    let tokenizer_name = xml_files
        .iter()
        .find(|name| name.contains("tokenizer") && !name.contains("detokenizer"));
    let detokenizer_name = xml_files.iter().find(|name| name.contains("detokenizer"));

    // Generate graph.pbtxt content based on model type
    let graph_content = if tokenizer_name.is_some() && detokenizer_name.is_some() {
        // Full LLM pipeline with tokenizer/detokenizer
        format!(
            r#"input_stream: "HTTP_REQUEST_PAYLOAD:input"
output_stream: "HTTP_RESPONSE_PAYLOAD:output"

node: {{
  name: "LLMExecutor"
  calculator: "HttpLLMCalculator"
  input_stream: "LOOPBACK:loopback"
  input_stream: "HTTP_REQUEST_PAYLOAD:input"
  input_side_packet: "LLM_NODE_RESOURCES:llm"
  output_stream: "LOOPBACK:loopback"
  output_stream: "HTTP_RESPONSE_PAYLOAD:output"
  input_stream_info: {{
    tag_index: 'LOOPBACK:0',
    back_edge: true
  }}
  node_options: {{
      [type.googleapis.com / mediapipe.LLMCalculatorOptions]: {{
          models_path: "./",
          plugin_config: '{{}}',
          enable_prefix_caching: false,
          cache_size: 2,
          max_num_seqs: 256,
          device: "GPU",
      }}
  }}
  input_stream_handler {{
    input_stream_handler: "SyncSetInputStreamHandler",
    options {{
      [mediapipe.SyncSetInputStreamHandlerOptions.ext] {{
        sync_set {{
          tag_index: "LOOPBACK:0"
        }}
      }}
    }}
  }}
}}
"#
        )
    } else {
        // Simple model inference graph
        format!(r#"input_stream: "HTTP_REQUEST_PAYLOAD:input"
output_stream: "HTTP_RESPONSE_PAYLOAD:output"

node {{
  name: "ModelInference"
  calculator: "OpenVINOInferenceCalculator"
  input_stream: "HTTP_REQUEST_PAYLOAD:input"
  output_stream: "HTTP_RESPONSE_PAYLOAD:output"
  node_options: {{
    [type.googleapis.com/mediapipe.OpenVINOInferenceCalculatorOptions]: {{
      model_path: "./{}.xml"
      device: "CPU"
    }}
  }}
}}
"#, main_model_name)
    };

    let graph_path = model_dir.join("graph.pbtxt");
    std::fs
        ::write(&graph_path, graph_content)
        .map_err(|e| format!("Failed to write graph.pbtxt: {}", e))?;

    println!("Generated graph.pbtxt for model: {}", model_name);
    println!("Graph file location: {}", graph_path.display());

    Ok(())
}

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
    } else if cfg!(target_os = "macos") {
        std::process::Command
            ::new("open")
            .arg(&model_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))
    } else {
        std::process::Command
            ::new("xdg-open")
            .arg(&model_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))
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
                ovms::download_ovms,
                ovms::check_ovms_present,
                ovms::start_ovms_server,
                ovms::run_ovms,
                ovms::chat_with_ovms,
                ovms::create_ovms_config,
                ovms::update_ovms_config,
                ovms::reload_ovms_config,
                ovms::run_ovms_with_config,
                ovms::download_ovms_model,
                ovms::debug_ovms_paths,
                ovms::load_model,
                ovms::unload_model,
                ovms::get_loaded_model,
                ovms::chat_with_loaded_model,
                ovms::chat_with_loaded_model_streaming,
                ovms::check_ovms_status,
                ovms::get_ovms_model_metadata,
                tests::test_openvino_search,
                tests::test_model_loading,
                tests::test_model_workflow,
                tests::show_model_commands,
                tests::test_download_paths,
                chat_sessions::get_chat_sessions,
                chat_sessions::create_chat_session,
                chat_sessions::create_temporary_chat_session,
                chat_sessions::persist_temporary_session,
                chat_sessions::add_message_to_temporary_session,
                chat_sessions::update_chat_session,
                chat_sessions::delete_chat_session,
                chat_sessions::set_active_chat_session,
                chat_sessions::add_message_to_session,
                chat_sessions::get_session_messages,
                chat_sessions::get_conversation_history
            ]
        )
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
