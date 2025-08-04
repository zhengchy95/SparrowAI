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
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import useAppStore from "../store/useAppStore";
import useChatStore from "../store/useChatStore";

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Sidebar = ({
  currentPage,
  onPageChange,
  isCollapsed,
  onToggleCollapse,
}) => {
  const theme = useTheme();
  const { setSettingsDialogOpen, downloadedModels, showNotification } =
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

  const drawerWidth = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const menuItems = [
    {
      id: "models",
      label: "Models",
      icon: <SearchIcon />,
      badge: downloadedModels.size > 0 ? downloadedModels.size : null,
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

  const createNewChat = async () => {
    try {
      const newSession = await invoke("create_temporary_chat_session", {
        title: "New Chat",
      });
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
      {/* Header */}
      <Box sx={{ p: 1, textAlign: "center", position: "relative", mb: 2 }}>
        <IconButton
          onClick={onToggleCollapse}
          sx={{
            position: isCollapsed ? "static" : "absolute",
            top: isCollapsed ? 0 : 6,
            left: isCollapsed ? 0 : 8,
            mt: isCollapsed ? 1 : 0,
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
          >
            SparrowAI
          </Typography>
        )}
      </Box>

      {/* New Chat Button */}
      {!isCollapsed && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<AddIcon />}
            onClick={createNewChat}
            sx={{
              borderRadius: 2,
              borderColor: "primary.main",
              color: "primary.main",
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
        <Box sx={{ px: 1, pb: 2 }}>
          <Tooltip title="New Chat" placement="right" arrow>
            <IconButton
              onClick={createNewChat}
              sx={{
                width: "100%",
                color: "primary.main",
                border: 1,
                borderColor: "primary.main",
                borderRadius: 2,
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

      {/* Top Menu Items */}
      <List sx={{ px: 1, py: 0 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
            <Tooltip
              title={isCollapsed ? item.label : ""}
              placement="right"
              arrow
            >
              <ListItemButton
                selected={currentPage === item.id}
                onClick={() => onPageChange(item.id)}
                sx={{
                  borderRadius: 2,
                  justifyContent: isCollapsed ? "center" : "initial",
                  px: isCollapsed ? 2 : 2,
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
                    minWidth: 40,
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!isCollapsed && (
                  <>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: "0.95rem",
                        fontWeight: currentPage === item.id ? 600 : 400,
                      }}
                    />
                    {item.badge && (
                      <Box
                        sx={{
                          backgroundColor: theme.palette.error.main,
                          color: "white",
                          borderRadius: "50%",
                          minWidth: 20,
                          height: 20,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        {item.badge}
                      </Box>
                    )}
                  </>
                )}
                {isCollapsed && item.badge && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      backgroundColor: theme.palette.error.main,
                      color: "white",
                      borderRadius: "50%",
                      minWidth: 16,
                      height: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: "bold",
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

      <Divider sx={{ my: 1 }} />

      {/* Chat Sessions List */}
      {!isCollapsed && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            Recent Chats
          </Typography>
        </Box>
      )}

      <List sx={{ px: 1, py: 0, flexGrow: 1, overflow: "auto" }}>
        {/* Show temporary session first if it exists */}
        {temporarySession && (
          <ListItem key={temporarySession.id} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip
              title={isCollapsed ? temporarySession.title : ""}
              placement="right"
              arrow
            >
              <ListItemButton
                selected={activeChatSessionId === temporarySession.id}
                onClick={() => setActiveChatSessionId(temporarySession.id)}
                sx={{
                  borderRadius: 2,
                  justifyContent: isCollapsed ? "center" : "initial",
                  px: isCollapsed ? 2 : 2,
                  py: 1,
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
                    minWidth: 32,
                    justifyContent: "center",
                  }}
                >
                  <ChatIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={temporarySession.title}
                    primaryTypographyProps={{
                      fontSize: "0.875rem",
                      fontWeight:
                        activeChatSessionId === temporarySession.id ? 500 : 400,
                      noWrap: true,
                      fontStyle: "italic",
                      opacity: 0.8,
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
            <ListItem key={session.id} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip
                title={isCollapsed ? session.title : ""}
                placement="right"
                arrow
              >
                <ListItemButton
                  selected={activeChatSessionId === session.id}
                  onClick={() => selectChatSession(session.id)}
                  sx={{
                    borderRadius: 2,
                    justifyContent: isCollapsed ? "center" : "initial",
                    px: isCollapsed ? 2 : 2,
                    py: 1,
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
                      minWidth: 32,
                      justifyContent: "center",
                    }}
                  >
                    <ChatIcon sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                  {!isCollapsed && (
                    <>
                      <ListItemText
                        primary={session.title}
                        primaryTypographyProps={{
                          fontSize: "0.875rem",
                          fontWeight:
                            activeChatSessionId === session.id ? 500 : 400,
                          noWrap: true,
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
                          "&:hover": {
                            color: "error.main",
                          },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
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

      <List sx={{ px: 1, py: 2 }}>
        <ListItem disablePadding>
          <Tooltip
            title={isCollapsed ? "Settings" : ""}
            placement="right"
            arrow
          >
            <ListItemButton
              onClick={handleSettingsClick}
              sx={{
                borderRadius: 2,
                justifyContent: isCollapsed ? "center" : "initial",
                px: isCollapsed ? 2 : 2,
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, justifyContent: "center" }}>
                <SettingsIcon />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary="Settings"
                  primaryTypographyProps={{
                    fontSize: "0.95rem",
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        <ListItem disablePadding sx={{ mt: 1 }}>
          <Tooltip title={isCollapsed ? "About" : ""} placement="right" arrow>
            <ListItemButton
              sx={{
                borderRadius: 2,
                justifyContent: isCollapsed ? "center" : "initial",
                px: isCollapsed ? 2 : 2,
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, justifyContent: "center" }}>
                <InfoIcon />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary="About"
                  primaryTypographyProps={{
                    fontSize: "0.95rem",
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Drawer>
  );
};

export default Sidebar;
