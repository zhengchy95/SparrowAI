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

// Create theme function that takes mode as parameter
const createAppTheme = (mode) => createTheme({
  palette: {
    mode: mode,
    primary: {
      main: '#ff8c00',
      light: '#ffb347',
      dark: '#e67e00',
    },
    secondary: {
      main: '#ffb347',
    },
    background: {
      default: mode === 'dark' ? '#1a1a1a' : '#ffffff',
      paper: mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
    },
    text: {
      primary: mode === 'dark' ? '#ffffff' : '#000000',
      secondary: mode === 'dark' ? '#b0b0b0' : '#666666',
    },
    divider: mode === 'dark' ? '#404040' : '#e0e0e0',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    h4: {
      fontWeight: 600,
      color: '#ffffff',
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: mode === 'dark' ? '#1a1a1a' : '#ffffff',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
          borderRight: mode === 'dark' ? '1px solid #404040' : '1px solid #e0e0e0',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#2d2d2d' : '#ffffff',
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#2d2d2d' : '#ffffff',
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: mode === 'dark' ? '#3a3a3a' : '#ffffff',
            borderRadius: 12,
            '& fieldset': {
              borderColor: mode === 'dark' ? '#505050' : '#d0d0d0',
            },
            '&:hover fieldset': {
              borderColor: mode === 'dark' ? '#606060' : '#b0b0b0',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ff8c00',
            },
          },
          '& .MuiInputLabel-root': {
            color: mode === 'dark' ? '#b0b0b0' : '#666666',
          },
          '& .MuiInputBase-input': {
            color: mode === 'dark' ? '#ffffff' : '#000000',
          },
        },
      },
    },
  },
});

// Import ChatPage component
import ChatPage from './components/ChatPage';

function App() {
  const [currentPage, setCurrentPage] = useState('chat');
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const { sidebarCollapsed, setSidebarCollapsed, themeMode } = useAppStore();
  
  // Create theme based on current mode
  const theme = createAppTheme(themeMode);
  
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
            p: { xs: 2, sm: 4 },
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            backgroundColor: 'background.default',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '100%',
          }}
        >
          <Box sx={{ 
            maxWidth: currentPage === 'chat' ? '800px' : '100%', 
            mx: 'auto',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
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
