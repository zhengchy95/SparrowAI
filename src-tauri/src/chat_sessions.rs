use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: i64,
    pub tokens_per_second: Option<f64>,
    pub is_error: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub model_id: Option<String>,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatSessionsStorage {
    pub sessions: HashMap<String, ChatSession>,
    pub active_session_id: Option<String>,
}

impl Default for ChatSessionsStorage {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            active_session_id: None,
        }
    }
}

fn get_chat_sessions_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get user home directory".to_string())?;
    
    let sparrow_dir = PathBuf::from(home_dir).join(".sparrow");
    
    // Create .sparrow directory if it doesn't exist
    if !sparrow_dir.exists() {
        fs::create_dir_all(&sparrow_dir)
            .map_err(|e| format!("Failed to create .sparrow directory: {}", e))?;
    }
    
    Ok(sparrow_dir.join("chat_sessions.json"))
}

fn load_chat_sessions() -> Result<ChatSessionsStorage, String> {
    let path = get_chat_sessions_path()?;
    
    if !path.exists() {
        return Ok(ChatSessionsStorage::default());
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read chat sessions file: {}", e))?;
    
    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse chat sessions: {}", e))
}

fn save_chat_sessions(storage: &ChatSessionsStorage) -> Result<(), String> {
    let path = get_chat_sessions_path()?;
    
    let contents = serde_json::to_string_pretty(storage)
        .map_err(|e| format!("Failed to serialize chat sessions: {}", e))?;
    
    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write chat sessions file: {}", e))
}

fn generate_chat_title(content: &str) -> String {
    // Clean the content and create a meaningful title
    let cleaned = content.trim();
    
    // Remove common question words and make it more title-like
    let title = if cleaned.len() <= 60 {
        cleaned.to_string()
    } else {
        // Find a good break point near 60 characters
        let mut break_point = 60;
        if let Some(space_pos) = cleaned[..60].rfind(' ') {
            if space_pos > 40 { // Only use space if it's not too early
                break_point = space_pos;
            }
        }
        format!("{}...", &cleaned[..break_point])
    };
    
    // Capitalize first letter and ensure it doesn't end with punctuation before ellipsis
    let mut chars: Vec<char> = title.chars().collect();
    if !chars.is_empty() {
        chars[0] = chars[0].to_uppercase().next().unwrap_or(chars[0]);
    }
    
    let result: String = chars.into_iter().collect();
    
    // Clean up any trailing punctuation before "..."
    if result.ends_with("...") {
        let without_ellipsis = &result[..result.len() - 3];
        let trimmed = without_ellipsis.trim_end_matches(['.', ',', '!', '?', ';', ':']);
        format!("{}...", trimmed)
    } else {
        result
    }
}

#[tauri::command]
pub async fn get_chat_sessions() -> Result<ChatSessionsStorage, String> {
    load_chat_sessions()
}

#[tauri::command]
pub async fn create_chat_session(title: Option<String>) -> Result<ChatSession, String> {
    let mut storage = load_chat_sessions()?;
    
    let session_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    
    let session = ChatSession {
        id: session_id.clone(),
        title: title.unwrap_or_else(|| "New Chat".to_string()),
        created_at: now,
        updated_at: now,
        model_id: None,
        messages: Vec::new(),
    };
    
    storage.sessions.insert(session_id.clone(), session.clone());
    storage.active_session_id = Some(session_id);
    
    save_chat_sessions(&storage)?;
    
    Ok(session)
}

#[tauri::command]
pub async fn update_chat_session(
    session_id: String,
    title: Option<String>,
    model_id: Option<String>,
) -> Result<ChatSession, String> {
    let mut storage = load_chat_sessions()?;
    
    let session = storage.sessions.get_mut(&session_id)
        .ok_or_else(|| format!("Chat session not found: {}", session_id))?;
    
    if let Some(new_title) = title {
        session.title = new_title;
    }
    
    if let Some(new_model_id) = model_id {
        session.model_id = Some(new_model_id);
    }
    
    session.updated_at = chrono::Utc::now().timestamp_millis();
    
    let updated_session = session.clone();
    save_chat_sessions(&storage)?;
    
    Ok(updated_session)
}

#[tauri::command]
pub async fn delete_chat_session(session_id: String) -> Result<String, String> {
    let mut storage = load_chat_sessions()?;
    
    if !storage.sessions.contains_key(&session_id) {
        return Err(format!("Chat session not found: {}", session_id));
    }
    
    storage.sessions.remove(&session_id);
    
    // If this was the active session, clear it
    if storage.active_session_id.as_ref() == Some(&session_id) {
        storage.active_session_id = None;
    }
    
    save_chat_sessions(&storage)?;
    
    Ok(format!("Chat session deleted: {}", session_id))
}

#[tauri::command]
pub async fn set_active_chat_session(session_id: String) -> Result<String, String> {
    let mut storage = load_chat_sessions()?;
    
    if !storage.sessions.contains_key(&session_id) {
        return Err(format!("Chat session not found: {}", session_id));
    }
    
    storage.active_session_id = Some(session_id.clone());
    save_chat_sessions(&storage)?;
    
    Ok(session_id)
}

#[tauri::command]
pub async fn add_message_to_session(
    session_id: String,
    role: String,
    content: String,
    tokens_per_second: Option<f64>,
    is_error: Option<bool>,
) -> Result<ChatMessage, String> {
    let mut storage = load_chat_sessions()?;
    
    let session = storage.sessions.get_mut(&session_id)
        .ok_or_else(|| format!("Chat session not found: {}", session_id))?;
    
    let message_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    
    let message = ChatMessage {
        id: message_id,
        role,
        content: content.clone(),
        timestamp: now,
        tokens_per_second,
        is_error,
    };
    
    session.messages.push(message.clone());
    session.updated_at = now;
    
    // Auto-generate title from first user message if still "New Chat"
    if session.title == "New Chat" && message.role == "user" {
        let title = generate_chat_title(&content);
        session.title = title;
    }
    
    save_chat_sessions(&storage)?;
    
    Ok(message)
}

#[tauri::command]
pub async fn get_session_messages(session_id: String) -> Result<Vec<ChatMessage>, String> {
    let storage = load_chat_sessions()?;
    
    let session = storage.sessions.get(&session_id)
        .ok_or_else(|| format!("Chat session not found: {}", session_id))?;
    
    Ok(session.messages.clone())
}