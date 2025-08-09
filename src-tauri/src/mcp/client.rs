use super::config::{McpConfig, McpServerConfig};
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
        let server_config = self.config.get_server(name)
            .ok_or(format!("Server '{}' not found in configuration", name))?;
            
        println!("Starting MCP server: {} {}", server_config.command, server_config.args.join(" "));
        
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
        println!("Successfully connected to MCP server: {}", name);
        
        Ok(())
    }
    
    pub fn disconnect_from_server(&mut self, name: &str) {
        self.clients.remove(name);
    }
    
    
    pub async fn fetch_tools(&self, server_name: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let client = self.clients.get(server_name)
            .ok_or(format!("Server '{}' not connected", server_name))?;
            
        println!("Fetching tools from MCP server: {}", server_name);
        let tools_response = client.list_tools(Default::default()).await?;
        
        let tool_names: Vec<String> = tools_response.tools
            .iter()
            .map(|tool| tool.name.to_string())
            .collect();
            
        println!("Found {} tools from {}: {:?}", tool_names.len(), server_name, tool_names);
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
            println!("Getting tools from server: {}", server_name);
            
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
                    println!("Failed to get tools from server {}: {}", server_name, e);
                    continue;
                }
            }
        }
        
        println!("Total MCP tools available: {}", all_tools.len());
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
        
        println!("Calling MCP tool: {} on server: {}", actual_tool_name, server_name);
        
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
        
        println!("Tool {} result: {}", actual_tool_name, result_str);
        Ok(result_str)
    }
}