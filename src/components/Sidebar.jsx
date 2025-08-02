import React from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Chat as ChatIcon,
  MenuOpen as MenuOpenIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Sidebar = ({ currentPage, onPageChange, isCollapsed, onToggleCollapse }) => {
  const theme = useTheme();
  const { setSettingsDialogOpen, downloadedModels } = useAppStore();
  
  const drawerWidth = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const menuItems = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <ChatIcon />,
      description: 'Chat with AI Models',
    },
    {
      id: 'models',
      label: 'Models',
      icon: <SearchIcon />,
      description: 'Search & Manage Models',
      badge: downloadedModels.size > 0 ? downloadedModels.size : null,
    },
  ];

  const handleSettingsClick = () => {
    setSettingsDialogOpen(true);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.grey[50],
          borderRight: `1px solid ${theme.palette.divider}`,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ p: isCollapsed ? 1 : 3, textAlign: 'center', position: 'relative' }}>
        {!isCollapsed && (
          <>
            <Typography variant="h5" component="h1" fontWeight="bold" color="primary">
              SparrowAI
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              AI Assistant Platform
            </Typography>
          </>
        )}
        
        <IconButton
          onClick={onToggleCollapse}
          sx={{
            position: isCollapsed ? 'static' : 'absolute',
            top: isCollapsed ? 0 : 8,
            right: isCollapsed ? 0 : 8,
            mt: isCollapsed ? 1 : 0,
          }}
        >
          {isCollapsed ? <MenuIcon /> : <MenuOpenIcon />}
        </IconButton>
      </Box>
      
      <Divider />

      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
            <Tooltip 
              title={isCollapsed ? `${item.label} - ${item.description}` : ''} 
              placement="right"
              arrow
            >
              <ListItemButton
                selected={currentPage === item.id}
                onClick={() => onPageChange(item.id)}
                sx={{
                  borderRadius: 2,
                  justifyContent: isCollapsed ? 'center' : 'initial',
                  px: isCollapsed ? 2 : 2,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon 
                  sx={{ 
                    minWidth: 40,
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!isCollapsed && (
                  <>
                    <ListItemText 
                      primary={item.label}
                      secondary={currentPage !== item.id ? item.description : null}
                      primaryTypographyProps={{
                        fontSize: '0.95rem',
                        fontWeight: currentPage === item.id ? 600 : 400,
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.8rem',
                      }}
                    />
                    {item.badge && (
                      <Box
                        sx={{
                          backgroundColor: theme.palette.error.main,
                          color: 'white',
                          borderRadius: '50%',
                          minWidth: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
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
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: theme.palette.error.main,
                      color: 'white',
                      borderRadius: '50%',
                      minWidth: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
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

      <Box sx={{ flexGrow: 1 }} />

      <Divider />

      <List sx={{ px: 1, py: 2 }}>
        <ListItem disablePadding>
          <Tooltip 
            title={isCollapsed ? 'Settings' : ''} 
            placement="right"
            arrow
          >
            <ListItemButton
              onClick={handleSettingsClick}
              sx={{
                borderRadius: 2,
                justifyContent: isCollapsed ? 'center' : 'initial',
                px: isCollapsed ? 2 : 2,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center' }}>
                <SettingsIcon />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="Settings"
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        <ListItem disablePadding sx={{ mt: 1 }}>
          <Tooltip 
            title={isCollapsed ? 'About' : ''} 
            placement="right"
            arrow
          >
            <ListItemButton
              sx={{
                borderRadius: 2,
                justifyContent: isCollapsed ? 'center' : 'initial',
                px: isCollapsed ? 2 : 2,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center' }}>
                <InfoIcon />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText 
                  primary="About"
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
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