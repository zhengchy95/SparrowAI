import React, { useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { 
  CssBaseline, 
  Typography, 
  LinearProgress, 
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  CircularProgress
} from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Components
import { 
  Sidebar, 
  AppLayout 
} from "./components/layout";
import { ChatPage } from "./components/chat";
import { ModelsPage } from "./components/models";
import { DocumentsPage } from "./components/documents";
import { McpPage } from "./components/mcp";
import { SettingsDialog } from "./components/settings";
import { NotificationSnackbar } from "./components/ui";

// Hooks and Store
import { useDownloadedModels } from "./hooks";
import { useUI, useTheme as useAppTheme, useModels, useChat } from "./store";
import { createAppTheme } from "./theme";

function App() {
  const { 
    currentPage, 
    setCurrentPage,
    showNotification 
  } = useUI();
  
  const { themeMode = "dark", themeColor = "orange" } = useAppTheme();
  const { setIsOvmsRunning } = useModels();
  const {
    setActiveChatSessionId,
    clearCurrentChatMessages,
    clearTemporarySession,
    setTemporarySession,
  } = useChat();
  
  const [initStatus, setInitStatus] = React.useState(null);
  const [showInitDialog, setShowInitDialog] = React.useState(false);

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
  }, [setIsOvmsRunning, showNotification]);

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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      <AppLayout
        sidebar={
          <Sidebar
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        }
      >
        {renderPage()}
      </AppLayout>

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
    </ThemeProvider>
  );
}

export default App;