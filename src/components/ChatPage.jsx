import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
  Avatar,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Memory as LoadIcon,
  Stop as StopIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import useAppStore from '../store/useAppStore';

// Global listener to prevent duplicates
let globalUnlisten = null;
let globalListenerId = null;

// Global streaming state
let globalLastProcessedToken = null;
let globalTokenCounter = 0;
let globalCurrentStreamingMessageId = null;
let globalSetMessages = null;
let globalSetIsSending = null;
let globalStreamingTimeout = null;
let globalStreamingStartTime = null;

const ChatPage = () => {
  const { downloadedModels, settings, showNotification } = useAppStore();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loadedModels, setLoadedModels] = useState([]);
  const [systemCapabilities, setSystemCapabilities] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const unlistenRef = useRef(null);

  useEffect(() => {
    const initialize = async () => {
      await initializePage();
      await setupEventListeners();
    };
    
    initialize();
    
    return () => {
      if (globalUnlisten) {
        globalUnlisten();
        globalUnlisten = null;
        globalListenerId = null;
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializePage = async () => {
    try {
      setIsLoading(true);
      
      // Check currently loaded model
      const loadedModel = await invoke('get_loaded_model');
      if (loadedModel) {
        setLoadedModels([{ model_id: loadedModel, device: { oem: 'OpenVINO' } }]);
        setSelectedModel(loadedModel); // Set the dropdown to match loaded model
      } else {
        setLoadedModels([]);
        setSelectedModel('');
      }
      
    } catch (error) {
      console.error('Failed to initialize chat page:', error);
      showNotification(`Failed to initialize: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const setupEventListeners = async () => {
    try {
      // Don't cleanup if there's an active streaming session
      if (globalCurrentStreamingMessageId) {
        return;
      }
      
      // Clean up any existing global listener first
      if (globalUnlisten) {
        await globalUnlisten();
        globalUnlisten = null;
        globalListenerId = null;
      }

      // Reset global streaming message reference
      globalCurrentStreamingMessageId = null;

      // Add a small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const listenerId = Math.random().toString(36).substr(2, 9);
      globalListenerId = listenerId;
      
      // Store the state setter functions globally
      globalSetMessages = setMessages;
      globalSetIsSending = setIsSending;
      
      // Use global listen instead of window-specific
      const unlisten = await listen('chat-token', (event) => {
        // Only allow the current active listener to process events
        if (globalListenerId !== listenerId) {
          return;
        }
        
        const { token, finished } = event.payload;
        
        if (finished) {
          // Clear the timeout since we received proper completion
          if (globalStreamingTimeout) {
            clearTimeout(globalStreamingTimeout);
            globalStreamingTimeout = null;
          }
          
          globalSetIsSending(false);
          
          // Calculate tokens per second
          const streamingDuration = (Date.now() - globalStreamingStartTime) / 1000;
          const tokensPerSecond = globalTokenCounter / streamingDuration;
          
          // Add a small delay to ensure any pending token updates complete first
          setTimeout(() => {
            // Mark the last streaming message as complete and add tokens per second
            globalSetMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
                lastMessage.isStreaming = false;
                lastMessage.tokensPerSecond = tokensPerSecond;
              }
              return newMessages;
            });
            
            // Clear streaming state
            globalCurrentStreamingMessageId = null;
            globalTokenCounter = 0;
            globalStreamingStartTime = null;
          }, 50); // Small delay to allow pending updates to complete
        } else if (token !== undefined && token !== null) { // Process all tokens including empty ones
          // Skip truly empty tokens but allow whitespace
          if (!token.trim() && token.length === 0) {
            return;
          }
          
          // Global deduplication: check if this is the same token we just processed
          const timeSinceLastToken = Date.now() - (globalLastProcessedToken?.timestamp || 0);
          
          if (globalLastProcessedToken?.token === token && timeSinceLastToken < 100) {
            return; // Skip this duplicate token
          }
          
          globalLastProcessedToken = { token, timestamp: Date.now() };
          globalTokenCounter++;
          
          // Set start time on first token
          if (globalTokenCounter === 1) {
            globalStreamingStartTime = Date.now();
          }
          
          // Clear existing timeout 
          if (globalStreamingTimeout) {
            clearTimeout(globalStreamingTimeout);
            globalStreamingTimeout = null;
          }
          
          if (!globalCurrentStreamingMessageId) {
            // Start a new streaming message
            const newMessage = {
              id: Date.now() + Math.random(), // Unique ID
              role: 'assistant',
              content: token,
              timestamp: Date.now(),
              isStreaming: true,
            };
            globalCurrentStreamingMessageId = newMessage.id;
            
            globalSetMessages(prev => [...prev, newMessage]);
          } else {
            // Append to existing streaming message
            globalSetMessages(prev => {
              const newMessages = [...prev];
              const messageIndex = newMessages.findIndex(m => m.id === globalCurrentStreamingMessageId);
              
              if (messageIndex !== -1) {
                const existingMessage = newMessages[messageIndex];
                const updatedMessage = {
                  ...existingMessage,
                  content: existingMessage.content + token
                };
                newMessages[messageIndex] = updatedMessage;
              }
              
              return newMessages;
            });
          }
        }
      });
      
      globalUnlisten = unlisten;
      unlistenRef.current = unlisten;
    } catch (error) {
      console.error('Failed to setup event listeners:', error);
    }
  };

  const handleModelChange = async (newModelId) => {
    if (!newModelId) {
      setSelectedModel('');
      return;
    }

    if (newModelId === selectedModel) {
      return; // No change
    }

    try {
      setIsLoadingModel(true);
      setSelectedModel(newModelId);
      
      // If a model is currently loaded, unload it first
      if (loadedModels.length > 0) {
        await invoke('unload_model');
        setLoadedModels([]);
      }
      
      // Load the new model
      const result = await invoke('load_model', {
        modelId: newModelId,
      });
      
      showNotification(`Model loaded: ${newModelId.includes('/') ? newModelId.split('/')[1] : newModelId}`, 'success');
      
      // Refresh loaded models list
      const loadedModel = await invoke('get_loaded_model');
      if (loadedModel) {
        setLoadedModels([{ model_id: loadedModel, device: { oem: 'OpenVINO' } }]);
      } else {
        setLoadedModels([]);
      }
      
    } catch (error) {
      console.error('Failed to load model:', error);
      showNotification(`Failed to load model: ${error}`, 'error');
      // Reset selection on error
      setSelectedModel('');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleUnloadModel = async (modelId) => {
    try {
      const result = await invoke('unload_model');
      showNotification(result, 'success');
      
      // Clear the selection and loaded models
      setSelectedModel('');
      setLoadedModels([]);
      
    } catch (error) {
      console.error('Failed to unload model:', error);
      showNotification(`Failed to unload model: ${error}`, 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (loadedModels.length === 0) {
      showNotification('Please load a model first', 'warning');
      return;
    }

    const userMessage = {
      id: Date.now() + Math.random(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);
    
    // Reset global streaming state for new response
    globalCurrentStreamingMessageId = null;
    globalLastProcessedToken = null;
    globalTokenCounter = 0;
    globalStreamingStartTime = null;

    try {
      // Use streaming chat function
      await invoke('chat_with_loaded_model_streaming', { 
        message: inputMessage.trim()
      });
      
      // The response will be handled by the streaming event listener
      // No need to add message here as it's handled in the event listener
      
    } catch (error) {
      console.error('Chat error:', error);
      showNotification(`Chat error: ${error}`, 'error');
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: Date.now(),
        isError: true,
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const downloadedModelsList = Array.from(downloadedModels);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
  



      {/* Chat Messages */}
      <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', mb: 2 }}>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  Start a conversation with your AI model
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {messages.map((message, index) => (
                  <ListItem key={message.id || index} sx={{ px: 0, py: 1, alignItems: 'flex-start' }}>
                    <Avatar sx={{ mr: 2, bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main' }}>
                      {message.role === 'user' ? <PersonIcon /> : <BotIcon />}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" sx={{ 
                        color: message.isError ? 'error.main' : 'inherit',
                        fontStyle: message.isStreaming ? 'italic' : 'normal'
                      }}>
                        {message.content}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {message.tokensPerSecond ? `${message.tokensPerSecond.toFixed(1)} tokens/sec` : new Date(message.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
            <div ref={messagesEndRef} />
          </Box>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Paper sx={{ p: 2 }}>
        {/* First Row: Full Width Input Field */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={isSending || loadedModels.length === 0}
            variant="outlined"
          />
        </Box>
        
        {/* Second Row: Model Selection + Send Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
          {/* Loading Indicator */}
          {isLoadingModel && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="caption" color="text.secondary">
                Loading model...
              </Typography>
            </Box>
          )}
          
          <FormControl sx={{ minWidth: 180, maxWidth: 250 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              label="Model"
              size="small"
              disabled={isLoadingModel}
            >
              {downloadedModelsList.map((modelId) => (
                <MenuItem key={modelId} value={modelId}>
                  {modelId.includes('/') ? modelId.split('/')[1] : modelId}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Send Button */}
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isSending || loadedModels.length === 0}
            endIcon={isSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            size="medium"
            sx={{ minWidth: 100 }}
          >
            {isSending ? 'Sending' : 'Send'}
          </Button>
        </Box>
        
      </Paper>
    </Box>
  );
};

export default ChatPage;