use super::config::{McpConfig, McpServerConfig};
use tracing::{info, warn, debug};
use rmcp::{ServiceExt, transport::TokioChildProcess, service::RunningService, RoleClient};
use rmcp::model::CallToolRequestParam;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command;
use async_openai::types::{ChatCompletionTool, ChatCompletionToolType, FunctionObject};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub config: McpServerConfig,
    pub status: String, // "connected", "disconnected", "error"
    pub tools: Vec<String>,
}

pub struct McpManager {
    config: McpConfig,
    pub clients: HashMap<String, RunningService<RoleClient, ()>>,
}

impl McpManager {
    pub fn new(config: McpConfig) -> Self {
        Self {
            config,
            clients: HashMap::new(),
        }
    }
    
    pub async fn connect_to_server(&mut self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        info!(server_name = %name, "Attempting to connect to MCP server");
        let server_config = self.config.get_server(name)
            .ok_or(format!("Server '{}' not found in configuration", name))?;
            
        info!(command = %server_config.command, args = ?server_config.args, "Starting MCP server");
        
        // Create the command
        let mut cmd = Command::new(&server_config.command);
        cmd.args(&server_config.args);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
            
        // Set environment variables if provided
        if let Some(env_vars) = &server_config.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }
        
        // Create transport and connect
        let transport = TokioChildProcess::new(cmd)?;
        let client = ().serve(transport).await?;
        
        self.clients.insert(name.to_string(), client);
        info!(server_name = %name, "Successfully connected to MCP server");
        Ok(())
    }
    
    pub fn disconnect_from_server(&mut self, name: &str) {
        info!(server_name = %name, "Disconnecting from MCP server");
        self.clients.remove(name);
    }
    
    
    pub async fn fetch_tools(&self, server_name: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let client = self.clients.get(server_name)
            .ok_or(format!("Server '{}' not connected", server_name))?;
            
        debug!(server_name = %server_name, "Fetching tools from MCP server");
        let tools_response = client.list_tools(Default::default()).await?;
        
        let tool_names: Vec<String> = tools_response.tools
            .iter()
            .map(|tool| tool.name.to_string())
            .collect();
            
        info!(server_name = %server_name, tool_count = tool_names.len(), tools = ?tool_names, "Found tools from MCP server");
        Ok(tool_names)
    }
    
    
    pub fn add_server(&mut self, name: String, config: McpServerConfig) {
        self.config.add_server(name, config);
    }
    
    pub fn remove_server(&mut self, name: &str) -> Option<McpServerConfig> {
        self.disconnect_from_server(name);
        self.config.remove_server(name)
    }
    
    pub fn get_config(&self) -> &McpConfig {
        &self.config
    }
    
    
    pub async fn get_all_tools_for_openai(&self) -> Result<Vec<ChatCompletionTool>, Box<dyn std::error::Error>> {
        let mut all_tools = Vec::new();
        
        for (server_name, client) in &self.clients {
            debug!(server_name = %server_name, "Getting tools from server");
            
            // Get actual tools from the MCP server
            match client.list_tools(Default::default()).await {
                Ok(tools_response) => {
                    for tool in tools_response.tools {
                        // Convert MCP tool to OpenAI ChatCompletionTool format
                        let openai_tool = ChatCompletionTool {
                            r#type: ChatCompletionToolType::Function,
                            function: FunctionObject {
                                name: format!("{}_{}", server_name, tool.name), // Prefix with server name to avoid conflicts
                                description: tool.description.map(|d| d.to_string()).or_else(|| Some(format!("Tool '{}' from MCP server '{}'", tool.name, server_name))),
                                parameters: Some(serde_json::Value::Object(tool.input_schema.as_ref().clone())),
                                strict: Some(false),
                            },
                        };
                        all_tools.push(openai_tool);
                    }
                }
                Err(e) => {
                    warn!(server_name = %server_name, error = %e, "Failed to get tools from server");
                    continue;
                }
            }
        }
        
        info!(tool_count = all_tools.len(), "Total MCP tools available");
        Ok(all_tools)
    }
    
    pub async fn call_mcp_tool(
        &self,
        tool_name: &str,
        arguments: Option<serde_json::Map<String, Value>>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Parse server name and actual tool name from the prefixed name
        let parts: Vec<&str> = tool_name.splitn(2, '_').collect();
        if parts.len() != 2 {
            return Err("Invalid tool name format. Expected: server_toolname".into());
        }
        
        let server_name = parts[0];
        let actual_tool_name = parts[1];
        
        let client = self.clients.get(server_name)
            .ok_or(format!("Server '{}' not connected", server_name))?;
        
        info!(tool_name = %actual_tool_name, server_name = %server_name, arguments = ?arguments, "Calling MCP tool");
        
        // Call the actual MCP tool
        let result = client.call_tool(CallToolRequestParam {
            name: actual_tool_name.to_string().into(),
            arguments,
        }).await?;
        
        // Convert MCP result to string
        let result_str = if let Some(content_vec) = result.content.as_ref() {
            if !content_vec.is_empty() {
                // Extract text content from MCP response (using debug format for now and parse)
                let debug_str = format!("{:#?}", content_vec);
                
                // Try to extract text field from the debug output
                let text_lines: Vec<&str> = debug_str
                    .lines()
                    .filter_map(|line| {
                        if line.trim_start().starts_with("text:") {
                            // Extract the text between quotes
                            let trimmed = line.trim();
                            if let Some(start) = trimmed.find('"') {
                                if let Some(end) = trimmed.rfind('"') {
                                    if end > start {
                                        return Some(&trimmed[start+1..end]);
                                    }
                                }
                            }
                        }
                        None
                    })
                    .collect();
                
                if text_lines.is_empty() {
                    // Fallback to debug format if we can't parse
                    debug_str
                } else {
                    text_lines.join("\n")
                }
            } else {
                "Empty content returned from tool".to_string()
            }
        } else {
            "No content returned from tool".to_string()
        };
        
        debug!(tool_name = %actual_tool_name, result = %result_str, "MCP tool execution completed");
        Ok(result_str)
    }
}