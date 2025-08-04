use std::fs;
use std::io::{ Write, Read };
use std::path::PathBuf;
use std::process::{ Command, Stdio, Child };
use std::sync::{ Arc, Mutex };
use zip::ZipArchive;
use openai::chat::{ ChatCompletion, ChatCompletionMessage, ChatCompletionMessageRole };
use openai::Credentials;
use serde_json::{ json, Value };
use tauri::{ AppHandle, Emitter };

const OVMS_DOWNLOAD_URL: &str =
    "https://github.com/openvinotoolkit/model_server/releases/download/v2025.2.1/ovms_windows_python_off.zip";
const OVMS_ZIP_FILE: &str = "ovms_windows_python_off.zip";

// Global OVMS process management
static OVMS_PROCESS: std::sync::OnceLock<Arc<Mutex<Option<Child>>>> = std::sync::OnceLock::new();

// Global loaded model state
static LOADED_MODEL: std::sync::OnceLock<Arc<Mutex<Option<String>>>> = std::sync::OnceLock::new();

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

    println!("Created minimal OVMS config: {}", config_path.display());
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

    println!("OVMS config validation passed: {}", config_path.display());
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
            println!("Warning: Failed to remove existing zip file: {}", e);
        } else {
            println!("Removed existing zip file for fresh download");
        }
    }

    // Download the file with retry logic and better error handling
    let client = reqwest::Client
        ::builder()
        .user_agent("intel-ai-corebuilder/0.1.0")
        .timeout(std::time::Duration::from_secs(600)) // 10 minute timeout
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    println!("Starting OVMS download from: {}", OVMS_DOWNLOAD_URL);

    let mut retries = 3;

    while retries > 0 {
        match download_and_validate(&client, &zip_path).await {
            Ok(_bytes) => {
                break;
            }
            Err(e) => {
                retries -= 1;
                println!("Download attempt failed: {} ({} attempts left)", e, retries);

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

    println!("Download completed successfully, extracting...");

    // Extract the zip file to ovms directory
    extract_ovms(&zip_path, &ovms_dir)?;

    // Clean up the zip file after successful extraction
    if zip_path.exists() {
        if let Err(e) = fs::remove_file(&zip_path) {
            println!("Warning: Failed to remove zip file {}: {}", zip_path.display(), e);
        } else {
            println!("Successfully cleaned up zip file: {}", zip_path.display());
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
        println!("Downloading OVMS... Size: {} MB", length / 1024 / 1024);
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

    println!("Download validation passed, writing to file...");

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
            println!("ZIP validation passed: {} files in archive", archive.len());
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

    println!("Extracting {} files from archive...", archive.len());

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file {} from archive: {}", i, e))?;

        let file_name = file.name();
        println!("Extracting: {}", file_name);

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

        println!("Extracted: {}", outpath.display());
    }

    println!("Extraction completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn run_ovms(app_handle: AppHandle) -> Result<String, String> {
    let ovms_exe = get_ovms_exe_path(Some(&app_handle));
    let config_path = get_ovms_config_path(Some(&app_handle));

    if !ovms_exe.exists() {
        return Err(
            format!(
                "OVMS executable not found at: {}. Please download OVMS first.",
                ovms_exe.display()
            )
        );
    }

    // Check if the executable is actually a file and not a directory
    if !ovms_exe.is_file() {
        return Err(format!("OVMS path exists but is not a file: {}", ovms_exe.display()));
    }

    // On Windows, check if it's a .exe file
    #[cfg(target_os = "windows")]
    {
        if let Some(extension) = ovms_exe.extension() {
            if extension != "exe" {
                return Err(
                    format!("OVMS file is not an executable (.exe): {}", ovms_exe.display())
                );
            }
        } else {
            return Err(
                format!("OVMS file has no extension (should be .exe): {}", ovms_exe.display())
            );
        }
    }

    // Create config file with proper format
    println!("Creating OVMS config at: {}", config_path.display());
    create_minimal_test_config(&config_path)?;

    // Validate the configuration file
    if let Err(e) = validate_ovms_config(&config_path) {
        return Err(format!("Invalid OVMS configuration: {}", e));
    }

    // Run ovms.exe with config file
    let mut cmd = Command::new(&ovms_exe);
    cmd.args([
        "--config_path",
        &config_path.to_string_lossy(),
        "--rest_port",
        "8000",
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

    // Wait a moment for the server to start
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Check if process is still running
    match child.try_wait() {
        Ok(Some(status)) => {
            // Process has exited, capture both stdout and stderr
            let mut stderr_output = String::new();
            let mut stdout_output = String::new();

            if let Some(mut stderr) = child.stderr.take() {
                stderr.read_to_string(&mut stderr_output).unwrap_or_default();
            }

            if let Some(mut stdout) = child.stdout.take() {
                stdout.read_to_string(&mut stdout_output).unwrap_or_default();
            }

            let error_msg = format!(
                "OVMS exited with status: {}\nSTDOUT: {}\nSTDERR: {}\nConfig path: {}\nExecutable path: {}",
                status,
                stdout_output.trim(),
                stderr_output.trim(),
                config_path.display(),
                ovms_exe.display()
            );

            eprintln!("OVMS startup failed: {}", error_msg);
            Err(error_msg)
        }
        Ok(None) => {
            // Process is still running
            Ok("OVMS server started successfully with proper configuration format".to_string())
        }
        Err(e) => Err(format!("Failed to check OVMS status: {}", e)),
    }
}

#[tauri::command]
pub async fn create_ovms_config(
    app_handle: AppHandle,
    model_name: String,
    model_path: String
) -> Result<String, String> {
    let config =
        json!({
        "mediapipe_config_list": [
            {
                "name": model_name,
                "base_path": model_path
            }
        ],
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

    // Find and update existing model or add new one in mediapipe_config_list
    if let Some(model_list) = config["mediapipe_config_list"].as_array_mut() {
        let mut found = false;
        for model in model_list.iter_mut() {
            if let Some(name) = model["name"].as_str() {
                if name == model_name {
                    model["base_path"] = json!(normalized_model_path);
                    found = true;
                    break;
                }
            }
        }

        if !found {
            // Add new model
            model_list.push(
                json!({
                "name": model_name,
                "base_path": normalized_model_path
            })
            );
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
        .post("http://localhost:8000/v1/config/reload")
        .send().await
        .map_err(|e| format!("Failed to send reload request: {}", e))?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        Ok(format!("Config reloaded successfully: {}", body))
    } else {
        Err(format!("Config reload failed with status: {}", response.status()))
    }
}

#[tauri::command]
pub async fn run_ovms_with_config(app_handle: AppHandle) -> Result<String, String> {
    let ovms_exe = get_ovms_exe_path(Some(&app_handle));
    let config_path = get_ovms_config_path(Some(&app_handle));

    if !ovms_exe.exists() {
        return Err("OVMS executable not found. Please download OVMS first.".to_string());
    }

    if !config_path.exists() {
        return Err("OVMS configuration file not found. Please create one first.".to_string());
    }

    // Run ovms.exe with config file instead of individual parameters
    let mut cmd = Command::new(&ovms_exe);
    cmd.args([
        "--config_path",
        &config_path.to_string_lossy(),
        "--rest_port",
        "8000",
        "--file_system_poll_wait_seconds",
        "0", // Disable auto-reload for manual control
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

    // Wait a moment for the server to start
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Check if process is still running
    match child.try_wait() {
        Ok(Some(status)) => {
            let mut stderr = child.stderr.take().unwrap();
            let mut error_output = String::new();
            stderr.read_to_string(&mut error_output).unwrap_or_default();
            Err(format!("OVMS exited with status: {}, error: {}", status, error_output))
        }
        Ok(None) => {
            // Process is still running
            Ok("OVMS server started successfully with configuration file".to_string())
        }
        Err(e) => Err(format!("Failed to check OVMS status: {}", e)),
    }
}

#[tauri::command]
pub async fn download_ovms_model(
    app_handle: AppHandle,
    model_name: String
) -> Result<String, String> {
    let ovms_exe = get_ovms_exe_path(Some(&app_handle));
    let _config_path = get_ovms_config_path(Some(&app_handle));

    if !ovms_exe.exists() {
        return Err("OVMS executable not found. Please download OVMS first.".to_string());
    }

    // Create a temporary config with the model to download
    let temp_config =
        json!({
        "mediapipe_config_list": [
            {
                "name": model_name.clone(),
                "base_path": format!("model/{}", model_name)
            }
        ],
        "model_config_list": []
    });

    let temp_config_str = serde_json
        ::to_string_pretty(&temp_config)
        .map_err(|e| format!("Failed to serialize temp config: {}", e))?;

    let temp_config_path = get_ovms_dir(Some(&app_handle)).join("temp_download_config.json");
    fs
        ::write(&temp_config_path, temp_config_str)
        .map_err(|e| format!("Failed to write temp config file: {}", e))?;

    // Use OVMS to pull/download the model by starting it with the config
    println!("Starting OVMS model download for: {}", model_name);

    let mut cmd = Command::new(&ovms_exe);
    cmd.args([
        "--config_path",
        &temp_config_path.to_string_lossy(),
        "--rest_port",
        "8001", // Use different port to avoid conflicts
        "--log_level",
        "INFO",
        "--exit_after_model_load", // Exit after loading models (if supported)
    ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let child = cmd.spawn().map_err(|e| format!("Failed to start OVMS for model download: {}", e))?;

    // Wait for the process to complete (model download)
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for OVMS download process: {}", e))?;

    // Clean up temp config
    let _ = fs::remove_file(&temp_config_path);

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        println!("Model '{}' download completed.", model_name);
        if !stdout.trim().is_empty() {
            println!("OVMS STDOUT: {}", stdout.trim());
        }
        if !stderr.trim().is_empty() {
            eprintln!("OVMS STDERR: {}", stderr.trim());
        }

        // Update the main config with the downloaded model
        update_ovms_config(app_handle, model_name.clone(), format!("model/{}", model_name)).await?;

        Ok(format!("Model '{}' downloaded and added to configuration successfully", model_name))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Model download failed for '{}': {}", model_name, stderr))
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
    println!("Checking for OVMS at: {}", ovms_exe.display());

    ovms_exe.exists() && ovms_exe.is_file()
}

#[tauri::command]
pub async fn start_ovms_server(app_handle: AppHandle) -> Result<String, String> {
    // Check if OVMS is already running
    match check_ovms_status().await {
        Ok(_) => {
            println!("OVMS server is already running");
            return Ok("OVMS server is already running".to_string());
        }
        Err(_) => {
            println!("OVMS not running, starting server...");
        }
    }

    let ovms_exe = get_ovms_exe_path(Some(&app_handle));
    let config_path = get_ovms_config_path(Some(&app_handle));

    // Create minimal config if it doesn't exist
    if !config_path.exists() {
        create_minimal_test_config(&config_path)?;
    }

    // Validate config
    validate_ovms_config(&config_path)?;

    println!("Starting OVMS server...");

    // Start OVMS process
    let mut cmd = Command::new(&ovms_exe);
    cmd.args([
        "--config_path",
        &config_path.to_string_lossy(),
        "--rest_port",
        "8000",
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

            eprintln!("OVMS startup failed: {}", error_msg);
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

            println!("OVMS server started on port 8000.");

            // Verify the server is responding (now the guard is dropped)
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            match check_ovms_status().await {
                Ok(status) => {
                    println!("OVMS server health check: {}", status);
                }
                Err(e) => {
                    eprintln!("OVMS server health check failed: {}", e);
                    // Don't fail here as the process might still be starting up
                }
            }

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
        println!("Stopping OVMS server...");

        // Try to terminate gracefully first
        if let Err(e) = child.kill() {
            eprintln!("Failed to kill OVMS process: {}", e);
        }

        // Wait for the process to exit
        match child.wait() {
            Ok(status) => {
                println!("OVMS server stopped. Status: {}", status);
            }
            Err(e) => {
                eprintln!("Error waiting for OVMS process to exit: {}", e);
            }
        }
    } else {
        println!("No OVMS process was running.");
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
        let _ = Command::new("pkill").args(&["-f", "ovms"]).output();
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
        format!("OpenVINO\\{}", model_id) // Use backslash for Windows paths
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
pub async fn unload_model(app_handle: AppHandle) -> Result<String, String> {
    let loaded_model_mutex = LOADED_MODEL.get_or_init(|| Arc::new(Mutex::new(None)));

    // Get the model ID and clear it
    let model_id = {
        let mut loaded_model_guard = loaded_model_mutex.lock().unwrap();
        loaded_model_guard.take()
    };

    if let Some(model_id) = model_id {
        // Create empty config
        create_minimal_test_config(&get_ovms_config_path(Some(&app_handle)))?;

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

// Chat with the currently loaded model using streaming
#[tauri::command]
pub async fn chat_with_loaded_model_streaming(
    app: AppHandle,
    message: String,
    session_id: Option<String>,
    include_history: Option<bool>,
    system_prompt: Option<String>,
    temperature: Option<f64>,
    top_p: Option<f64>,
    seed: Option<u64>,
    max_tokens: Option<u32>,
    max_completion_tokens: Option<u32>
) -> Result<String, String> {
    // Check if a model is loaded and get its name
    let loaded_model_mutex = LOADED_MODEL.get_or_init(|| Arc::new(Mutex::new(None)));
    let model_name = {
        let loaded_model_guard = loaded_model_mutex.lock().unwrap();
        if loaded_model_guard.is_none() {
            return Err("No model is currently loaded. Please load a model first.".to_string());
        }
        let model_id = loaded_model_guard.as_ref().unwrap();
        model_id.split('/').next_back().unwrap_or(model_id).to_string()
    };

    println!("Chat using streaming model: {}", model_name);

    // Create the messages vector
    let system_message = system_prompt.unwrap_or_else(||
        "You're an AI assistant that provides helpful responses.".to_string()
    );

    let mut messages = vec![ChatCompletionMessage {
        role: ChatCompletionMessageRole::System,
        content: Some(system_message),
        ..Default::default()
    }];

    // Include conversation history if requested and session_id is provided
    if include_history.unwrap_or(false) && session_id.is_some() {
        match crate::chat_sessions::get_conversation_history(session_id.clone().unwrap()).await {
            Ok(mut history) => {
                // Remove the last user message if it matches the current message
                // This prevents duplicate user messages
                if let Some(last_msg) = history.last() {
                    if last_msg.role == "user" && last_msg.content == message {
                        history.pop(); // Remove the last message
                    }
                }

                for msg in history {
                    let role = match msg.role.as_str() {
                        "user" => ChatCompletionMessageRole::User,
                        "assistant" => ChatCompletionMessageRole::Assistant,
                        _ => {
                            println!("Skipping unknown role: {}", msg.role);
                            continue;
                        } // Skip unknown roles
                    };

                    messages.push(ChatCompletionMessage {
                        role,
                        content: Some(msg.content),
                        ..Default::default()
                    });
                }
            }
            Err(e) => {
                println!("Failed to get conversation history: {}", e);
            }
        }
    }

    // Always add the current user message
    messages.push(ChatCompletionMessage {
        role: ChatCompletionMessageRole::User,
        content: Some(message.clone()),
        ..Default::default()
    });

    println!("Sending streaming message: {}", message);

    let credentials = Credentials::new("unused", "http://localhost:8000/v3");

    // Create streaming chat completion
    let mut builder = ChatCompletion::builder(&model_name, messages.clone())
        .credentials(credentials)
        .stream(true); // Enable streaming

    // Add optional parameters if provided
    if let Some(temp) = temperature {
        builder = builder.temperature(temp as f32);
    }

    if let Some(top_p_val) = top_p {
        builder = builder.top_p(top_p_val as f32);
    }

    if let Some(seed_val) = seed {
        builder = builder.seed(seed_val);
    }

    if let Some(max_tokens_val) = max_tokens {
        builder = builder.max_tokens(max_tokens_val);
    }

    if let Some(max_completion_tokens_val) = max_completion_tokens {
        builder = builder.max_completion_tokens(max_completion_tokens_val);
    }

    let mut chat_stream = builder
        .create_stream().await
        .map_err(|e| format!("Failed to create chat stream: {}", e))?;

    let mut full_response = String::new();

    // Process streaming responses using recv() method for Receiver
    loop {
        match chat_stream.recv().await {
            Some(response) => {
                let mut should_finish = false;

                if let Some(choice) = response.choices.first() {
                    let delta = &choice.delta;
                    if let Some(content) = &delta.content {
                        let emit_result = app.emit(
                            "chat-token",
                            serde_json::json!({
                            "token": content,
                            "finished": false
                        })
                        );

                        if let Err(e) = emit_result {
                            eprintln!("Failed to emit token: {}", e);
                        }

                        full_response.push_str(content);
                    }

                    // Check if this is the last chunk AFTER processing content
                    if choice.finish_reason.is_some() {
                        should_finish = true;
                    }
                }

                if should_finish {
                    break;
                }
            }
            None => {
                // Stream ended
                break;
            }
        }
    }

    // Emit completion signal
    let _ = app.emit(
        "chat-token",
        serde_json::json!({
        "token": "",
        "finished": true
    })
    );

    Ok(full_response)
}

#[tauri::command]
pub async fn check_ovms_status() -> Result<String, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("http://localhost:8000/v1/config")
        .send().await
        .map_err(|e| format!("Failed to connect to OVMS server: {}", e))?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        Ok(body)
    } else {
        Err(format!("OVMS status check failed with status: {}", response.status()))
    }
}

#[tauri::command]
pub async fn get_ovms_model_metadata(model_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Try to get model metadata for more detailed error information
    let metadata_url = format!("http://localhost:8000/v1/models/{}/metadata", model_name);
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
        let status_url = format!("http://localhost:8000/v1/models/{}", model_name);
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
