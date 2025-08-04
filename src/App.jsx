import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, Box, Typography, Card, CardContent } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import ModelsPage from "./components/ModelsPage";
import SettingsDialog from "./components/SettingsDialog";
import NotificationSnackbar from "./components/NotificationSnackbar";
import InitialSetup from "./components/InitialSetup";
import useDownloadedModels from "./hooks/useDownloadedModels";
import useAppStore from "./store/useAppStore";
import useChatStore from "./store/useChatStore";
import { createAppTheme } from "./Themes";

// Import ChatPage component
import ChatPage from "./components/ChatPage";

function App() {
  const [currentPage, setCurrentPage] = useState("chat");
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    themeMode,
    showNotification,
    setIsOvmsRunning,
  } = useAppStore();
  const {
    setActiveChatSessionId,
    clearCurrentChatMessages,
    clearTemporarySession,
    setTemporarySession,
  } = useChatStore();

  // Create theme based on current mode
  const theme = createAppTheme(themeMode);

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

  // Check if initial setup is needed
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        showNotification("Checking OVMS server status...", "info");
        const ovmsPresent = await invoke("check_ovms_present");
        setIsSetupComplete(ovmsPresent);

        // If OVMS is present, check if it's running first
        if (ovmsPresent) {
          try {
            // First check if OVMS is already running
            await invoke("check_ovms_status");
            setIsOvmsRunning(true);
            showNotification("OVMS server is running", "success");
          } catch {
            // OVMS not running, start it
            try {
              showNotification("Starting OVMS server...", "info", 10000);
              await invoke("start_ovms_server");
              setIsOvmsRunning(true);
              showNotification("OVMS server started successfully", "success");
            } catch (serverError) {
              console.warn("Failed to start OVMS server:", serverError);
              setIsOvmsRunning(false);
              showNotification(
                `Failed to start OVMS server: ${serverError}`,
                "error"
              );
              // Don't fail the app if server startup fails
            }
          }
        } else {
          setIsOvmsRunning(false);
          showNotification("OVMS server not found - setup required", "warning");
        }
      } catch (error) {
        console.error("Failed to check OVMS status:", error);
        setIsOvmsRunning(false);
        showNotification(`Failed to check OVMS status: ${error}`, "error");
        // If we can't check, assume setup is needed
        setIsSetupComplete(false);
      } finally {
        setIsCheckingSetup(false);
      }
    };

    checkSetupStatus();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case "chat":
        return <ChatPage />;
      case "models":
        return <ModelsPage />;
      default:
        return <ChatPage />;
    }
  };

  // Show initial setup if OVMS is not present
  if (!isSetupComplete) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <InitialSetup onSetupComplete={() => setIsSetupComplete(true)} />
      </ThemeProvider>
    );
  }

  // Show main app if setup is complete
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
      </Box>
    </ThemeProvider>
  );
}

export default App;
