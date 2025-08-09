import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { 
  CssBaseline, 
  Box, 
  Typography, 
  LinearProgress, 
  Dialog,
  DialogTitle,
  DialogContent,
  Backdrop,
  CircularProgress
} from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./components/Sidebar";
import ModelsPage from "./components/ModelsPage";
import SettingsDialog from "./components/SettingsDialog";
import NotificationSnackbar from "./components/NotificationSnackbar";
import useDownloadedModels from "./hooks/useDownloadedModels";
import useAppStore from "./store/useAppStore";
import useChatStore from "./store/useChatStore";
import { createAppTheme } from "./Themes";

// Import ChatPage component
import ChatPage from "./components/ChatPage";
import DocumentsPage from "./components/DocumentsPage";
import McpPage from "./components/McpPage";

function App() {
  const [currentPage, setCurrentPage] = useState("chat");
  const [initStatus, setInitStatus] = useState(null);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    themeMode,
    themeColor,
    showNotification,
    setIsOvmsRunning,
  } = useAppStore();
  const {
    setActiveChatSessionId,
    clearCurrentChatMessages,
    clearTemporarySession,
    setTemporarySession,
  } = useChatStore();

  // Create theme based on current mode and color
  const theme = createAppTheme(themeMode, themeColor);

  // Initialize downloaded models check and progress listening
  useDownloadedModels();

  // Create a new chat session on app startup
  useEffect(() => {
    const createNewChatOnStartup = async () => {
      try {
        // Clear any existing state first
        clearTemporarySession();
        clearCurrentChatMessages();

        // Small delay to ensure state is cleared
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Create a new chat session
        const newSession = await invoke("create_temporary_chat_session", {
          title: "New Chat",
        });

        // Set this as the temporary session (not saved to storage yet)
        setTemporarySession(newSession);
        setActiveChatSessionId(newSession.id);

        // Force clear messages again after setting the session
        clearCurrentChatMessages();
      } catch (error) {
        console.error("Failed to create new chat session on startup:", error);
      }
    };

    createNewChatOnStartup();
  }, []); // Run only once on app mount

  // Monitor OVMS initialization status
  useEffect(() => {
    const checkInitStatus = async () => {
      try {
        const status = await invoke("get_initialization_status");
        setInitStatus(status);
        
        // Show dialog if initialization is in progress
        if (!status.is_complete && !status.has_error) {
          setShowInitDialog(true);
        }
        
        if (status.is_complete) {
          setIsOvmsRunning(true);
          showNotification("OVMS initialized successfully", "success");
          
          // Emit event to trigger model status refresh in ChatPage
          window.dispatchEvent(new CustomEvent('ovms-initialization-complete'));
        } else if (status.has_error) {
          setIsOvmsRunning(false);
          showNotification(status.error_message || "OVMS initialization failed", "error");
        }
      } catch (error) {
        console.error("Failed to get initialization status:", error);
      }
    };

    // Check initial status
    checkInitStatus();

    // Listen for status updates from Rust
    const unlisten = listen("ovms-init-status", (event) => {
      const status = event.payload;
      setInitStatus(status);
      
      // Show dialog when initialization starts
      if (!status.is_complete && !status.has_error) {
        setShowInitDialog(true);
      }
      
      if (status.is_complete) {
        setIsOvmsRunning(true);
        showNotification("OVMS initialized successfully", "success");
        // Close dialog after a brief delay to show completion
        setTimeout(() => setShowInitDialog(false), 1000);
        
        // Emit event to trigger model status refresh in ChatPage
        window.dispatchEvent(new CustomEvent('ovms-initialization-complete'));
      } else if (status.has_error) {
        setIsOvmsRunning(false);
        showNotification(status.error_message || "OVMS initialization failed", "error");
        setShowInitDialog(false);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case "chat":
        return <ChatPage />;
      case "models":
        return <ModelsPage />;
      case "documents":
        return <DocumentsPage />;
      case "mcp":
        return <McpPage />;
      default:
        return <ChatPage />;
    }
  };

  // Show main app
  const DRAWER_WIDTH = 240;
  const DRAWER_WIDTH_COLLAPSED = 64;
  const drawerWidth = sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", height: "100vh" }}>
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 4 },
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            backgroundColor: "background.default",
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            display: "flex",
            flexDirection: "column",
            maxWidth: "100%",
            height: "100vh",
          }}
        >
          <Box
            sx={{
              maxWidth: currentPage === "chat" ? "800px" : "100%",
              mx: "auto",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderPage()}
          </Box>
        </Box>

        <SettingsDialog />
        <NotificationSnackbar />
        
        {/* OVMS Initialization Dialog */}
        <Dialog
          open={showInitDialog}
          disableEscapeKeyDown
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              backgroundColor: "background.paper",
              backdropFilter: "blur(10px)",
            }
          }}
        >
          <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                fontWeight: "bold",
                color: "primary.main",
              }}
            >
              SparrowAI
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Initializing OVMS...
            </Typography>
          </DialogTitle>
          
          <DialogContent sx={{ textAlign: "center", pb: 3 }}>
            {initStatus && (
              <Box sx={{ my: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <CircularProgress size={20} sx={{ mr: 2, color: "primary.main" }} />
                  <Typography variant="body1" color="text.primary">
                    {initStatus.message}
                  </Typography>
                </Box>
                
                <LinearProgress
                  variant="determinate"
                  value={initStatus.progress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    mb: 1,
                    backgroundColor: "action.hover",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 4,
                      backgroundColor: "primary.main",
                    },
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {initStatus.progress}%
                </Typography>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;
