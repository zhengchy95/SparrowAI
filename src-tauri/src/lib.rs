use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

mod ovms;
mod tests;

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub author: Option<String>,
    pub sha: Option<String>,
    pub pipeline_tag: Option<String>,
    pub tags: Vec<String>,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
    pub created_at: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub models: Vec<ModelInfo>,
    pub total_count: Option<u64>,
}

// Hugging Face API response structures
#[derive(Debug, Deserialize)]
struct HfModelInfo {
    pub id: String,
    pub author: Option<String>,
    pub sha: Option<String>,
    #[serde(rename = "pipeline-tag")]
    pub pipeline_tag: Option<String>,
    pub tags: Option<Vec<String>>,
    pub downloads: Option<u64>,
    pub likes: Option<u64>,
    #[serde(rename = "created_at")]
    pub created_at: Option<String>,
    #[serde(rename = "last_modified")]
    pub last_modified: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HfFileInfo {
    #[serde(rename = "path")]
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: Option<u64>,
}



// Memory-efficient streaming file download
async fn download_single_file(
    client: &reqwest::Client,
    file_url: &str,
    target_dir: &PathBuf,
    file_info: &HfFileInfo,
    model_id: &str,
    file_index: usize,
    total_files: usize,
    app: &tauri::AppHandle,
) -> Result<u64, String> {
    use futures::StreamExt;
    
    // Create subdirectories if needed (async)
    let target_file = target_dir.join(&file_info.path);
    if let Some(parent) = target_file.parent() {
        tokio::fs::create_dir_all(parent).await
            .map_err(|e| format!("Failed to create directory for {}: {}", file_info.path, e))?;
    }
    
    // Start the request
    let response = client
        .get(file_url)
        .header("User-Agent", "SparrowAI/1.0")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error {}", response.status()));
    }
    
    // Get content length for progress tracking
    let content_length = response.content_length().unwrap_or(0);
    
    // Create the file
    let mut file = tokio::fs::File::create(&target_file).await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    // Stream the response body in chunks to avoid loading entire file into memory
    let mut stream = response.bytes_stream();
    let mut downloaded = 0u64;
    let mut last_progress_emit = std::time::Instant::now();
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;
        
        // Write chunk to file
        file.write_all(&chunk).await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        // Emit progress events, but not too frequently to avoid overwhelming the UI
        if last_progress_emit.elapsed().as_millis() > 100 || downloaded == content_length {
            let file_progress = if content_length > 0 {
                (downloaded as f64 / content_length as f64 * 100.0) as u32
            } else {
                0
            };
            
            let overall_progress = ((file_index - 1) as f64 / total_files as f64 * 100.0 
                + file_progress as f64 / total_files as f64) as u32;
            
            let _ = app.emit("download-progress", serde_json::json!({
                "modelId": model_id,
                "progress": overall_progress,
                "currentFile": file_info.path,
                "fileIndex": file_index,
                "totalFiles": total_files,
                "fileProgress": file_progress,
                "downloadedBytes": downloaded,
                "totalBytes": content_length
            }));
            
            last_progress_emit = std::time::Instant::now();
        }
        
        // Add a small yield to prevent blocking the async runtime
        tokio::task::yield_now().await;
    }
    
    // Ensure all data is written to disk
    file.flush().await
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    
    Ok(downloaded)
}



#[tauri::command]
async fn search_models(query: String, limit: Option<u32>) -> Result<SearchResult, String> {
    let client = reqwest::Client::new();
    let search_limit = limit.unwrap_or(20);
    
    // Search specifically under OpenVINO organization
    let search_query = if query.trim().is_empty() {
        "OpenVINO".to_string()
    } else {
        format!("OpenVINO/{}", query)
    };
    
    let url = format!(
        "https://huggingface.co/api/models?search={}&limit={}&author=OpenVINO",
        urlencoding::encode(&search_query),
        search_limit
    );
    
    let response = client
        .get(&url)
        .header("User-Agent", "SparrowAI/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API request failed with status: {}", response.status()));
    }
    
    let hf_models: Vec<HfModelInfo> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Filter to only include OpenVINO models and optionally filter by query
    let models: Vec<ModelInfo> = hf_models
        .into_iter()
        .filter(|hf_model| {
            // Ensure the model is from OpenVINO organization
            hf_model.id.starts_with("OpenVINO/") &&
            // If there's a specific query, check if the model name contains it
            (query.trim().is_empty() || 
             hf_model.id.to_lowercase().contains(&query.to_lowercase()))
        })
        .map(|hf_model| ModelInfo {
            id: hf_model.id,
            author: hf_model.author,
            sha: hf_model.sha,
            pipeline_tag: hf_model.pipeline_tag,
            tags: hf_model.tags.unwrap_or_default(),
            downloads: hf_model.downloads,
            likes: hf_model.likes,
            created_at: hf_model.created_at,
            last_modified: hf_model.last_modified,
        })
        .collect();
    
    let total_count = models.len() as u64;
    
    Ok(SearchResult {
        models,
        total_count: Some(total_count),
    })
}

#[tauri::command]
async fn get_model_info(model_id: String) -> Result<ModelInfo, String> {
    let client = reqwest::Client::new();
    
    // Ensure we're getting info for an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };
    
    let url = format!("https://huggingface.co/api/models/{}", urlencoding::encode(&normalized_model_id));
    
    let response = client
        .get(&url)
        .header("User-Agent", "SparrowAI/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API request failed with status: {}. Make sure the model exists under OpenVINO organization.", response.status()));
    }
    
    let hf_model: HfModelInfo = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Verify this is actually an OpenVINO model
    if !hf_model.id.starts_with("OpenVINO/") {
        return Err(format!("Model {} is not from OpenVINO organization", hf_model.id));
    }
    
    Ok(ModelInfo {
        id: hf_model.id,
        author: hf_model.author,
        sha: hf_model.sha,
        pipeline_tag: hf_model.pipeline_tag,
        tags: hf_model.tags.unwrap_or_default(),
        downloads: hf_model.downloads,
        likes: hf_model.likes,
        created_at: hf_model.created_at,
        last_modified: hf_model.last_modified,
    })
}

fn generate_ovms_graph(model_dir: &PathBuf, model_id: &str) -> Result<(), String> {
    // Extract model name from ID (e.g., "OpenVINO/Phi-3.5-mini-instruct-int4-ov" -> "Phi-3.5-mini-instruct-int4-ov")
    let model_name = model_id.split('/').last().unwrap_or(model_id);
    
    // Check if we have OpenVINO IR files (.xml and .bin)
    let xml_files: Vec<_> = std::fs::read_dir(model_dir)
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
    let main_model_name = xml_files.iter()
        .find(|name| name.contains("model") || name.contains("openvino"))
        .or_else(|| xml_files.first())
        .ok_or("No suitable model file found")?;
    
    // Check for tokenizer and detokenizer
    let tokenizer_name = xml_files.iter()
        .find(|name| name.contains("tokenizer") && !name.contains("detokenizer"));
    let detokenizer_name = xml_files.iter()
        .find(|name| name.contains("detokenizer"));
    
    // Generate graph.pbtxt content based on model type
    let graph_content = if tokenizer_name.is_some() && detokenizer_name.is_some() {
        // Full LLM pipeline with tokenizer/detokenizer
        format!(r#"input_stream: "HTTP_REQUEST_PAYLOAD:input"
output_stream: "HTTP_RESPONSE_PAYLOAD:output"

node {{
  name: "LLMExecutor"
  calculator: "HttpLLMCalculator"
  input_stream: "LOOPBACK:loopback"
  input_stream: "HTTP_REQUEST_PAYLOAD:input"
  output_stream: "LOOPBACK:loopback"
  output_stream: "HTTP_RESPONSE_PAYLOAD:output"
  input_side_packet: "LLM_NODE_RESOURCES:llm"
  node_options: {{
    [type.googleapis.com/mediapipe.LLMCalculatorOptions]: {{
      models_path: "./"
      cache_size: 10
    }}
  }}
}}

input_side_packet: "LLM_NODE_RESOURCES:llm"
node {{
  calculator: "LLMNodeResourcesCalculator"
  output_side_packet: "LLM_NODE_RESOURCES:llm"
  node_options: {{
    [type.googleapis.com/mediapipe.LLMNodeResourcesCalculatorOptions]: {{
      model_path: "./{}.xml"
      tokenizer_path: "./{}.xml"
      detokenizer_path: "./{}.xml"
      device: "CPU"
      max_num_batches: 4
    }}
  }}
}}
"#, main_model_name, tokenizer_name.unwrap(), detokenizer_name.unwrap())
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
    std::fs::write(&graph_path, graph_content)
        .map_err(|e| format!("Failed to write graph.pbtxt: {}", e))?;
    
    println!("Generated graph.pbtxt for model: {}", model_name);
    println!("Graph file location: {}", graph_path.display());
    
    Ok(())
}

#[tauri::command]
async fn download_entire_model(
    model_id: String,
    download_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Ensure we're downloading an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };
    
    // Create a client with timeout to prevent hanging
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout per request
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let target_dir = if let Some(path) = download_path {
        PathBuf::from(path).join(&normalized_model_id)
    } else {
        // Use .sparrow/models as default
        let home_dir = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME"))
            .map_err(|e| format!("Failed to get user home directory: {}", e))?;
        PathBuf::from(home_dir).join(".sparrow").join("models").join(&normalized_model_id)
    };
    
    // Create target directory
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    // First, get the list of files in the repository
    let files_url = format!(
        "https://huggingface.co/api/models/{}/tree/main",
        urlencoding::encode(&normalized_model_id)
    );
    
    println!("Fetching file list from: {}", files_url);
    
    let files_response = client
        .get(&files_url)
        .header("User-Agent", "SparrowAI/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch file list: {}", e))?;
    
    if !files_response.status().is_success() {
        return Err(format!(
            "Failed to fetch file list. Status: {}. The model might be private or not exist.",
            files_response.status()
        ));
    }
    
    let files: Vec<HfFileInfo> = files_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse file list: {}", e))?;
    
    println!("Found {} files in repository", files.len());
    
    let mut downloaded_files = Vec::new();
    let mut errors = Vec::new();
    let mut total_size = 0u64;
    
    // Filter to only download actual files (not directories)
    let mut downloadable_files: Vec<&HfFileInfo> = files
        .iter()
        .filter(|file| file.file_type == "file")
        .collect();
    
    // Calculate total size and warn if very large
    let total_estimated_size: u64 = downloadable_files
        .iter()
        .map(|f| f.size.unwrap_or(0))
        .sum();
    
    let total_size_gb = total_estimated_size as f64 / (1024.0 * 1024.0 * 1024.0);
    
    if total_size_gb > 10.0 {
        println!("Warning: Large model detected ({:.1} GB). This may take a while and use significant disk space.", total_size_gb);
    }
    
    // Sort files by size (smallest first) to get quick wins early
    downloadable_files.sort_by_key(|f| f.size.unwrap_or(0));
    
    println!("Downloading {} files ({:.1} GB estimated)...", downloadable_files.len(), total_size_gb);
    
    let total_files = downloadable_files.len();
    
    for (index, file_info) in downloadable_files.iter().enumerate() {
        let file_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            urlencoding::encode(&normalized_model_id),
            urlencoding::encode(&file_info.path)
        );
        
        println!("Downloading: {} ({})", file_info.path, 
            file_info.size.map_or("unknown size".to_string(), |s| format!("{} bytes", s))
        );
        
        // Emit progress event
        let progress = ((index + 1) as f64 / total_files as f64 * 100.0) as u32;
        let _ = app.emit("download-progress", serde_json::json!({
            "modelId": normalized_model_id,
            "progress": progress,
            "currentFile": file_info.path,
            "fileIndex": index + 1,
            "totalFiles": total_files
        }));
        
        // Add error recovery wrapper
        let download_result = download_single_file(
            &client,
            &file_url,
            &target_dir,
            file_info,
            &normalized_model_id,
            index + 1,
            total_files,
            &app,
        ).await;
        
        match download_result {
            Ok(file_size) => {
                downloaded_files.push(file_info.path.clone());
                total_size += file_size;
                println!("✓ Downloaded: {} ({} bytes)", file_info.path, file_size);
            }
            Err(e) => {
                let error_msg = format!("Failed to download {}: {}", file_info.path, e);
                eprintln!("{}", error_msg);
                errors.push(error_msg);
                
                // Continue with other files instead of crashing
                continue;
            }
        }
    }
    
    if downloaded_files.is_empty() {
        let error_details = if errors.is_empty() {
            "No files could be downloaded from the repository.".to_string()
        } else {
            format!("Download errors occurred:\n{}", errors.join("\n"))
        };
        return Err(format!("Failed to download model files. {}", error_details));
    }
    
    let total_size_mb = total_size as f64 / (1024.0 * 1024.0);
    let success_msg = format!(
        "Successfully downloaded {} files ({:.2} MB) to:\n{}\n\nDownloaded files:\n• {}",
        downloaded_files.len(),
        total_size_mb,
        target_dir.to_string_lossy(),
        downloaded_files.join("\n• ")
    );
    
    // Generate graph.pbtxt for OVMS compatibility
    if let Err(e) = generate_ovms_graph(&target_dir, &normalized_model_id) {
        eprintln!("Warning: Failed to generate graph.pbtxt: {}", e);
    }

    if !errors.is_empty() {
        Ok(format!("{}\n\n⚠️ Some files had issues ({} errors):\n{}", 
            success_msg, errors.len(), errors.join("\n")))
    } else {
        Ok(success_msg)
    }
}

#[tauri::command]
async fn check_downloaded_models(download_path: Option<String>) -> Result<Vec<String>, String> {
    let downloads_dir = if let Some(path) = download_path {
        PathBuf::from(path)
    } else {
        // Use .sparrow/models as default
        let home_dir = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            Ok(home) => home,
            Err(_) => return Err("Failed to get user home directory".to_string()),
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
                                                    if let Some(model_name) = org_entry.file_name().to_str() {
                                                        if has_model_files(&model_path) {
                                                            // This is OpenVINO/model structure
                                                            downloaded_models.push(format!("OpenVINO/{}", model_name));
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
                        if file_name.ends_with(".json") || 
                           file_name.ends_with(".bin") || 
                           file_name.ends_with(".safetensors") ||
                           file_name.ends_with(".model") ||
                           file_name == "README.md" {
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
            Err(_) => return Err("Failed to get user home directory".to_string()),
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
        },
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
            Err(_) => return Err("Failed to get user home directory".to_string()),
        };
        PathBuf::from(home_dir).join(".sparrow").join("models")
    };
    
    let model_dir = base_dir.join(&normalized_model_id);
    
    if !model_dir.exists() {
        return Err(format!("Model directory does not exist: {}", model_dir.display()));
    }
    
    // Use different commands based on the OS
    let result = if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(&model_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(&model_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))
    } else {
        std::process::Command::new("xdg-open")
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
        Err(_) => return Err("Failed to get user home directory".to_string()),
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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![search_models, get_model_info, download_entire_model, check_downloaded_models, delete_downloaded_model, open_model_folder, get_default_download_path, ovms::download_ovms, ovms::run_ovms, ovms::stop_ovms, ovms::chat_with_ovms, ovms::create_ovms_config, ovms::update_ovms_config, ovms::reload_ovms_config, ovms::run_ovms_with_config, ovms::download_ovms_model, ovms::debug_ovms_paths, ovms::clean_ovms_installation, ovms::load_model, ovms::unload_model, ovms::get_loaded_model, ovms::chat_with_loaded_model, ovms::check_ovms_status, ovms::get_ovms_model_metadata, tests::test_openvino_search, tests::test_model_loading, tests::test_model_workflow, tests::show_model_commands, tests::test_download_paths])
        .setup(|app| {
            let app_handle = app.handle().clone();
            // Start OVMS server on app startup
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ovms::start_ovms_server(&app_handle).await {
                    eprintln!("Failed to start OVMS server: {}", e);
                } else {
                    println!("OVMS server started successfully on app startup");
                }
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
