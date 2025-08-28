use std::fs;
use std::io::{ Write, Read };
use std::path::PathBuf;
use std::process::{ Command, Stdio, Child };
use std::sync::{ Arc, Mutex };
use zip::ZipArchive;
use serde_json::{ json, Value };
use serde::{ Deserialize, Serialize };
use tauri::AppHandle;
use tracing::{ info, warn, error, debug };

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OvmsStatus {
    pub status: String,
    pub loaded_models: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ModelVersionStatus {
    version: String,
    state: String,
    status: ModelStatus,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ModelStatus {
    error_code: String,
    error_message: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ModelInfo {
    model_version_status: Vec<ModelVersionStatus>,
}

const OVMS_DOWNLOAD_URL: &str =
    "https://github.com/openvinotoolkit/model_server/releases/download/v2025.2.1/ovms_windows_python_off.zip";
const OVMS_ZIP_FILE: &str = "ovms_windows_python_off.zip";

// Global OVMS process management
static OVMS_PROCESS: std::sync::OnceLock<Arc<Mutex<Option<Child>>>> = std::sync::OnceLock::new();

// Global loaded model state
pub static LOADED_MODEL: std::sync::OnceLock<Arc<Mutex<Option<String>>>> = std::sync::OnceLock::new();

pub fn get_sparrow_dir(_app_handle: Option<&AppHandle>) -> PathBuf {
    // Get the base .sparrow directory
    let home_dir = std::env
        ::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home_dir).join(".sparrow")
}

pub fn get_ovms_dir(app_handle: Option<&AppHandle>) -> PathBuf {
    // OVMS directory is .sparrow/ovms
    get_sparrow_dir(app_handle).join("ovms")
}

pub fn get_ovms_config_path(app_handle: Option<&AppHandle>) -> PathBuf {
    get_ovms_dir(app_handle).join("models_config.json")
}

pub fn get_ovms_exe_path(app_handle: Option<&AppHandle>) -> PathBuf {
    // With the new extraction method, ovms.exe is directly in the ovms folder
    get_ovms_dir(app_handle).join("ovms.exe")
}

#[allow(dead_code)]
pub fn create_minimal_test_config(config_path: &PathBuf) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = config_path.parent() {
        fs
            ::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }

    // Create a minimal empty configuration that OVMS can parse
    let config = json!({
        "mediapipe_config_list": [],
        "model_config_list": []
    });

    let config_str = serde_json
        ::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(config_path, config_str).map_err(|e| format!("Failed to write config file: {}", e))?;

    info!(config_path = %config_path.display(), "Created minimal OVMS config");
    Ok(())
}

pub fn validate_ovms_config(config_path: &PathBuf) -> Result<(), String> {
    if !config_path.exists() {
        return Err(format!("Config file does not exist: {}", config_path.display()));
    }

    if !config_path.is_file() {
        return Err(format!("Config path is not a file: {}", config_path.display()));
    }

    // Read and validate JSON structure
    let config_str = fs
        ::read_to_string(config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let config: Value = serde_json
        ::from_str(&config_str)
        .map_err(|e| format!("Invalid JSON in config file: {}", e))?;

    // Check for required fields
    if !config.is_object() {
        return Err("Config must be a JSON object".to_string());
    }

    if config.get("model_config_list").is_none() {
        return Err("Config must contain 'model_config_list' field".to_string());
    }

    if !config["model_config_list"].is_array() {
        return Err("'model_config_list' must be an array".to_string());
    }

    if config.get("mediapipe_config_list").is_none() {
        return Err("Config must contain 'mediapipe_config_list' field".to_string());
    }

    if !config["mediapipe_config_list"].is_array() {
        return Err("'mediapipe_config_list' must be an array".to_string());
    }

    info!(config_path = %config_path.display(), "OVMS config validation passed");
    Ok(())
}

#[tauri::command]
pub async fn download_ovms(app_handle: AppHandle) -> Result<String, String> {
    let sparrow_dir = get_sparrow_dir(Some(&app_handle));
    let ovms_dir = get_ovms_dir(Some(&app_handle));

    // Create both directories if they don't exist
    if !sparrow_dir.exists() {
        fs
            ::create_dir_all(&sparrow_dir)
            .map_err(|e| format!("Failed to create .sparrow directory: {}", e))?;
    }
    if !ovms_dir.exists() {
        fs
            ::create_dir_all(&ovms_dir)
            .map_err(|e| format!("Failed to create ovms directory: {}", e))?;
    }

    // Download zip to .sparrow root directory
    let zip_path = sparrow_dir.join(OVMS_ZIP_FILE);

    // Check if OVMS executable already exists
    let ovms_exe = get_ovms_exe_path(Some(&app_handle));
    if ovms_exe.exists() {
        return Ok("OVMS already downloaded and extracted".to_string());
    }

    // Remove any existing corrupted zip file
    if zip_path.exists() {
        if let Err(e) = fs::remove_file(&zip_path) {
            warn!(error = %e, "Failed to remove existing zip file");
        } else {
            info!("Removed existing zip file for fresh download");
        }
    }

    // Download the file with retry logic and better error handling
    let client = reqwest::Client
        ::builder()
        .user_agent("intel-ai-corebuilder/0.1.0")
        .timeout(std::time::Duration::from_secs(600)) // 10 minute timeout
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    info!(url = %OVMS_DOWNLOAD_URL, "Starting OVMS download");

    let mut retries = 3;

    while retries > 0 {
        match download_and_validate(&client, &zip_path).await {
            Ok(_bytes) => {
                break;
            }
            Err(e) => {
                retries -= 1;
                warn!(error = %e, attempts_left = retries, "Download attempt failed");

                // Remove corrupted file if it exists
                if zip_path.exists() {
                    let _ = fs::remove_file(&zip_path);
                }

                if retries == 0 {
                    return Err(format!("Failed to download OVMS after 3 attempts: {}", e));
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        }
    }

    info!("Download completed successfully, extracting...");

    // Extract the zip file to ovms directory
    extract_ovms(&zip_path, &ovms_dir)?;

    // Clean up the zip file after successful extraction
    if zip_path.exists() {
        if let Err(e) = fs::remove_file(&zip_path) {
            warn!(zip_path = %zip_path.display(), error = %e, "Failed to remove zip file");
        } else {
            info!(zip_path = %zip_path.display(), "Successfully cleaned up zip file");
        }
    }

    Ok("OVMS downloaded and extracted successfully".to_string())
}

async fn download_and_validate(
    client: &reqwest::Client,
    zip_path: &PathBuf
) -> Result<Vec<u8>, String> {
    let response = client
        .get(OVMS_DOWNLOAD_URL)
        .send().await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    // Get content length for validation
    let expected_length = response.content_length();
    if let Some(length) = expected_length {
        info!(size_mb = length / 1024 / 1024, "Downloading OVMS");
    }

    let bytes = response
        .bytes().await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    // Validate content length if provided
    if let Some(expected) = expected_length {
        if (bytes.len() as u64) != expected {
            return Err(
                format!(
                    "Downloaded size mismatch: expected {} bytes, got {} bytes",
                    expected,
                    bytes.len()
                )
            );
        }
    }

    // Validate that it's a valid ZIP file before writing
    validate_zip_bytes(&bytes)?;

    info!("Download validation passed, writing to file...");

    // Write to file
    let mut file = fs::File
        ::create(zip_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;

    file.write_all(&bytes).map_err(|e| format!("Failed to write zip file: {}", e))?;

    Ok(bytes.into())
}

fn validate_zip_bytes(bytes: &[u8]) -> Result<(), String> {
    use std::io::Cursor;

    // Check if it starts with ZIP magic number
    if bytes.len() < 4 {
        return Err("File too small to be a valid ZIP".to_string());
    }

    // ZIP files start with "PK" (0x504B)
    if &bytes[0..2] != b"PK" {
        return Err("Invalid ZIP file signature".to_string());
    }

    // Try to open as ZIP archive to validate structure
    let cursor = Cursor::new(bytes);
    match zip::ZipArchive::new(cursor) {
        Ok(archive) => {
            if archive.len() == 0 {
                return Err("ZIP file is empty".to_string());
            }
            info!(file_count = archive.len(), "ZIP validation passed");
            Ok(())
        }
        Err(e) => Err(format!("Invalid ZIP file structure: {}", e)),
    }
}

pub fn extract_ovms(zip_path: &PathBuf, extract_to: &PathBuf) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;

    let mut archive = ZipArchive::new(file).map_err(|e|
        format!("Failed to read zip archive: {}", e)
    )?;

    info!(file_count = archive.len(), "Extracting files from archive");

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file {} from archive: {}", i, e))?;

        let file_name = file.name();
        debug!(file_name = %file_name, "Extracting file");

        // Skip directories (they end with '/')
        if file_name.ends_with('/') {
            continue;
        }

        // Strip the root directory from the path
        let relative_path = if let Some(slash_pos) = file_name.find('/') {
            &file_name[slash_pos + 1..]
        } else {
            file_name
        };

        // Skip if the relative path is empty
        if relative_path.is_empty() {
            continue;
        }

        let outpath = extract_to.join(relative_path);

        // Create parent directories if needed
        if let Some(p) = outpath.parent() {
            if !p.exists() {
                fs
                    ::create_dir_all(p)
                    .map_err(|e|
                        format!("Failed to create parent directory {}: {}", p.display(), e)
                    )?;
            }
        }

        // Extract the file
        let mut outfile = fs::File
            ::create(&outpath)
            .map_err(|e| format!("Failed to create output file {}: {}", outpath.display(), e))?;

        std::io
            ::copy(&mut file, &mut outfile)
            .map_err(|e| format!("Failed to extract file {}: {}", outpath.display(), e))?;

        debug!(output_path = %outpath.display(), "File extracted");
    }

    info!("Extraction completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn create_ovms_config(
    app_handle: AppHandle,
    model_name: String,
    model_path: String
) -> Result<String, String> {
    // Always include both BGE models as the first entries
    let home_dir = std::env
        ::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let bge_reranker_path = PathBuf::from(&home_dir)
        .join(".sparrow")
        .join("models")
        .join("OpenVINO")
        .join("bge-reranker-base-int8-ov");
    let bge_base_path = PathBuf::from(&home_dir)
        .join(".sparrow")
        .join("models")
        .join("OpenVINO")
        .join("bge-base-en-v1.5-int8-ov");

    let mut mediapipe_configs = vec![
        json!({
            "name": "bge-reranker-base-int8-ov",
            "base_path": bge_reranker_path.to_string_lossy().replace('\\', "/")
        }),
        json!({
            "name": "bge-base-en-v1.5-int8-ov",
            "base_path": bge_base_path.to_string_lossy().replace('\\', "/")
        })
    ];

    // Add the provided model if it's not one of the BGE models
    if model_name != "bge-reranker-base-int8-ov" && model_name != "bge-base-en-v1.5-int8-ov" {
        mediapipe_configs.push(
            json!({
            "name": model_name,
            "base_path": model_path.replace('\\', "/")
        })
        );
    }

    let config =
        json!({
        "mediapipe_config_list": mediapipe_configs,
        "model_config_list": []
    });

    let config_str = serde_json
        ::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    let config_path = get_ovms_config_path(Some(&app_handle));
    fs::write(&config_path, config_str).map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok("OVMS configuration file created successfully".to_string())
}

#[tauri::command]
pub async fn update_ovms_config(
    app_handle: AppHandle,
    model_name: String,
    model_path: String
) -> Result<String, String> {
    let config_path = get_ovms_config_path(Some(&app_handle));

    // Read existing config or create new one
    let mut config: Value = if config_path.exists() {
        let config_str = fs
            ::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;
        serde_json
            ::from_str(&config_str)
            .map_err(|e| format!("Failed to parse config file: {}", e))?
    } else {
        json!({
            "mediapipe_config_list": [],
            "model_config_list": []
        })
    };

    // Normalize the model_path to use forward slashes for OVMS
    let normalized_model_path = model_path.replace('\\', "/");

    // Always ensure both BGE models are present
    let home_dir = std::env
        ::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let bge_reranker_path = PathBuf::from(&home_dir)
        .join(".sparrow")
        .join("models")
        .join("OpenVINO")
        .join("bge-reranker-base-int8-ov");
    let bge_base_path = PathBuf::from(&home_dir)
        .join(".sparrow")
        .join("models")
        .join("OpenVINO")
        .join("bge-base-en-v1.5-int8-ov");

    if let Some(model_list) = config["mediapipe_config_list"].as_array_mut() {
        // Check which BGE models already exist and find the third model index
        let mut has_bge_reranker = false;
        let mut has_bge_base = false;
        let mut third_model_index = None;
        let mut found_target_model = false;

        for (index, model) in model_list.iter_mut().enumerate() {
            if let Some(name) = model["name"].as_str() {
                if name == "bge-reranker-base-int8-ov" {
                    has_bge_reranker = true;
                    // Update the path in case it changed
                    model["base_path"] = json!(
                        bge_reranker_path.to_string_lossy().replace('\\', "/")
                    );
                } else if name == "bge-base-en-v1.5-int8-ov" {
                    has_bge_base = true;
                    // Update the path in case it changed
                    model["base_path"] = json!(bge_base_path.to_string_lossy().replace('\\', "/"));
                } else if name == model_name {
                    // Target model already exists, just update its path
                    model["base_path"] = json!(normalized_model_path);
                    found_target_model = true;
                } else {
                    // This is a third model (not BGE models)
                    if third_model_index.is_none() {
                        third_model_index = Some(index);
                    }
                }
            }
        }

        // Add missing BGE models (always as first entries)
        let mut insert_index = 0;
        if !has_bge_reranker {
            model_list.insert(
                insert_index,
                json!({
                "name": "bge-reranker-base-int8-ov",
                "base_path": bge_reranker_path.to_string_lossy().replace('\\', "/")
            })
            );
            insert_index += 1;
        }
        if !has_bge_base {
            model_list.insert(
                insert_index,
                json!({
                "name": "bge-base-en-v1.5-int8-ov",
                "base_path": bge_base_path.to_string_lossy().replace('\\', "/")
            })
            );
        }

        // Handle the third model if the target model is not one of the BGE models
        if
            !found_target_model &&
            model_name != "bge-reranker-base-int8-ov" &&
            model_name != "bge-base-en-v1.5-int8-ov"
        {
            let new_model_config =
                json!({
                "name": model_name,
                "base_path": normalized_model_path
            });

            if let Some(third_index) = third_model_index {
                // Replace the existing third model
                model_list[third_index] = new_model_config;
            } else {
                // No third model exists, add it
                model_list.push(new_model_config);
            }
        }
    }

    let config_str = serde_json
        ::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, config_str).map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok("OVMS configuration updated successfully".to_string())
}

#[tauri::command]
pub async fn reload_ovms_config() -> Result<String, String> {
    let client = reqwest::Client::new();

    let response = client
        .post("http://localhost:1114/v1/config/reload")
        .send().await
        .map_err(|e| format!("Failed to send reload request: {}", e))?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        Ok(format!("Config reloaded successfully: {}", body))
    } else {
        Err(format!("Config reload failed with status: {}", response.status()))
    }
}

// Check if OVMS is present on the system (Tauri command)
#[tauri::command]
pub async fn check_ovms_present(app_handle: AppHandle) -> Result<bool, String> {
    Ok(is_ovms_present(Some(&app_handle)))
}

// Check if OVMS is present on the system (internal function)
pub fn is_ovms_present(app_handle: Option<&AppHandle>) -> bool {
    let ovms_exe = get_ovms_exe_path(app_handle);
    info!(ovms_path = %ovms_exe.display(), "Checking for OVMS");

    ovms_exe.exists() && ovms_exe.is_file()
}

#[tauri::command]
pub async fn start_ovms_server(app_handle: AppHandle) -> Result<String, String> {
    info!("OVMS server start command initiated");
    // Check if OVMS is already running
    match check_ovms_status().await {
        Ok(ovms_status) => {
            info!(loaded_models = ?ovms_status.loaded_models, "OVMS server is already running");
            return Ok("OVMS server is already running".to_string());
        }
        Err(_) => {
            info!("OVMS not running, starting server...");
        }
    }

    let ovms_exe = get_ovms_exe_path(Some(&app_handle));
    let config_path = get_ovms_config_path(Some(&app_handle));

    // // Create minimal config if it doesn't exist
    // if !config_path.exists() {
    //     create_minimal_test_config(&config_path)?;
    // }

    // Validate config
    validate_ovms_config(&config_path)?;

    info!("Starting OVMS server...");

    // Start OVMS process
    let mut cmd = Command::new(&ovms_exe);
    cmd.args([
        "--config_path",
        &config_path.to_string_lossy(),
        "--rest_port",
        "1114",
        "--log_level",
        "INFO",
    ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start OVMS: {}", e))?;

    // Wait a moment for server to start
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Check if process is still running before storing it
    match child.try_wait() {
        Ok(Some(status)) => {
            // Process exited
            let mut stderr_output = String::new();
            let mut stdout_output = String::new();

            if let Some(mut stderr) = child.stderr.take() {
                stderr.read_to_string(&mut stderr_output).unwrap_or_default();
            }

            if let Some(mut stdout) = child.stdout.take() {
                stdout.read_to_string(&mut stdout_output).unwrap_or_default();
            }

            let error_msg = format!(
                "OVMS exited with status: {}\nSTDOUT: {}\nSTDERR: {}\nConfig: {}\nExecutable: {}",
                status,
                stdout_output.trim(),
                stderr_output.trim(),
                config_path.display(),
                ovms_exe.display()
            );

            error!(error = %error_msg, "OVMS startup failed");
            Err(error_msg)
        }
        Ok(None) => {
            // Process is still running, store it globally
            // Scope the mutex guard properly to avoid Send issues
            {
                let process_mutex = OVMS_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)));
                let mut process_guard = process_mutex.lock().unwrap();
                *process_guard = Some(child);
            } // Guard is dropped here

            info!("OVMS server started on port 1114");

            Ok("OVMS server started successfully.".to_string())
        }
        Err(e) => { Err(format!("Failed to check OVMS status: {}", e)) }
    }
}

// Stop OVMS server
pub fn stop_ovms_server() -> Result<(), String> {
    let process_mutex = OVMS_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)));
    let mut process_guard = process_mutex.lock().unwrap();

    if let Some(mut child) = process_guard.take() {
        info!("Stopping OVMS server...");

        // Try to terminate gracefully first
        if let Err(e) = child.kill() {
            error!(error = %e, "Failed to kill OVMS process");
        }

        // Wait for the process to exit
        match child.wait() {
            Ok(status) => {
                info!(exit_status = ?status, "OVMS server stopped");
            }
            Err(e) => {
                error!(error = %e, "Error waiting for OVMS process to exit");
            }
        }
    } else {
        info!("No OVMS process was running");
    }

    // Also try the system-wide kill as fallback
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/IM", "ovms.exe", "/F"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill").args(["-f", "ovms"]).output();
    }

    Ok(())
}

// Load a model into OVMS
#[tauri::command]
pub async fn load_model(app_handle: AppHandle, model_id: String) -> Result<String, String> {
    // Check if a model is already loaded
    let loaded_model_mutex = LOADED_MODEL.get_or_init(|| Arc::new(Mutex::new(None)));

    // Check current state and release lock immediately
    {
        let loaded_model_guard = loaded_model_mutex.lock().unwrap();
        if loaded_model_guard.is_some() {
            return Err("A model is already loaded. Please unload it first.".to_string());
        }
    }

    // Ensure we're working with an OpenVINO model
    let normalized_model_id = if model_id.starts_with("OpenVINO/") {
        model_id.clone()
    } else {
        format!("OpenVINO/{}", model_id)
    };

    // Get the model path using .sparrow/models as default
    // Use the original model_id for path construction to preserve backslashes
    let home_dir = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        Ok(home) => home,
        Err(_) => {
            return Err("Failed to get user home directory".to_string());
        }
    };

    // Build the path using the original model_id structure (with backslashes on Windows)
    let original_model_id = if model_id.starts_with("OpenVINO") {
        model_id.clone()
    } else {
        format!("OpenVINO/{}", model_id)
    };

    let model_path = PathBuf::from(home_dir)
        .join(".sparrow")
        .join("models")
        .join(&original_model_id);

    if !model_path.exists() {
        return Err(
            format!(
                "Model not found at: {}. Please download the model first.",
                model_path.display()
            )
        );
    }

    // Extract model name from the full ID (use forward slash version for model name)
    let model_name = normalized_model_id.split('/').next_back().unwrap_or(&normalized_model_id);

    // Update OVMS config with the model (use the actual Windows path)
    update_ovms_config(
        app_handle.clone(),
        model_name.to_string(),
        model_path.to_string_lossy().to_string()
    ).await?;

    // Reload OVMS config
    reload_ovms_config().await?;

    // Mark the model as loaded (use the forward slash version for consistency)
    {
        let mut loaded_model_guard = loaded_model_mutex.lock().unwrap();
        *loaded_model_guard = Some(normalized_model_id.clone());
    }

    Ok(format!("Model '{}' loaded successfully", normalized_model_id))
}

// Unload the currently loaded model
#[tauri::command]
pub async fn unload_model(_app_handle: AppHandle) -> Result<String, String> {
    let loaded_model_mutex = LOADED_MODEL.get_or_init(|| Arc::new(Mutex::new(None)));

    // Get the model ID and clear it
    let model_id = {
        let mut loaded_model_guard = loaded_model_mutex.lock().unwrap();
        loaded_model_guard.take()
    };

    if let Some(model_id) = model_id {
        // Create empty config
        // create_minimal_test_config(&get_ovms_config_path(Some(&app_handle)))?;

        // Reload OVMS config
        reload_ovms_config().await?;

        Ok(format!("Model '{}' unloaded successfully", model_id))
    } else {
        Err("No model is currently loaded".to_string())
    }
}

// Get the currently loaded model
#[tauri::command]
pub async fn get_loaded_model() -> Result<Option<String>, String> {
    let loaded_model_mutex = LOADED_MODEL.get_or_init(|| Arc::new(Mutex::new(None)));
    let loaded_model_guard = loaded_model_mutex.lock().unwrap();
    Ok(loaded_model_guard.clone())
}

#[tauri::command]
pub async fn check_ovms_status() -> Result<OvmsStatus, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("http://localhost:1114/v1/config")
        .send().await
        .map_err(|e| format!("Failed to connect to OVMS server: {}", e))?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

        // Parse the JSON response to extract loaded models
        let json_value: Value = serde_json
            ::from_str(&body)
            .map_err(|e| format!("Failed to parse OVMS response JSON: {}", e))?;

        let mut loaded_models = Vec::new();

        // Extract model names from the JSON structure
        if let Some(config_obj) = json_value.as_object() {
            for (key, value) in config_obj {
                // Skip metadata keys
                if key.starts_with("_") {
                    continue;
                }

                // Skip BGE models (embedding and reranker models)
                if key.starts_with("bge") {
                    continue;
                }

                // Check if this is a model entry with model_version_status
                if let Some(model_info) = value.as_object() {
                    if let Some(version_status) = model_info.get("model_version_status") {
                        if let Some(status_array) = version_status.as_array() {
                            // Check if any version is AVAILABLE
                            let has_available = status_array.iter().any(|status| {
                                if let Some(status_obj) = status.as_object() {
                                    if let Some(state) = status_obj.get("state") {
                                        return state.as_str() == Some("AVAILABLE");
                                    }
                                }
                                false
                            });

                            if has_available {
                                loaded_models.push(key.clone());
                            }
                        }
                    }
                }
            }
        }

        Ok(OvmsStatus {
            status: "healthy".to_string(),
            loaded_models,
        })
    } else {
        Err(format!("OVMS status check failed with status: {}", response.status()))
    }
}

#[tauri::command]
pub async fn get_ovms_model_metadata(model_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Try to get model metadata for more detailed error information
    let metadata_url = format!("http://localhost:1114/v1/models/{}/metadata", model_name);
    let response = client
        .get(&metadata_url)
        .send().await
        .map_err(|e| format!("Failed to get model metadata: {}", e))?;

    if response.status().is_success() {
        let body = response
            .text().await
            .map_err(|e| format!("Failed to read metadata response: {}", e))?;
        Ok(body)
    } else {
        // If metadata fails, try the model status endpoint
        let status_url = format!("http://localhost:1114/v1/models/{}", model_name);
        let status_response = client
            .get(&status_url)
            .send().await
            .map_err(|e| format!("Failed to get model status: {}", e))?;

        let status_code = status_response.status();
        let status_body = status_response
            .text().await
            .map_err(|e| format!("Failed to read status response: {}", e))?;

        if status_code.is_success() {
            Ok(status_body)
        } else {
            Err(format!("Model {} status check failed: {}", model_name, status_body))
        }
    }
}

pub fn generate_ovms_graph(model_dir: &PathBuf, model_id: &str) -> Result<(), String> {
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

    // Check for tokenizer and detokenizer
    let tokenizer_name = xml_files
        .iter()
        .find(|name| name.contains("tokenizer") && !name.contains("detokenizer"));
    let detokenizer_name = xml_files.iter().find(|name| name.contains("detokenizer"));

    // Generate graph.pbtxt content based on model type
    let cache_dir = format!("{}/.ovms_cache", model_dir.to_string_lossy().replace('\\', "/"));
    let graph_content = if tokenizer_name.is_some() && detokenizer_name.is_some() {
        if model_name == "bge-reranker-base-int8-ov" {
            format!(
                r#"input_stream: "REQUEST_PAYLOAD:input"
output_stream: "RESPONSE_PAYLOAD:output"
node {{
  calculator: "OpenVINOModelServerSessionCalculator"
  output_side_packet: "SESSION:tokenizer"
  node_options: {{
    [type.googleapis.com / mediapipe.OpenVINOModelServerSessionCalculatorOptions]: {{
      servable_name: "tokenizer"
      servable_version: "1"
    }}
  }}
}}
node {{
  calculator: "OpenVINOModelServerSessionCalculator"
  output_side_packet: "SESSION:rerank"
  node_options: {{
    [type.googleapis.com / mediapipe.OpenVINOModelServerSessionCalculatorOptions]: {{
      servable_name: "rerank_model"
      servable_version: "1"
            }}
            }}
            }}
node {{
    input_side_packet: "TOKENIZER_SESSION:tokenizer"
    input_side_packet: "RERANK_SESSION:rerank"
    calculator: "RerankCalculator"
    input_stream: "REQUEST_PAYLOAD:input"
    output_stream: "RESPONSE_PAYLOAD:output"
            }}"#
            )
        } else if model_name == "bge-base-en-v1.5-int8-ov" {
            format!(
                r#"input_stream: "REQUEST_PAYLOAD:input"
output_stream: "RESPONSE_PAYLOAD:output"
node {{
  name: "EmbeddingsExecutor"
  input_side_packet: "EMBEDDINGS_NODE_RESOURCES:embeddings_servable"
  calculator: "EmbeddingsCalculatorOV"
  input_stream: "REQUEST_PAYLOAD:input"
  output_stream: "RESPONSE_PAYLOAD:output"
  node_options: {{
    [type.googleapis.com / mediapipe.EmbeddingsCalculatorOVOptions]: {{
      models_path: "./",
      normalize_embeddings: true,
      target_device: "GPU"
    }}
  }}
            }}"#
            )
        } else if model_name.ends_with("cw-ov") {
            format!(r#"input_stream: "HTTP_REQUEST_PAYLOAD:input"
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
                        plugin_config: '{{"CACHE_DIR": "{}"}}',
                        enable_prefix_caching: false,
                        cache_size: 2,
                        max_num_seqs: 256,
                        device: "NPU",
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
            "#, cache_dir)
        } else {
            format!(r#"input_stream: "HTTP_REQUEST_PAYLOAD:input"
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
                        plugin_config: '{{"CACHE_DIR": "{}"}}',
                        enable_prefix_caching: false,
                        cache_size: 2,
                        max_num_seqs: 256,
                        max_num_batched_tokens: 8192,
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
            "#, cache_dir)
        }
    } else {
        format!(
            r#"input_stream: "REQUEST_PAYLOAD:input"
output_stream: "RESPONSE_PAYLOAD:output"
node {{
    name: "LLMExecutor"
    calculator: "LLMCalculator"
    input_stream: "REQUEST_PAYLOAD:input"
    output_stream: "RESPONSE_PAYLOAD:output"
    input_side_packet: "LLM_NODE_RESOURCES:llm"
    node_options: {{
        [type.googleapis.com / mediapipe.LLMCalculatorOptions]: {{
            models_path: "./",
            target_device: "GPU"
        }}
    }}
}}"#
        )
    };

    let graph_path = model_dir.join("graph.pbtxt");
    std::fs
        ::write(&graph_path, graph_content)
        .map_err(|e| format!("Failed to write graph.pbtxt: {}", e))?;

    // Only print if model graph generation is successful
    println!("graph.pbtxt generated for model: {} at {}", model_name, graph_path.display());

    Ok(())
}
