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
  const { 
    downloadedModels, 
    settings, 
    showNotification,
    activeChatSessionId,
    currentChatMessages,
    setCurrentChatMessages,
    addMessageToCurrentChat,
    clearCurrentChatMessages,
    updateChatSession
  } = useAppStore();
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

  // Load messages when active chat session changes
  useEffect(() => {
    if (activeChatSessionId) {
      loadChatSessionMessages(activeChatSessionId);
    } else {
      clearCurrentChatMessages();
    }
  }, [activeChatSessionId]);

  useEffect(() => {
    console.log('currentChatMessages updated:', currentChatMessages);
    scrollToBottom();
  }, [currentChatMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatSessionMessages = async (sessionId) => {
    try {
      const messages = await invoke('get_session_messages', { sessionId });
      console.log('Loaded messages:', messages, 'Type:', typeof messages, 'IsArray:', Array.isArray(messages));
      setCurrentChatMessages(Array.isArray(messages) ? messages : []);
    } catch (error) {
      console.error('Failed to load chat session messages:', error);
      showNotification('Failed to load chat messages', 'error');
      setCurrentChatMessages([]);
    }
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
      globalSetMessages = (updater) => {
        if (typeof updater === 'function') {
          const currentMessages = useAppStore.getState().currentChatMessages || [];
          const newMessages = updater(currentMessages);
          useAppStore.getState().setCurrentChatMessages(newMessages);
        } else {
          useAppStore.getState().setCurrentChatMessages(updater);
        }
      };
      globalSetIsSending = setIsSending;
      
      // Use global listen instead of window-specific
      const unlisten = await listen('chat-token', (event) => {
        // Only allow the current active listener to process events
        if (globalListenerId !== listenerId) {
          return;
        }
        
        const { token, finished } = event.payload;
        console.log('Received chat token:', { token, finished });
        
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
          setTimeout(async () => {
            // Mark the last streaming message as complete and add tokens per second
            let finalMessage = null;
            const currentMessages = useAppStore.getState().currentChatMessages || [];
            const newMessages = [...currentMessages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
              lastMessage.isStreaming = false;
              lastMessage.tokens_per_second = tokensPerSecond;
              finalMessage = lastMessage;
              useAppStore.getState().setCurrentChatMessages(newMessages);
            }
            
            // Save the complete assistant message to chat session
            if (finalMessage && finalMessage.content) {
              try {
                const savedMessage = await invoke('add_message_to_session', {
                  sessionId: useAppStore.getState().activeChatSessionId,
                  role: 'assistant',
                  content: finalMessage.content,
                  tokens_per_second: tokensPerSecond,
                  is_error: null
                });
                
                console.log('Saved assistant message with tokens per second:', tokensPerSecond);
                
                // Update the local message with the saved message ID
                const currentMessages = useAppStore.getState().currentChatMessages || [];
                const updatedMessages = [...currentMessages];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.id = savedMessage.id;
                  useAppStore.getState().setCurrentChatMessages(updatedMessages);
                }
              } catch (error) {
                console.error('Failed to save assistant message:', error);
              }
            }
            
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
            
            console.log('Starting new streaming message:', newMessage);
            globalSetMessages(prev => {
              console.log('Adding new message to chat, previous messages:', prev);
              return [...prev, newMessage];
            });
          } else {
            // Append to existing streaming message
            console.log('Appending token to existing message:', token);
            globalSetMessages(prev => {
              const newMessages = [...prev];
              const messageIndex = newMessages.findIndex(m => m.id === globalCurrentStreamingMessageId);
              
              console.log('Found message at index:', messageIndex, 'Total messages:', newMessages.length);
              
              if (messageIndex !== -1) {
                const existingMessage = newMessages[messageIndex];
                const updatedMessage = {
                  ...existingMessage,
                  content: existingMessage.content + token
                };
                newMessages[messageIndex] = updatedMessage;
                console.log('Updated message content:', updatedMessage.content);
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
    
    console.log('Loaded models:', loadedModels);

    if (!activeChatSessionId) {
      showNotification('Please create or select a chat session first', 'warning');
      return;
    }

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);
    
    try {
      // Add user message to chat session
      const userMessage = await invoke('add_message_to_session', {
        sessionId: activeChatSessionId,
        role: 'user',
        content: messageContent,
        tokens_per_second: null,
        is_error: null
      });
      
      addMessageToCurrentChat(userMessage);
      console.log('Added user message to current chat');
      
      // Update session title if it was auto-generated and refresh chat sessions
      const sessionData = await invoke('get_chat_sessions');
      const currentSession = sessionData.sessions[activeChatSessionId];
      if (currentSession) {
        // Update the session in the store with the latest data including messages
        updateChatSession(activeChatSessionId, currentSession);
      }
      
      // Reset global streaming state for new response
      globalCurrentStreamingMessageId = null;
      globalLastProcessedToken = null;
      globalTokenCounter = 0;
      globalStreamingStartTime = null;

      // Use streaming chat function
      console.log('Sending message to model:', messageContent);
      await invoke('chat_with_loaded_model_streaming', { 
        message: messageContent,
        session_id: activeChatSessionId,
        include_history: settings.includeConversationHistory || false,
        system_prompt: settings.systemPrompt,
        temperature: settings.temperature,
        top_p: settings.topP,
        seed: settings.seed,
        max_tokens: settings.maxTokens,
        max_completion_tokens: settings.maxCompletionTokens
      });
      console.log('Message sent, waiting for streaming response...');
      
      // The response will be handled by the streaming event listener
      
    } catch (error) {
      console.error('Chat error:', error);
      showNotification(`Chat error: ${error}`, 'error');
      
      // Add error message to session
      try {
        const errorMessage = await invoke('add_message_to_session', {
          sessionId: activeChatSessionId,
          role: 'assistant',
          content: `Error: ${error}`,
          tokens_per_second: null,
          is_error: true
        });
        addMessageToCurrentChat(errorMessage);
      } catch (saveError) {
        console.error('Failed to save error message:', saveError);
      }
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Chat Messages */}
      <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', mb: 2, boxShadow: 'none', border: 'none', minHeight: 0 }}>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 0, minHeight: 0 }}>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, minHeight: 0 }}>
            {(!Array.isArray(currentChatMessages) || currentChatMessages.length === 0) ? (
              <Box sx={{ 
                textAlign: 'center', 
                py: 8,
                mx: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}>
                <Typography 
                  variant="h4" 
                  color="text.secondary" 
                  sx={{ 
                    fontWeight: 300
                  }}
                >
                  How can I help you today?
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {Array.isArray(currentChatMessages) ? currentChatMessages.map((message, index) => (
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
                        {message.tokens_per_second ? `${message.tokens_per_second.toFixed(1)} tokens/sec` : new Date(message.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </ListItem>
                )) : null}
              </List>
            )}
            <div ref={messagesEndRef} />
          </Box>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Paper sx={{ 
        p: 3, 
        borderRadius: '16px',
        flexShrink: 0,
      }}>
        {/* First Row: Full Width Input Field */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => {
              if (loadedModels.length === 0) {
                showNotification('Please select and load a model first', 'warning');
              } else if (!activeChatSessionId) {
                showNotification('Please create a new chat or select an existing one', 'warning');
              }
            }}
            placeholder="How can I help you today?"
            disabled={isSending || loadedModels.length === 0 || !activeChatSessionId}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                fontSize: '16px',
              },
            }}
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
            <InputLabel sx={{ top: '-8px', '&.MuiInputLabel-shrink': { top: '0px' } }}>Model</InputLabel>
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
            disabled={!inputMessage.trim() || isSending || loadedModels.length === 0 || !activeChatSessionId}
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