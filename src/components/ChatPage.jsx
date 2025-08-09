import React, { useState, useEffect, useRef } from "react";
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from "@mui/material";
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Memory as LoadIcon,
  Stop as StopIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useAppStore from "../store/useAppStore";
import useChatStore from "../store/useChatStore";

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
  const { downloadedModels, settings, showNotification, isOvmsRunning, loadedModel, setLoadedModel } =
    useAppStore();
  const {
    activeChatSessionId,
    currentChatMessages,
    setCurrentChatMessages,
    addMessageToCurrentChat,
    clearCurrentChatMessages,
    updateChatSession,
    temporarySession,
    setTemporarySession,
    clearTemporarySession,
    addChatSession,
    chatSessions,
  } = useChatStore();
  const [inputMessage, setInputMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [systemCapabilities, setSystemCapabilities] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // RAG setting from store
  const useRAG = settings.useRAG || false;

  const messagesEndRef = useRef(null);
  const unlistenRef = useRef(null);

  useEffect(() => {
    const initialize = async () => {
      await setupEventListeners();
      
      // Set the selected model from the loaded model state
      if (loadedModel && !selectedModel) {
        console.log("Pre-selecting loaded model from store:", loadedModel);
        setSelectedModel(loadedModel);
      }
    };

    initialize();

    // Listen for OVMS initialization completion
    const handleOvmsInitComplete = async () => {
      console.log("OVMS initialization completed, refreshing model status...");
      // Wait a moment for OVMS to fully load models
      setTimeout(async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const ovmsStatus = await invoke("check_ovms_status");
          console.log("Post-init OVMS Status received:", ovmsStatus);

          if (
            ovmsStatus &&
            ovmsStatus.loaded_models &&
            ovmsStatus.loaded_models.length > 0
          ) {
            // Sort models to ensure consistency, then get the first one
            const sortedModels = ovmsStatus.loaded_models.sort();
            const firstLoadedModel = `OpenVINO/${sortedModels[0]}`;
            
            // Check if this model is also downloaded
            if (downloadedModels.has(firstLoadedModel)) {
              console.log("Post-init pre-selecting model:", firstLoadedModel);
              setSelectedModel(firstLoadedModel);
              setLoadedModel(firstLoadedModel); // Update global loaded model state
            }
          }
        } catch (error) {
          console.error(
            "Failed to refresh OVMS status after initialization:",
            error
          );
        }
      }, 2000); // Wait 2 seconds for models to fully load
    };

    window.addEventListener(
      "ovms-initialization-complete",
      handleOvmsInitComplete
    );

    return () => {
      if (globalUnlisten) {
        globalUnlisten();
        globalUnlisten = null;
        globalListenerId = null;
      }
      window.removeEventListener(
        "ovms-initialization-complete",
        handleOvmsInitComplete
      );
    };
  }, [downloadedModels, loadedModel, selectedModel]);

  // Load messages when active chat session changes
  useEffect(() => {
    // ...removed debug log...

    if (activeChatSessionId) {
      if (temporarySession && temporarySession.id === activeChatSessionId) {
        const messagesFromTemp = temporarySession.messages || [];
        setCurrentChatMessages(messagesFromTemp);
        
        // Pre-select the model from the temporary session if available
        if (temporarySession.model_id && temporarySession.model_id !== selectedModel) {
          console.log("Pre-selecting model from session:", temporarySession.model_id);
          setSelectedModel(temporarySession.model_id);
        }
      } else {
        loadChatSessionMessages(activeChatSessionId);
        
        // Also try to pre-select model from persisted session
        const persistedSession = chatSessions[activeChatSessionId];
        if (persistedSession && persistedSession.model_id && persistedSession.model_id !== selectedModel) {
          console.log("Pre-selecting model from persisted session:", persistedSession.model_id);
          setSelectedModel(persistedSession.model_id);
        }
      }
    } else {
      clearCurrentChatMessages();
    }
  }, [activeChatSessionId, temporarySession]);

  useEffect(() => {
    // ...removed debug log...
    scrollToBottom();
  }, [currentChatMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatSessionMessages = async (sessionId) => {
    try {
      const messages = await invoke("get_session_messages", { sessionId });
      setCurrentChatMessages(Array.isArray(messages) ? messages : []);
    } catch (error) {
      console.error("ChatPage: Failed to load chat session messages:", error);
      showNotification("Failed to load chat messages", "error");
      setCurrentChatMessages([]);
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      const listenerId = Math.random().toString(36).substr(2, 9);
      globalListenerId = listenerId;

      // Store the state setter functions globally
      globalSetMessages = (updater) => {
        if (typeof updater === "function") {
          const currentMessages =
            useChatStore.getState().currentChatMessages || [];
          const newMessages = updater(currentMessages);
          useChatStore.getState().setCurrentChatMessages(newMessages);
        } else {
          useChatStore.getState().setCurrentChatMessages(updater);
        }
      };
      globalSetIsSending = setIsSending;

      // Use global listen instead of window-specific
      const unlisten = await listen("chat-token", (event) => {
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
          const streamingDuration =
            (Date.now() - globalStreamingStartTime) / 1000;
          const tokensPerSecond = globalTokenCounter / streamingDuration;

          console.log(
            `Streaming completed: ${globalTokenCounter} tokens in ${streamingDuration.toFixed(
              2
            )}s (${tokensPerSecond.toFixed(1)} tokens/sec)`
          );

          // Add a small delay to ensure any pending token updates complete first
          setTimeout(async () => {
            // Mark the last streaming message as complete and add tokens per second
            let finalMessage = null;
            const currentMessages =
              useChatStore.getState().currentChatMessages || [];
            const newMessages = [...currentMessages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (
              lastMessage &&
              lastMessage.role === "assistant" &&
              lastMessage.isStreaming
            ) {
              lastMessage.isStreaming = false;
              lastMessage.tokens_per_second = tokensPerSecond;
              finalMessage = lastMessage;
              useChatStore.getState().setCurrentChatMessages(newMessages);
            }

            // Save the complete assistant message to chat session
            if (finalMessage && finalMessage.content) {
              try {
                const savedMessage = await invoke("add_message_to_session", {
                  sessionId: useChatStore.getState().activeChatSessionId,
                  role: "assistant",
                  content: finalMessage.content,
                  tokens_per_second: tokensPerSecond,
                  is_error: null,
                });

                // Update the local message with the saved message ID
                const currentMessages =
                  useChatStore.getState().currentChatMessages || [];
                const updatedMessages = [...currentMessages];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                  lastMessage.id = savedMessage.id;
                  useChatStore
                    .getState()
                    .setCurrentChatMessages(updatedMessages);
                }
              } catch (error) {
                console.error("Failed to save assistant message:", error);
              }
            }

            // Clear streaming state
            globalCurrentStreamingMessageId = null;
            globalTokenCounter = 0;
            globalStreamingStartTime = null;
          }, 50); // Small delay to allow pending updates to complete
        } else if (token !== undefined && token !== null) {
          // Process all tokens including empty ones
          // Skip truly empty tokens but allow whitespace
          if (!token.trim() && token.length === 0) {
            return;
          }

          // Global deduplication: check if this is the same token we just processed
          const timeSinceLastToken =
            Date.now() - (globalLastProcessedToken?.timestamp || 0);

          if (
            globalLastProcessedToken?.token === token &&
            timeSinceLastToken < 100
          ) {
            return; // Skip this duplicate token
          }

          globalLastProcessedToken = { token, timestamp: Date.now() };
          globalTokenCounter++;

          // Set start time on first token
          if (globalTokenCounter === 1) {
            globalStreamingStartTime = Date.now();
            console.log("Starting new streaming response");
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
              role: "assistant",
              content: token,
              timestamp: Date.now(),
              isStreaming: true,
            };
            globalCurrentStreamingMessageId = newMessage.id;

            globalSetMessages((prev) => {
              return [...prev, newMessage];
            });
          } else {
            // Append to existing streaming message
            globalSetMessages((prev) => {
              const newMessages = [...prev];
              const messageIndex = newMessages.findIndex(
                (m) => m.id === globalCurrentStreamingMessageId
              );

              if (messageIndex !== -1) {
                const existingMessage = newMessages[messageIndex];
                const updatedMessage = {
                  ...existingMessage,
                  content: existingMessage.content + token,
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
      console.error("Failed to setup event listeners:", error);
    }
  };

  const handleModelChange = async (newModelId) => {
    if (!newModelId) {
      setSelectedModel("");
      return;
    }

    if (newModelId === selectedModel) {
      return; // No change
    }

    try {
      setIsLoadingModel(true);
      setSelectedModel(newModelId);

      // Check if the new model is already loaded (from global state)
      if (loadedModel === newModelId) {
        console.log("Model is already loaded in OVMS, no need to load again");
        showNotification(
          `Model already loaded: ${
            newModelId.includes("/") ? newModelId.split("/")[1] : newModelId
          }`,
          "success"
        );
        
        // Update global loaded model state
        setLoadedModel(newModelId);
      } else {
        // If a different model is currently loaded, try to unload it first
        if (loadedModel) {
          try {
            await invoke("unload_model");
            setLoadedModel(null);
          } catch (unloadError) {
            // If unload fails, it might be because the old tracking system doesn't know about the model
            // Just continue with loading the new model
            console.log(
              "Unload failed (model might be tracked by OVMS only):",
              unloadError
            );
          }
        }

        // Build the model path manually to avoid canonical path issues
        const modelName = newModelId.includes("/")
          ? newModelId.split("/")[1]
          : newModelId;

        // Get user profile directory and build clean path
        const userProfile = await invoke("get_user_profile_dir");
        const model_path =
          `${userProfile}/.sparrow/models/${newModelId}`.replace(/\\/g, "/");

        // Update OVMS config with the new model
        await invoke("update_ovms_config", {
          modelName: modelName,
          modelPath: model_path,
        });

        // Reload OVMS config
        await invoke("reload_ovms_config");

        showNotification(
          `Model loaded: ${
            newModelId.includes("/") ? newModelId.split("/")[1] : newModelId
          }`,
          "success"
        );
        
        // Update global loaded model state
        setLoadedModel(newModelId);
      }

      // The loadedModel state is already updated above, no need to refresh arrays
    } catch (error) {
      console.error("Failed to load model:", error);
      showNotification(`Failed to load model: ${error}`, "error");
      // Reset selection on error
      setSelectedModel("");
    } finally {
      setIsLoadingModel(false);
    }
    
    // Update the active session with the selected model
    try {
      if (activeChatSessionId) {
        if (temporarySession && temporarySession.id === activeChatSessionId) {
          // Update temporary session
          const updatedTempSession = { ...temporarySession, model_id: newModelId };
          setTemporarySession(updatedTempSession);
        } else {
          // Update persisted session
          await invoke("update_chat_session", {
            sessionId: activeChatSessionId,
            title: null, // Don't change title
            modelId: newModelId
          });
          // Also update local store
          updateChatSession(activeChatSessionId, { model_id: newModelId });
        }
      }
    } catch (error) {
      console.error("Failed to update session with model:", error);
      // Don't show error notification as model change was successful
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!loadedModel) {
      showNotification("Please load a model first", "warning");
      return;
    }

    console.log("Loaded model:", loadedModel);

    if (!activeChatSessionId) {
      showNotification(
        "Please create or select a chat session first",
        "warning"
      );
      return;
    }

    const messageContent = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    try {
      let sessionToUse = activeChatSessionId;
      let userMessage;

      // Check if this is a temporary session
      if (temporarySession && temporarySession.id === activeChatSessionId) {
        console.log("Adding message to temporary session");

        // Add user message to temporary session (not persisted yet)
        const result = await invoke("add_message_to_temporary_session", {
          session: temporarySession,
          role: "user",
          content: messageContent,
          tokens_per_second: null,
          is_error: null,
        });

        const [updatedSession, message] = result;
        userMessage = message;

        // Update the temporary session in the store
        setTemporarySession(updatedSession);
        addMessageToCurrentChat(userMessage);

        // Now persist the session since user sent first message
        console.log("Persisting temporary session");
        const persistedSession = await invoke("persist_temporary_session", {
          session: updatedSession,
        });

        // Move from temporary to persisted sessions
        addChatSession(persistedSession);
        clearTemporarySession();

        sessionToUse = persistedSession.id;
        console.log("Session persisted with ID:", sessionToUse);
      } else {
        // Add user message to existing persisted session
        userMessage = await invoke("add_message_to_session", {
          sessionId: activeChatSessionId,
          role: "user",
          content: messageContent,
          tokens_per_second: null,
          is_error: null,
        });

        addMessageToCurrentChat(userMessage);
        console.log("Added user message to existing session");

        // Update session title if it was auto-generated and refresh chat sessions
        const sessionData = await invoke("get_chat_sessions");
        const currentSession = sessionData.sessions[activeChatSessionId];
        if (currentSession) {
          // Update the session in the store with the latest data including messages
          updateChatSession(activeChatSessionId, currentSession);
        }
      }

      // Reset global streaming state for new response
      globalCurrentStreamingMessageId = null;
      globalLastProcessedToken = null;
      globalTokenCounter = 0;
      globalStreamingStartTime = null;

      // Use RAG-enabled or regular streaming chat function
      const chatFunction = useRAG
        ? "chat_with_rag_streaming"
        : "chat_with_loaded_model_streaming";
      const chatParams = {
        modelName: selectedModel.startsWith("OpenVINO/")
          ? selectedModel.substring("OpenVINO/".length)
          : selectedModel,
        message: messageContent,
        sessionId: sessionToUse,
        includeHistory: settings.includeConversationHistory || false,
        systemPrompt: settings.systemPrompt,
        temperature: settings.temperature,
        topP: settings.topP,
        seed: settings.seed,
        maxTokens: settings.maxTokens,
        maxCompletionTokens: settings.maxCompletionTokens,
      };

      // Add RAG-specific parameters if RAG is enabled
      if (useRAG) {
        chatParams.useRag = true;
        chatParams.ragLimit = 10;
      }

      await invoke(chatFunction, chatParams);

      // The response will be handled by the streaming event listener
    } catch (error) {
      console.error("Chat error:", error);
      showNotification(`Chat error: ${error}`, "error");

      // Add error message to session
      try {
        if (temporarySession && temporarySession.id === activeChatSessionId) {
          // For temporary sessions, we can't save error messages to storage
          // Just add to current chat display
          const errorMessage = {
            id: Date.now() + Math.random(),
            role: "assistant",
            content: `Error: ${error}`,
            timestamp: Date.now(),
            is_error: true,
          };
          addMessageToCurrentChat(errorMessage);
        } else {
          // For persisted sessions, save to storage
          const errorMessage = await invoke("add_message_to_session", {
            sessionId: activeChatSessionId,
            role: "assistant",
            content: `Error: ${error}`,
            tokens_per_second: null,
            is_error: true,
          });
          addMessageToCurrentChat(errorMessage);
        }
      } catch (saveError) {
        console.error("Failed to save error message:", saveError);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const downloadedModelsList = Array.from(downloadedModels);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Chat Messages */}
      <Card
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          mb: 2,
          boxShadow: "none",
          border: "none",
          minHeight: 0,
        }}
      >
        <CardContent
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            p: 0,
            minHeight: 0,
          }}
        >
          <Box sx={{ flexGrow: 1, overflow: "auto", p: 2, minHeight: 0 }}>
            {!Array.isArray(currentChatMessages) ||
            currentChatMessages.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 8,
                  mx: "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <Typography
                  variant="h4"
                  color="text.secondary"
                  sx={{
                    fontWeight: 300,
                  }}
                >
                  How can I help you today?
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {Array.isArray(currentChatMessages)
                  ? currentChatMessages.map((message, index) => (
                      <ListItem
                        key={message.id || index}
                        sx={{ px: 0, py: 1, alignItems: "flex-start" }}
                      >
                        <Avatar
                          sx={{
                            mr: 2,
                            bgcolor:
                              message.role === "user"
                                ? "primary.main"
                                : "secondary.main",
                          }}
                        >
                          {message.role === "user" ? (
                            <PersonIcon />
                          ) : (
                            <BotIcon />
                          )}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography
                            variant="body1"
                            sx={{
                              color: message.isError ? "error.main" : "inherit",
                              fontStyle: message.isStreaming
                                ? "italic"
                                : "normal",
                            }}
                          >
                            {message.content}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {message.tokens_per_second
                              ? `${message.tokens_per_second.toFixed(
                                  1
                                )} tokens/sec`
                              : new Date(
                                  message.timestamp
                                ).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      </ListItem>
                    ))
                  : null}
              </List>
            )}
            <div ref={messagesEndRef} />
          </Box>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Paper
        sx={{
          p: 3,
          borderRadius: "16px",
          flexShrink: 0,
        }}
      >
        {/* First Row: Full Width Input Field */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={async () => {
              if (!selectedModel && !loadedModel) {
                // Check if there's actually a model loaded in OVMS
                try {
                  const ovmsStatus = await invoke("check_ovms_status");
                  if (ovmsStatus && ovmsStatus.loaded_models && ovmsStatus.loaded_models.length > 0) {
                    // There are loaded models, update our state
                    const firstModel = `OpenVINO/${ovmsStatus.loaded_models[0]}`;
                    setLoadedModel(firstModel);
                    setSelectedModel(firstModel);
                    return; // Don't show the notification
                  }
                } catch (error) {
                  console.error("Failed to check OVMS status:", error);
                }
                
                showNotification(
                  "Please select and load a model first",
                  "warning"
                );
              } else if (!activeChatSessionId) {
                showNotification(
                  "Please create a new chat or select an existing one",
                  "warning"
                );
              }
            }}
            placeholder="How can I help you today?"
            disabled={
              isSending || (!selectedModel && !loadedModel) || !activeChatSessionId
            }
            variant="outlined"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                fontSize: "16px",
              },
            }}
          />
        </Box>

        {/* Second Row: Model Selection + Send Button */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            alignItems: "center",
          }}
        >
          {/* Loading Indicator */}
          {isLoadingModel && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="caption" color="text.secondary">
                Loading model...
              </Typography>
            </Box>
          )}

          <FormControl sx={{ minWidth: 180, maxWidth: 250 }}>
            <InputLabel
              sx={{ top: "-8px", "&.MuiInputLabel-shrink": { top: "0px" } }}
            >
              Model
            </InputLabel>
            <Select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              label="Model"
              size="small"
              disabled={isLoadingModel || !isOvmsRunning}
            >
              {downloadedModelsList
                .filter(
                  (modelId) =>
                    !modelId.includes("bge-reranker-base-int8-ov") &&
                    !modelId.includes("bge-base-en-v1.5-int8-ov")
                )
                .map((modelId) => (
                  <MenuItem key={modelId} value={modelId}>
                    {modelId.includes("/") ? modelId.split("/")[1] : modelId}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {/* Send Button */}
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={
              !inputMessage.trim() ||
              isSending ||
              (!selectedModel && !loadedModel) ||
              !activeChatSessionId
            }
            endIcon={
              isSending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon />
              )
            }
            size="medium"
            sx={{ minWidth: 100 }}
          >
            {isSending ? "Sending" : "Send"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatPage;
