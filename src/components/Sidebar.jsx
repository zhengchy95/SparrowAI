import React, { useEffect, useState } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  useTheme,
  IconButton,
  Tooltip,
  Button,
} from "@mui/material";
import {
  Search as SearchIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Chat as ChatIcon,
  MenuOpen as MenuOpenIcon,
  Menu as MenuIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Memory as MemoryIcon,
  Description as DocumentIcon,
  Extension as McpIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import useAppStore from "../store/useAppStore";
import useChatStore from "../store/useChatStore";
import OvmsStatusDialog from "./OvmsStatusDialog";

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Sidebar = ({
  currentPage,
  onPageChange,
  isCollapsed,
  onToggleCollapse,
}) => {
  const theme = useTheme();
  const { setSettingsDialogOpen, downloadedModels, showNotification, loadedModel, setLoadedModel } =
    useAppStore();
  const {
    chatSessions,
    activeChatSessionId,
    setChatSessions,
    setActiveChatSessionId,
    addChatSession,
    updateChatSession,
    removeChatSession,
    temporarySession,
    setTemporarySession,
    clearTemporarySession,
  } = useChatStore();

  const [loadingChatSessions, setLoadingChatSessions] = useState(false);
  const [ovmsStatusDialogOpen, setOvmsStatusDialogOpen] = useState(false);

  const drawerWidth = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const menuItems = [
    {
      id: "models",
      label: "Models",
      icon: <SearchIcon />,
      badge: null,
    },
    {
      id: "documents",
      label: "Documents",
      icon: <DocumentIcon />,
      badge: null,
    },
    {
      id: "mcp",
      label: "MCP",
      icon: <McpIcon />,
      badge: null,
    },
  ];

  // Load chat sessions on component mount and when chat sessions change
  useEffect(() => {
    loadChatSessions();
  }, []);

  // Refresh sessions when chatSessions object changes
  useEffect(() => {
    // This will trigger a re-render when sessions are updated
  }, [chatSessions]);

  const loadChatSessions = async () => {
    try {
      setLoadingChatSessions(true);
      const result = await invoke("get_chat_sessions");
      setChatSessions(result.sessions || {});

      // Don't override active session if we already have a temporary session
      // This ensures the new temporary session created on startup is preserved
      if (!temporarySession && !activeChatSessionId) {
        setActiveChatSessionId(result.active_session_id);

        // If no active session exists, create a new chat automatically
        if (!result.active_session_id) {
          await createNewChat();
        }
      }
    } catch (error) {
      console.error("Sidebar: Failed to load chat sessions:", error);
      showNotification("Failed to load chat sessions", "error");
    } finally {
      setLoadingChatSessions(false);
    }
  };

  const getLoadedModel = async () => {
    try {
      const ovmsStatus = await invoke("check_ovms_status");
      if (ovmsStatus && ovmsStatus.loaded_models && ovmsStatus.loaded_models.length > 0) {
        // Sort models to ensure consistency, then return the first one
        const sortedModels = ovmsStatus.loaded_models.sort();
        const modelId = `OpenVINO/${sortedModels[0]}`;
        
        // Update global loaded model state
        setLoadedModel(modelId);
        
        return modelId;
      }
    } catch (error) {
      console.error("Failed to get loaded model:", error);
    }
    
    // Clear loaded model state if no models are loaded
    setLoadedModel(null);
    return null;
  };

  const createNewChat = async () => {
    try {
      // Get the currently loaded model to pre-select it
      const loadedModel = await getLoadedModel();
      
      const newSession = await invoke("create_temporary_chat_session", {
        title: "New Chat",
      });
      
      // If we have a loaded model, set it as the model_id for the session
      if (loadedModel) {
        newSession.model_id = loadedModel;
      }
      
      clearTemporarySession();
      setTemporarySession(newSession);
      setActiveChatSessionId(newSession.id);
      onPageChange("chat");
      showNotification("New chat created", "success");
    } catch (error) {
      console.error("Sidebar: Failed to create new chat:", error);
      showNotification("Failed to create new chat", "error");
    }
  };

  const selectChatSession = async (sessionId) => {
    try {
      await invoke("set_active_chat_session", { sessionId });
      setActiveChatSessionId(sessionId);
      if (temporarySession && temporarySession.id !== sessionId) {
        clearTemporarySession();
      }
      
      // If the selected session doesn't have a model_id, try to set a consistent loaded model
      const session = chatSessions[sessionId];
      if (session && !session.model_id) {
        const loadedModel = await getLoadedModel();
        if (loadedModel) {
          try {
            await invoke("update_chat_session", {
              sessionId: sessionId,
              title: null, // Don't change the title
              modelId: loadedModel,
            });
            // Update local state
            updateChatSession({ ...session, model_id: loadedModel });
          } catch (error) {
            console.error("Failed to update session with loaded model:", error);
          }
        }
      }
      
      onPageChange("chat");
    } catch (error) {
      console.error("Sidebar: Failed to select chat session:", error);
      showNotification("Failed to select chat session", "error");
    }
  };

  const deleteChatSession = async (sessionId, event) => {
    event.stopPropagation();
    try {
      await invoke("delete_chat_session", { sessionId });
      removeChatSession(sessionId);
      if (sessionId === activeChatSessionId) {
        await createNewChat();
      }
      showNotification("Chat session deleted", "success");
    } catch (error) {
      console.error("Sidebar: Failed to delete chat session:", error);
      showNotification("Failed to delete chat session", "error");
    }
  };

  const handleSettingsClick = () => {
    setSettingsDialogOpen(true);
  };

  const handleOvmsStatusClick = () => {
    setOvmsStatusDialogOpen(true);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: theme.transitions.create("width", {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          overflowX: "hidden",
        },
      }}
    >
      {/* Header - More Compact */}
      <Box sx={{ p: 1, textAlign: "center", position: "relative", mb: 1.5 }}>
        <IconButton
          onClick={onToggleCollapse}
          sx={{
            position: isCollapsed ? "static" : "absolute",
            top: isCollapsed ? 0 : 8,
            left: isCollapsed ? 0 : 12,
            mt: 0,
          }}
        >
          {isCollapsed ? <MenuIcon /> : <MenuOpenIcon />}
        </IconButton>
        {!isCollapsed && (
          <Typography
            variant="h6"
            component="h3"
            fontWeight="bold"
            color="primary"
            sx={{ mt: 0.5, fontSize: "1.1rem" }}
          >
            SparrowAI
          </Typography>
        )}
      </Box>

      {/* New Chat Button - More Compact */}
      {!isCollapsed && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<AddIcon />}
            onClick={createNewChat}
            sx={{
              borderRadius: 1.5,
              borderColor: "primary.main",
              color: "primary.main",
              py: 0.75,
              fontSize: "0.85rem",
              "&:hover": {
                backgroundColor: "primary.main",
                color: "white",
              },
            }}
          >
            New Chat
          </Button>
        </Box>
      )}

      {isCollapsed && (
        <Box sx={{ px: 1, pb: 1.5 }}>
          <Tooltip title="New Chat" placement="right" arrow>
            <IconButton
              onClick={createNewChat}
              sx={{
                width: "100%",
                color: "primary.main",
                border: 1,
                borderColor: "primary.main",
                borderRadius: 1.5,
                py: 0.75,
                "&:hover": {
                  backgroundColor: "primary.main",
                  color: "white",
                },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Top Menu Items - More Compact */}
      <List sx={{ px: 1, py: 0 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip
              title={isCollapsed ? item.label : ""}
              placement="right"
              arrow
            >
              <ListItemButton
                selected={currentPage === item.id}
                onClick={() => onPageChange(item.id)}
                sx={{
                  borderRadius: 1.5,
                  justifyContent: isCollapsed ? "center" : "initial",
                  px: isCollapsed ? 1.5 : 2,
                  py: 0.75,
                  minHeight: 40,
                  "&.Mui-selected": {
                    backgroundColor: theme.palette.primary.main,
                    color: "white",
                    "&:hover": {
                      backgroundColor: theme.palette.primary.dark,
                    },
                    "& .MuiListItemIcon-root": {
                      color: "white",
                    },
                  },
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        fontSize: "0.85rem",
                        fontWeight: currentPage === item.id ? 600 : 400,
                      },
                    }}
                  />
                )}
                {!isCollapsed && item.badge && (
                  <Box
                    sx={{
                      backgroundColor: theme.palette.primary.main,
                      color: "white",
                      borderRadius: "50%",
                      minWidth: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  >
                    {item.badge}
                  </Box>
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 0.5 }} />

      {/* Chat Sessions List */}
      {!isCollapsed && (
        <Box sx={{ px: 2, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontSize: "0.75rem" }}>
            Recent Chats
          </Typography>
        </Box>
      )}

      <List sx={{ px: 1, py: 0, flexGrow: 1, overflow: "auto" }}>
        {/* Show temporary session first if it exists */}
        {temporarySession && (
          <ListItem key={temporarySession.id} disablePadding sx={{ mb: 0.25 }}>
            <Tooltip
              title={isCollapsed ? temporarySession.title : ""}
              placement="right"
              arrow
            >
              <ListItemButton
                selected={activeChatSessionId === temporarySession.id}
                onClick={() => {
                  setActiveChatSessionId(temporarySession.id);
                  onPageChange("chat");
                }}
                sx={{
                  borderRadius: 1.5,
                  justifyContent: isCollapsed ? "center" : "initial",
                  px: 1.5,
                  py: 0.5,
                  minHeight: 36,
                  "&.Mui-selected": {
                    backgroundColor: theme.palette.action.selected,
                  },
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 28,
                    justifyContent: "center",
                  }}
                >
                  <ChatIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={temporarySession.title}
                    slotProps={{
                      primary: {
                        fontSize: "0.8rem",
                        fontWeight:
                          activeChatSessionId === temporarySession.id
                            ? 500
                            : 400,
                        noWrap: true,
                        fontStyle: "italic",
                        lineHeight: 1.2,
                        opacity: 0.8,
                      },
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* Show persisted sessions */}
        {Object.values(chatSessions)
          .filter((session) => session.messages && session.messages.length > 0)
          .sort((a, b) => b.updated_at - a.updated_at) // Sort by updated_at descending (newest first)
          .map((session) => (
            <ListItem key={session.id} disablePadding sx={{ mb: 0.25 }}>
              <Tooltip
                title={isCollapsed ? session.title : ""}
                placement="right"
                arrow
              >
                <ListItemButton
                  selected={activeChatSessionId === session.id}
                  onClick={() => selectChatSession(session.id)}
                  sx={{
                    borderRadius: 1.5,
                    justifyContent: isCollapsed ? "center" : "initial",
                    px: isCollapsed ? 1.5 : 1.5,
                    py: 0.5,
                    minHeight: 36,
                    "&.Mui-selected": {
                      backgroundColor: theme.palette.action.selected,
                    },
                    "&:hover": {
                      backgroundColor: theme.palette.action.hover,
                      "& .delete-button": {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 28,
                      justifyContent: "center",
                    }}
                  >
                    <ChatIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  {!isCollapsed && (
                    <>
                      <ListItemText
                        primary={session.title}
                        slotProps={{
                          primary: {
                            fontSize: "0.8rem",
                            fontWeight:
                              activeChatSessionId === session.id ? 500 : 400,
                            noWrap: true,
                            lineHeight: 1.2,
                          },
                        }}
                      />
                      <IconButton
                        size="small"
                        className="delete-button"
                        onClick={(e) => deleteChatSession(session.id, e)}
                        sx={{
                          opacity: 0,
                          transition: "opacity 0.2s",
                          color: "text.secondary",
                          p: 0.25,
                          "&:hover": {
                            color: "error.main",
                          },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />

      {/* Bottom Items - More Compact */}
      <List sx={{ px: 1, py: 1.5 }}>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <Tooltip
            title={isCollapsed ? "OVMS Status" : ""}
            placement="right"
            arrow
          >
            <ListItemButton
              onClick={handleOvmsStatusClick}
              sx={{
                borderRadius: 1.5,
                justifyContent: isCollapsed ? "center" : "initial",
                px: isCollapsed ? 1.5 : 2,
                py: 0.75,
                minHeight: 40,
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, justifyContent: "center" }}>
                <MemoryIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary="OVMS Status"
                  slotProps={{
                    primary: {
                      fontSize: "0.85rem",
                    },
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        <ListItem disablePadding>
          <Tooltip
            title={isCollapsed ? "Settings" : ""}
            placement="right"
            arrow
          >
            <ListItemButton
              onClick={handleSettingsClick}
              sx={{
                borderRadius: 1.5,
                justifyContent: isCollapsed ? "center" : "initial",
                px: isCollapsed ? 1.5 : 2,
                py: 0.75,
                minHeight: 40,
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, justifyContent: "center" }}>
                <SettingsIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary="Settings"
                  slotProps={{
                    primary: {
                      fontSize: "0.85rem",
                    },
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>

      {/* OVMS Status Dialog */}
      <OvmsStatusDialog
        open={ovmsStatusDialogOpen}
        onClose={() => setOvmsStatusDialogOpen(false)}
      />
    </Drawer>
  );
};

export default Sidebar;
