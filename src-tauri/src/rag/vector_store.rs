use super::{Document, SearchResult};
use sled::Db;
use nalgebra::DVector;

pub struct VectorStore {
    db: Db,
}

impl VectorStore {
    pub fn new() -> Result<Self, String> {
        let mut data_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        data_dir.push("data");
        data_dir.push("vector_store");
        
        // Create data directory if it doesn't exist
        if let Some(parent) = data_dir.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create data directory: {}", e))?;
        }
        
        let db = sled::open(&data_dir)
            .map_err(|e| format!("Failed to open vector store: {}", e))?;
        
        Ok(Self { db })
    }
    
    pub fn store_document(&self, document: &Document) -> Result<(), String> {
        let key = document.id.as_bytes();
        let value = bincode::serialize(document)
            .map_err(|e| format!("Failed to serialize document: {}", e))?;
        
        self.db.insert(key, value)
            .map_err(|e| format!("Failed to store document: {}", e))?;
        
        Ok(())
    }
    
    
    pub fn search_similar(&self, query_embedding: &[f32], limit: usize) -> Result<Vec<SearchResult>, String> {
        let mut results = Vec::new();
        
        for item in self.db.iter() {
            let (_, value) = item.map_err(|e| format!("Database error: {}", e))?;
            let document: Document = bincode::deserialize(&value)
                .map_err(|e| format!("Failed to deserialize document: {}", e))?;
            
            if let Some(embedding) = &document.embedding {
                let similarity = cosine_similarity(query_embedding, embedding);
                results.push(SearchResult {
                    document,
                    score: similarity,
                    rerank_score: None,
                });
            }
        }
        
        // Sort by similarity score (highest first)
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);
        
        Ok(results)
    }
    
    pub fn delete_document(&self, id: &str) -> Result<bool, String> {
        let key = id.as_bytes();
        let result = self.db.remove(key)
            .map_err(|e| format!("Failed to delete document: {}", e))?;
        
        Ok(result.is_some())
    }
    
    pub fn list_all_documents(&self) -> Result<Vec<Document>, String> {
        let mut documents = Vec::new();
        
        for item in self.db.iter() {
            let (_, value) = item.map_err(|e| format!("Database error: {}", e))?;
            let document: Document = bincode::deserialize(&value)
                .map_err(|e| format!("Failed to deserialize document: {}", e))?;
            documents.push(document);
        }
        
        // Sort by creation time (newest first)
        documents.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        Ok(documents)
    }
    
    pub fn count_documents(&self) -> Result<usize, String> {
        let count = self.db.len();
        Ok(count)
    }
    
    pub fn clear_all(&self) -> Result<(), String> {
        self.db.clear()
            .map_err(|e| format!("Failed to clear database: {}", e))?;
        Ok(())
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }
    
    let vec_a = DVector::from_vec(a.to_vec());
    let vec_b = DVector::from_vec(b.to_vec());
    
    let dot_product = vec_a.dot(&vec_b);
    let norm_a = vec_a.norm();
    let norm_b = vec_b.norm();
    
    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot_product / (norm_a * norm_b)
    }
}

#[tauri::command]
pub async fn store_documents(documents: Vec<Document>) -> Result<String, String> {
    if documents.is_empty() {
        return Ok("No documents to store".to_string());
    }

    let vector_store = VectorStore::new()?;
    
    for document in &documents {
        vector_store.store_document(document)?;
    }
    
    Ok(format!("Successfully stored {} documents", documents.len()))
}

#[tauri::command]
pub async fn search_documents(query_embedding: Vec<f32>, limit: Option<usize>) -> Result<Vec<SearchResult>, String> {
    let vector_store = VectorStore::new()?;
    let search_limit = limit.unwrap_or(10);
    
    vector_store.search_similar(&query_embedding, search_limit)
}

#[tauri::command]
pub async fn get_all_documents() -> Result<Vec<Document>, String> {
    let vector_store = VectorStore::new()?;
    vector_store.list_all_documents()
}

#[tauri::command]
pub async fn delete_document_by_id(id: String) -> Result<bool, String> {
    let vector_store = VectorStore::new()?;
    vector_store.delete_document(&id)
}

#[tauri::command]
pub async fn get_document_count() -> Result<usize, String> {
    let vector_store = VectorStore::new()?;
    vector_store.count_documents()
}

#[tauri::command]
pub async fn clear_all_documents() -> Result<String, String> {
    let vector_store = VectorStore::new()?;
    vector_store.clear_all()?;
    Ok("All documents cleared successfully".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![1.0, 2.0, 3.0];
        let similarity = cosine_similarity(&a, &b);
        assert!((similarity - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        let similarity = cosine_similarity(&a, &b);
        assert!(similarity.abs() < 0.001);
    }
}