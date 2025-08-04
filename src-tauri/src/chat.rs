use serde::{ Deserialize, Serialize };
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{ Arc, Mutex };
use uuid::Uuid;
use openai::chat::{ ChatCompletion, ChatCompletionMessage, ChatCompletionMessageRole };
use openai::Credentials;
use tauri::{ AppHandle, Emitter };

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
    let home_dir = std::env
        ::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get user home directory".to_string())?;

    let sparrow_dir = PathBuf::from(home_dir).join(".sparrow");

    // Create .sparrow directory if it doesn't exist
    if !sparrow_dir.exists() {
        fs
            ::create_dir_all(&sparrow_dir)
            .map_err(|e| format!("Failed to create .sparrow directory: {}", e))?;
    }

    Ok(sparrow_dir.join("chat_sessions.json"))
}

fn load_chat_sessions() -> Result<ChatSessionsStorage, String> {
    let path = get_chat_sessions_path()?;

    if !path.exists() {
        return Ok(ChatSessionsStorage::default());
    }

    let contents = fs
        ::read_to_string(&path)
        .map_err(|e| format!("Failed to read chat sessions file: {}", e))?;

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse chat sessions: {}", e))
}

fn save_chat_sessions(storage: &ChatSessionsStorage) -> Result<(), String> {
    let path = get_chat_sessions_path()?;

    let contents = serde_json
        ::to_string_pretty(storage)
        .map_err(|e| format!("Failed to serialize chat sessions: {}", e))?;

    fs::write(&path, contents).map_err(|e| format!("Failed to write chat sessions file: {}", e))
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
            if space_pos > 40 {
                // Only use space if it's not too early
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
pub async fn create_temporary_chat_session(title: Option<String>) -> Result<ChatSession, String> {
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

    // Don't save to storage yet - this is a temporary session
    Ok(session)
}

#[tauri::command]
pub async fn update_chat_session(
    session_id: String,
    title: Option<String>,
    model_id: Option<String>
) -> Result<ChatSession, String> {
    let mut storage = load_chat_sessions()?;

    let session = storage.sessions
        .get_mut(&session_id)
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
    is_error: Option<bool>
) -> Result<ChatMessage, String> {
    let mut storage = load_chat_sessions()?;

    let session = storage.sessions
        .get_mut(&session_id)
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
pub async fn persist_temporary_session(session: ChatSession) -> Result<ChatSession, String> {
    let mut storage = load_chat_sessions()?;

    storage.sessions.insert(session.id.clone(), session.clone());
    storage.active_session_id = Some(session.id.clone());

    save_chat_sessions(&storage)?;

    Ok(session)
}

#[tauri::command]
pub async fn add_message_to_temporary_session(
    mut session: ChatSession,
    role: String,
    content: String,
    tokens_per_second: Option<f64>,
    is_error: Option<bool>
) -> Result<(ChatSession, ChatMessage), String> {
    let message_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    let message = ChatMessage {
        id: message_id,
        role: role.clone(),
        content: content.clone(),
        timestamp: now,
        tokens_per_second,
        is_error,
    };

    session.messages.push(message.clone());
    session.updated_at = now;

    // Auto-generate title from first user message if still "New Chat"
    if session.title == "New Chat" && role == "user" {
        let title = generate_chat_title(&content);
        session.title = title;
    }

    Ok((session, message))
}

#[tauri::command]
pub async fn get_session_messages(session_id: String) -> Result<Vec<ChatMessage>, String> {
    let storage = load_chat_sessions()?;

    let session = storage.sessions
        .get(&session_id)
        .ok_or_else(|| format!("Chat session not found: {}", session_id))?;

    Ok(session.messages.clone())
}

#[tauri::command]
pub async fn get_conversation_history(session_id: String) -> Result<Vec<ChatMessage>, String> {
    let storage = load_chat_sessions()?;

    let session = storage.sessions
        .get(&session_id)
        .ok_or_else(|| format!("Chat session not found: {}", session_id))?;

    // Return all messages except any currently streaming ones
    let messages: Vec<ChatMessage> = session.messages
        .iter()
        .filter(|msg| (msg.role == "user" || msg.role == "assistant"))
        .cloned()
        .collect();

    Ok(messages)
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
    let loaded_model_mutex = crate::ovms::LOADED_MODEL.get_or_init(|| Arc::new(Mutex::new(None)));
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
        match get_conversation_history(session_id.clone().unwrap()).await {
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
