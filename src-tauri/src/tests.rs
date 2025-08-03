use crate::ovms;
use tauri::AppHandle;

// Debug command to test OpenVINO model search
#[tauri::command]
pub async fn test_openvino_search() -> Result<String, String> {
    match crate::huggingface::search_models("".to_string(), Some(10)).await {
        Ok(result) => {
            let mut debug_info = Vec::new();
            debug_info.push(format!("Found {} OpenVINO models:", result.models.len()));
            for model in result.models.iter().take(10) {
                debug_info.push(format!("  - {}", model.id));
            }
            Ok(debug_info.join("\n"))
        }
        Err(e) => Err(format!("Failed to search OpenVINO models: {}", e))
    }
}

// Test function to verify model loading functionality
#[tauri::command] 
pub async fn test_model_loading(app_handle: AppHandle) -> Result<String, String> {
    let mut debug_info = Vec::new();
    
    // Check current loaded model state
    match ovms::get_loaded_model().await {
        Ok(Some(model)) => debug_info.push(format!("Currently loaded model: {}", model)),
        Ok(None) => debug_info.push("No model currently loaded".to_string()),
        Err(e) => debug_info.push(format!("Error checking loaded model: {}", e)),
    }
    
    // Check available downloaded models  
    match crate::check_downloaded_models(None).await {
        Ok(models) => {
            debug_info.push(format!("Available OpenVINO models: {}", models.len()));
            for model in models.iter().take(5) {
                debug_info.push(format!("  - {}", model));
            }
        }
        Err(e) => debug_info.push(format!("Error checking downloaded models: {}", e)),
    }
    
    // Check OVMS paths
    debug_info.push(format!("OVMS directory: {}", ovms::get_ovms_dir(Some(&app_handle)).display()));
    debug_info.push(format!("OVMS executable: {}", ovms::get_ovms_exe_path(Some(&app_handle)).display()));
    debug_info.push(format!("OVMS config: {}", ovms::get_ovms_config_path(Some(&app_handle)).display()));
    
    Ok(debug_info.join("\n"))
}

// Test function for model loading workflow
#[tauri::command]
pub async fn test_model_workflow(app_handle: AppHandle, model_id: String) -> Result<String, String> {
    let mut debug_info = Vec::new();
    
    // Test loading a model
    debug_info.push("=== Testing Model Loading ===".to_string());
    match ovms::load_model(app_handle.clone(), model_id.clone()).await {
        Ok(result) => debug_info.push(format!("Load result: {}", result)),
        Err(e) => debug_info.push(format!("Load error: {}", e)),
    }
    
    // Check loaded model state
    match ovms::get_loaded_model().await {
        Ok(Some(model)) => debug_info.push(format!("Loaded model: {}", model)),
        Ok(None) => debug_info.push("No model loaded".to_string()),
        Err(e) => debug_info.push(format!("Error checking model: {}", e)),
    }
    
    // Test chat with loaded model
    debug_info.push("=== Testing Chat ===".to_string());
    match ovms::chat_with_loaded_model("Hello, how are you?".to_string()).await {
        Ok(response) => debug_info.push(format!("Chat response: {}", response)),
        Err(e) => debug_info.push(format!("Chat error: {}", e)),
    }
    
    // Test unloading
    debug_info.push("=== Testing Model Unloading ===".to_string());
    match ovms::unload_model(app_handle.clone()).await {
        Ok(result) => debug_info.push(format!("Unload result: {}", result)),
        Err(e) => debug_info.push(format!("Unload error: {}", e)),
    }
    
    Ok(debug_info.join("\n"))
}

// Show all available model loading commands for UI integration
#[tauri::command]
pub async fn show_model_commands() -> Result<String, String> {
    let commands = vec![
        "=== Model Loading Commands for UI ===",
        "",
        "1. Load Model:",
        "   ovms::load_model(app_handle, model_id)",
        "   - Loads an OpenVINO model into OVMS",
        "   - Only one model can be loaded at a time",
        "   - Returns success/error message",
        "",
        "2. Unload Model:",
        "   ovms::unload_model(app_handle)",
        "   - Unloads the currently loaded model",
        "   - Clears OVMS configuration",
        "",
        "3. Get Loaded Model:",
        "   ovms::get_loaded_model()",
        "   - Returns Option<String> with loaded model ID",
        "   - Use to check current state and disable/enable UI buttons",
        "",
        "4. Chat with Loaded Model:",
        "   ovms::chat_with_loaded_model(message)",
        "   - Sends chat message to the loaded model",
        "   - Returns model response",
        "",
        "5. Check Downloaded Models:",
        "   check_downloaded_models(None)",
        "   - Returns list of available OpenVINO models",
        "   - Use to populate downloaded models UI",
        "",
        "=== UI Implementation Guide ===",
        "",
        "Downloaded Page:",
        "- Show list of downloaded OpenVINO models",
        "- Each model should have a 'Load' button",
        "- Only enable 'Load' buttons when no model is loaded",
        "- Show which model is currently loaded",
        "- Add 'Unload' button when a model is loaded",
        "",
        "Chat Page:",
        "- Check if model is loaded before allowing chat",
        "- Use chat_with_loaded_model() for conversations",
        "- Show error if no model is loaded",
    ];
    
    Ok(commands.join("\n"))
}

// Test the updated default download paths
#[tauri::command]
pub async fn test_download_paths() -> Result<String, String> {
    let mut debug_info = Vec::new();
    
    // Test get_default_download_path
    match crate::get_default_download_path().await {
        Ok(path) => debug_info.push(format!("Default download path: {}", path)),
        Err(e) => debug_info.push(format!("Error getting default path: {}", e)),
    }
    
    // Test check_downloaded_models with default path
    match crate::check_downloaded_models(None).await {
        Ok(models) => {
            debug_info.push(format!("Models found in default location: {}", models.len()));
            for model in models.iter().take(3) {
                debug_info.push(format!("  - {}", model));
            }
        }
        Err(e) => debug_info.push(format!("Error checking models: {}", e)),
    }
    
    // Show expected directory structure
    debug_info.push("".to_string());
    debug_info.push("Expected directory structure:".to_string());
    debug_info.push("C:\\Users\\<username>\\.sparrow\\".to_string());
    debug_info.push("├── models\\                    (HuggingFace models)".to_string());
    debug_info.push("│   └── OpenVINO\\              (OpenVINO organization)".to_string());
    debug_info.push("│       ├── model-name-1\\".to_string());
    debug_info.push("│       └── model-name-2\\".to_string());
    debug_info.push("├── ovms\\                      (OVMS files)".to_string());
    debug_info.push("│   └── ovms.exe".to_string());
    debug_info.push("└── ovms_windows_python_off.zip".to_string());
    
    Ok(debug_info.join("\n"))
}