pub mod documents;
pub mod embeddings; 
pub mod vector_store;
pub mod reranker;
pub mod search;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub file_type: String,
    pub file_path: String,
    pub chunk_index: Option<usize>,
    pub metadata: HashMap<String, String>,
    pub embedding: Option<Vec<f32>>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub document: Document,
    pub score: f32,
    pub rerank_score: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub chunk_count: usize,
    pub created_at: i64,
    pub documents: Vec<Document>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfoSummary {
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub chunk_count: usize,
    pub created_at: i64,
}

impl Document {
    pub fn new(
        title: String,
        content: String,
        file_type: String,
        file_path: String,
        chunk_index: Option<usize>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            content,
            file_type,
            file_path,
            chunk_index,
            metadata: HashMap::new(),
            embedding: None,
            created_at: chrono::Utc::now().timestamp_millis(),
        }
    }
}