import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Typography, Card, CardContent } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import Sidebar from './components/Sidebar';
import ModelsPage from './components/ModelsPage';
import SettingsDialog from './components/SettingsDialog';
import NotificationSnackbar from './components/NotificationSnackbar';
import InitialSetup from './components/InitialSetup';
import useDownloadedModels from './hooks/useDownloadedModels';
import useAppStore from './store/useAppStore';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Import ChatPage component
import ChatPage from './components/ChatPage';

function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  
  // Initialize downloaded models check and progress listening
  useDownloadedModels();

  // Check if initial setup is needed
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const ovmsPresent = await invoke('check_ovms_present');
        setIsSetupComplete(ovmsPresent);
      } catch (error) {
        console.error('Failed to check OVMS status:', error);
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
      case 'chat':
        return <ChatPage />;
      case 'models':
        return <ModelsPage />;
      default:
        return <ChatPage />;
    }
  };
  
  // Show loading screen while checking setup status
  if (isCheckingSetup) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default',
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Loading...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

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
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
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
            p: 4,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            backgroundColor: 'background.default',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          }}
        >
          {renderPage()}
        </Box>
        
        <SettingsDialog />
        <NotificationSnackbar />
      </Box>
    </ThemeProvider>
  );
}

export default App;
