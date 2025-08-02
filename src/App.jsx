import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Typography, Card, CardContent } from '@mui/material';
import Sidebar from './components/Sidebar';
import ModelsPage from './components/ModelsPage';
import DownloadsPage from './components/DownloadsPage';
import SettingsDialog from './components/SettingsDialog';
import NotificationSnackbar from './components/NotificationSnackbar';
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
  const [currentPage, setCurrentPage] = useState('models');
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  
  // Initialize downloaded models check and progress listening
  useDownloadedModels();

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatPage />;
      case 'models':
        return <ModelsPage />;
      case 'downloads':
        return <DownloadsPage />;
      default:
        return <ModelsPage />;
    }
  };
  
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
