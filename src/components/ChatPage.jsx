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
import useAppStore from '../store/useAppStore';

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
  const currentStreamingMessageRef = useRef(null);

  useEffect(() => {
    initializePage();
    setupEventListeners();
    
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
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
      } else {
        setLoadedModels([]);
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
      // Clean up existing listener first
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      // Reset streaming message reference
      currentStreamingMessageRef.current = null;

      // Listen for streaming chat tokens
      const unlisten = await listen('chat-token', (event) => {
        console.log('Received chat-token:', event.payload); // Debug log
        const { token, finished } = event.payload;
        
        if (finished) {
          console.log('Stream finished'); // Debug log
          setIsSending(false);
          currentStreamingMessageRef.current = null;
          // Mark the last streaming message as complete
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
              lastMessage.isStreaming = false;
            }
            return newMessages;
          });
        } else if (token && token.trim()) { // Only process non-empty tokens
          console.log('Adding token:', token); // Debug log
          
          if (!currentStreamingMessageRef.current) {
            // Start a new streaming message
            const newMessage = {
              id: Date.now() + Math.random(), // Unique ID
              role: 'assistant',
              content: token,
              timestamp: Date.now(),
              isStreaming: true,
            };
            currentStreamingMessageRef.current = newMessage.id;
            
            setMessages(prev => [...prev, newMessage]);
          } else {
            // Append to existing streaming message
            setMessages(prev => {
              const newMessages = [...prev];
              const messageIndex = newMessages.findIndex(m => m.id === currentStreamingMessageRef.current);
              
              if (messageIndex !== -1) {
                const existingMessage = newMessages[messageIndex];
                // Build token array to prevent duplicates
                const existingTokens = existingMessage.content.split(' ');
                if (!existingTokens.includes(token)) {
                  newMessages[messageIndex] = {
                    ...existingMessage,
                    content: existingMessage.content + ' ' + token
                  };
                }
              }
              
              return newMessages;
            });
          }
        }
      });
      
      unlistenRef.current = unlisten;
    } catch (error) {
      console.error('Failed to setup event listeners:', error);
    }
  };

  const handleLoadModel = async () => {
    if (!selectedModel) {
      showNotification('Please select a model to load', 'warning');
      return;
    }

    try {
      setIsLoadingModel(true);
      const result = await invoke('load_model', {
        modelId: selectedModel,
      });
      
      showNotification(result, 'success');
      
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
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleUnloadModel = async (modelId) => {
    try {
      const result = await invoke('unload_model');
      showNotification(result, 'success');
      
      // Refresh loaded models list
      const loadedModel = await invoke('get_loaded_model');
      if (loadedModel) {
        setLoadedModels([{ model_id: loadedModel, device: { oem: 'OpenVINO' } }]);
      } else {
        setLoadedModels([]);
      }
      
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
    currentStreamingMessageRef.current = null; // Reset for new response

    try {
      const response = await invoke('chat_with_loaded_model', { 
        message: inputMessage.trim()
      });
      
      // Add the complete response
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }]);
      
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
      <Typography variant="h4" component="h1" gutterBottom>
        Chat with AI Models
      </Typography>


      {/* Model Management */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Model Management
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Select Model</InputLabel>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                label="Select Model"
              >
                {downloadedModelsList.map((modelId) => (
                  <MenuItem key={modelId} value={modelId}>
                    {modelId.includes('/') ? modelId.split('/')[1] : modelId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              onClick={handleLoadModel}
              disabled={!selectedModel || isLoadingModel}
              startIcon={isLoadingModel ? <CircularProgress size={20} /> : <LoadIcon />}
            >
              {isLoadingModel ? 'Loading...' : 'Load Model'}
            </Button>
          </Box>

          {/* Loaded Models */}
          {loadedModels.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Loaded Models:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {loadedModels.map((model) => (
                  <Chip
                    key={model.model_id}
                    label={`${model.model_id.includes('/') ? model.model_id.split('/')[1] : model.model_id} (${model.device.oem})`}
                    onDelete={() => handleUnloadModel(model.model_id)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          {downloadedModelsList.length === 0 && (
            <Alert severity="warning">
              No downloaded models found. Please download some models from the Models page first.
            </Alert>
          )}
        </CardContent>
      </Card>

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
                        {new Date(message.timestamp).toLocaleTimeString()}
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={isSending || loadedModels.length === 0}
          />
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isSending || loadedModels.length === 0}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            {isSending ? <CircularProgress size={24} /> : <SendIcon />}
          </Button>
        </Box>
        
        {loadedModels.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Load a model to start chatting
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default ChatPage;