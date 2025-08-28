use serde::{ Deserialize, Serialize };
use tracing::{ info, warn, error };
use std::path::PathBuf;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

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
    // The search API uses "createdAt" instead of "created_at"
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "lastModified")]
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
    total_downloaded_so_far: u64,
    total_estimated_size: u64,
    app: &tauri::AppHandle
) -> Result<u64, String> {
    use futures::StreamExt;

    // Create subdirectories if needed (async)
    let target_file = target_dir.join(&file_info.path);
    if let Some(parent) = target_file.parent() {
        tokio::fs
            ::create_dir_all(parent).await
            .map_err(|e| format!("Failed to create directory for {}: {}", file_info.path, e))?;
    }

    // Start the request
    let response = client
        .get(file_url)
        .header("User-Agent", "SparrowAI/1.0")
        .send().await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error {}", response.status()));
    }

    // Get content length for progress tracking
    let content_length = response.content_length().unwrap_or(0);

    // Create the file
    let mut file = tokio::fs::File
        ::create(&target_file).await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    // Stream the response body in chunks to avoid loading entire file into memory
    let mut stream = response.bytes_stream();
    let mut downloaded = 0u64;
    let mut last_progress_emit = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;

        // Write chunk to file
        file.write_all(&chunk).await.map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        // Emit progress events, but not too frequently to avoid overwhelming the UI
        if last_progress_emit.elapsed().as_millis() > 100 || downloaded == content_length {
            let file_progress = if content_length > 0 {
                (((downloaded as f64) / (content_length as f64)) * 100.0) as u32
            } else {
                0
            };

            // Calculate overall progress based on total downloaded bytes across all files
            let total_downloaded_bytes = total_downloaded_so_far + downloaded;
            let overall_progress = if total_estimated_size > 0 {
                (((total_downloaded_bytes as f64) / (total_estimated_size as f64)) * 100.0) as u32
            } else {
                // Fallback to file-based progress if no size info
                (((file_index as f64) / (total_files as f64)) * 100.0) as u32
            };

            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                "modelId": model_id,
                "progress": overall_progress.min(100), // Cap at 100%
                "currentFile": file_info.path,
                "fileIndex": file_index,
                "totalFiles": total_files,
                "fileProgress": file_progress,
                "downloadedBytes": total_downloaded_bytes,
                "totalBytes": total_estimated_size,
                "currentFileDownloaded": downloaded,
                "currentFileTotal": content_length
            })
            );

            last_progress_emit = std::time::Instant::now();
        }

        // Add a small yield to prevent blocking the async runtime
        tokio::task::yield_now().await;
    }

    // Ensure all data is written to disk
    file.flush().await.map_err(|e| format!("Failed to flush file: {}", e))?;

    Ok(downloaded)
}

#[tauri::command]
pub async fn search_models(query: String, limit: Option<u32>) -> Result<SearchResult, String> {
    let client = reqwest::Client::new();
    let search_limit = limit.unwrap_or(10).min(10);

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
        .send().await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API request failed with status: {}", response.status()));
    }

    let hf_models: Vec<HfModelInfo> = response
        .json().await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Filter to only include OpenVINO models and optionally filter by query
    let model_ids: Vec<String> = hf_models
        .into_iter()
        .filter(|hf_model| {
            // Ensure the model is from OpenVINO organization
            hf_model.id.starts_with("OpenVINO/") &&
                // If there's a specific query, check if the model name contains it
                (query.trim().is_empty() ||
                    hf_model.id.to_lowercase().contains(&query.to_lowercase()))
        })
        .map(|hf_model| hf_model.id)
        .collect();

    // Get detailed info for each model
    let mut models: Vec<ModelInfo> = Vec::new();
    for model_id in &model_ids {
        match get_model_info(model_id.clone()).await {
            Ok(model_info) => models.push(model_info),
            Err(e) => {
                warn!(model_id = %model_id, error = %e, "Failed to get info for model");
                // Continue with other models instead of failing entirely
            }
        }
    }

    let total_count = models.len() as u64;

    Ok(SearchResult {
        models,
        total_count: Some(total_count),
    })
}

#[tauri::command]
pub async fn get_model_info(model_id: String) -> Result<ModelInfo, String> {
    let client = reqwest::Client::new();

    // Ensure we're getting info for an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };

    let url = format!(
        "https://huggingface.co/api/models/{}",
        urlencoding::encode(&normalized_model_id)
    );

    let response = client
        .get(&url)
        .header("User-Agent", "SparrowAI/1.0")
        .send().await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        return Err(
            format!(
                "API request failed with status: {}. Make sure the model exists under OpenVINO organization.",
                response.status()
            )
        );
    }

    let hf_model: HfModelInfo = response
        .json().await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelUpdateInfo {
    pub model_id: String,
    pub is_latest: bool,
    pub local_commit: Option<String>,
    pub remote_commit: Option<String>,
    pub needs_update: bool,
}

// Function to write commit SHA to .commit_id file
async fn write_commit_id(model_dir: &PathBuf, commit_sha: &str) -> Result<(), String> {
    let commit_file = model_dir.join(".commit_id");
    tokio::fs
        ::write(&commit_file, commit_sha).await
        .map_err(|e|
            format!("Failed to write commit ID to {}: {}", commit_file.to_string_lossy(), e)
        )?;

    info!(
        model_dir = %model_dir.to_string_lossy(),
        commit_sha = %commit_sha,
        "Wrote commit ID to .commit_id file"
    );

    Ok(())
}

// Function to read commit SHA from .commit_id file
async fn read_commit_id(model_dir: &PathBuf) -> Result<String, String> {
    let commit_file = model_dir.join(".commit_id");

    if !commit_file.exists() {
        return Err("No .commit_id file found".to_string());
    }

    let commit_sha = tokio::fs
        ::read_to_string(&commit_file).await
        .map_err(|e|
            format!("Failed to read commit ID from {}: {}", commit_file.to_string_lossy(), e)
        )?;

    Ok(commit_sha.trim().to_string())
}

#[tauri::command]
pub async fn check_model_update_status(
    model_id: String,
    models_dir: Option<String>
) -> Result<ModelUpdateInfo, String> {
    // Ensure we're checking an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };

    // Determine model directory
    let model_dir = if let Some(dir) = models_dir {
        PathBuf::from(dir).join(&normalized_model_id)
    } else {
        let home_dir = std::env
            ::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map_err(|e| format!("Failed to get user home directory: {}", e))?;
        PathBuf::from(home_dir).join(".sparrow").join("models").join(&normalized_model_id)
    };

    // Check if model directory exists
    if !model_dir.exists() {
        return Err(format!("Model directory not found: {}", model_dir.to_string_lossy()));
    }

    // Read local commit SHA
    let local_commit = match read_commit_id(&model_dir).await {
        Ok(sha) => Some(sha),
        Err(_) => {
            warn!(
                model_id = %normalized_model_id,
                "No .commit_id file found for model"
            );
            None
        }
    };

    // Get remote model info to check latest commit
    let remote_model_info = get_model_info(normalized_model_id.clone()).await?;
    let remote_commit = remote_model_info.sha;

    // Determine if update is needed
    let needs_update = match (&local_commit, &remote_commit) {
        (Some(local), Some(remote)) => local != remote,
        (None, Some(_)) => true, // No local commit info, assume update needed
        (Some(_), None) => false, // Remote has no commit info, assume local is fine
        (None, None) => false, // Neither has commit info, assume no update needed
    };

    let is_latest = !needs_update;

    Ok(ModelUpdateInfo {
        model_id: normalized_model_id,
        is_latest,
        local_commit,
        remote_commit,
        needs_update,
    })
}

#[tauri::command]
pub async fn download_entire_model(
    model_id: String,
    download_path: Option<String>,
    app: tauri::AppHandle
) -> Result<String, String> {
    // Ensure we're downloading an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id
    } else {
        format!("OpenVINO/{}", model_id)
    };

    // Get model info first to retrieve commit SHA
    let model_info = get_model_info(normalized_model_id.clone()).await?;

    // Create a client with timeout to prevent hanging
    let client = reqwest::Client
        ::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout per request
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let target_dir = if let Some(path) = download_path {
        PathBuf::from(path).join(&normalized_model_id)
    } else {
        // Use .sparrow/models as default
        let home_dir = std::env
            ::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map_err(|e| format!("Failed to get user home directory: {}", e))?;
        PathBuf::from(home_dir).join(".sparrow").join("models").join(&normalized_model_id)
    };

    // Create target directory
    std::fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create directory: {}", e))?;

    // First, get the list of files in the repository
    let files_url = format!(
        "https://huggingface.co/api/models/{}/tree/main",
        urlencoding::encode(&normalized_model_id)
    );

    let files_response = client
        .get(&files_url)
        .header("User-Agent", "SparrowAI/1.0")
        .send().await
        .map_err(|e| format!("Failed to fetch file list: {}", e))?;

    if !files_response.status().is_success() {
        return Err(
            format!(
                "Failed to fetch file list. Status: {}. The model might be private or not exist.",
                files_response.status()
            )
        );
    }

    let files: Vec<HfFileInfo> = files_response
        .json().await
        .map_err(|e| format!("Failed to parse file list: {}", e))?;

    let mut downloaded_files = Vec::new();
    let mut errors = Vec::new();
    let mut total_downloaded_size = 0u64;

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

    let total_size_gb = (total_estimated_size as f64) / (1024.0 * 1024.0 * 1024.0);

    if total_size_gb > 10.0 {
        eprintln!(
            "Warning: Large model detected ({:.1} GB). This may take a while and use significant disk space.",
            total_size_gb
        );
    }

    // Sort files by size (smallest first) to get quick wins early
    downloadable_files.sort_by_key(|f| f.size.unwrap_or(0));

    let total_files = downloadable_files.len();

    for (index, file_info) in downloadable_files.iter().enumerate() {
        let file_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            urlencoding::encode(&normalized_model_id),
            urlencoding::encode(&file_info.path)
        );

        // Add error recovery wrapper
        let download_result = download_single_file(
            &client,
            &file_url,
            &target_dir,
            file_info,
            &normalized_model_id,
            index + 1,
            total_files,
            total_downloaded_size,
            total_estimated_size,
            &app
        ).await;

        match download_result {
            Ok(file_size) => {
                downloaded_files.push(file_info.path.clone());
                total_downloaded_size += file_size;
            }
            Err(e) => {
                let error_msg = format!("Failed to download {}: {}", file_info.path, e);
                error!(error = %error_msg, "Model download failed");
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

    // Write commit ID to .commit_id file after successful download
    if let Some(commit_sha) = &model_info.sha {
        if let Err(e) = write_commit_id(&target_dir, commit_sha).await {
            warn!(
                error = %e,
                model_id = %normalized_model_id,
                "Failed to write commit ID file"
            );
        }
    } else {
        warn!(
            model_id = %normalized_model_id,
            "No commit SHA available for model"
        );
    }

    let total_size_mb = (total_downloaded_size as f64) / (1024.0 * 1024.0);
    let success_msg = format!(
        "Successfully downloaded {} files ({:.2} MB) to:\n{}\n\nDownloaded files:\n• {}",
        downloaded_files.len(),
        total_size_mb,
        target_dir.to_string_lossy(),
        downloaded_files.join("\n• ")
    );

    // Generate graph.pbtxt for OVMS compatibility
    if let Err(e) = crate::ovms::generate_ovms_graph(&target_dir, &normalized_model_id) {
        warn!(error = %e, "Failed to generate graph.pbtxt");
    } else {
        info!(model_id = %normalized_model_id, "graph.pbtxt generated for model");
    }

    if !errors.is_empty() {
        Ok(
            format!(
                "{}\n\n⚠️ Some files had issues ({} errors):\n{}",
                success_msg,
                errors.len(),
                errors.join("\n")
            )
        )
    } else {
        Ok(success_msg)
    }
}
