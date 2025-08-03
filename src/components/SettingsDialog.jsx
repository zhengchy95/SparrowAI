import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Switch,
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';

const SettingsDialog = () => {
  const { 
    settingsDialogOpen, 
    setSettingsDialogOpen,
    themeMode,
    setThemeMode,
    settings,
    updateSettings
  } = useAppStore();

  const handleClose = () => {
    setSettingsDialogOpen(false);
  };

  const handleThemeChange = (event) => {
    setThemeMode(event.target.value);
  };

  const handleConversationHistoryChange = (event) => {
    updateSettings({ includeConversationHistory: event.target.checked });
  };

  return (
    <Dialog 
      open={settingsDialogOpen} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Settings</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="h6" gutterBottom>
            Appearance
          </Typography>
          
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ mb: 2, fontWeight: 500 }}>
              Theme Mode
            </FormLabel>
            <RadioGroup
              value={themeMode}
              onChange={handleThemeChange}
              sx={{ ml: 1 }}
            >
              <FormControlLabel 
                value="light" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LightModeIcon sx={{ fontSize: 20 }} />
                    Light
                  </Box>
                }
              />
              <FormControlLabel 
                value="dark" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DarkModeIcon sx={{ fontSize: 20 }} />
                    Dark
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Chat Settings
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.includeConversationHistory || false}
                onChange={handleConversationHistoryChange}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 20 }} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Include Conversation History
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Include previous messages in AI responses for better context
                  </Typography>
                </Box>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 2 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Application Settings
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Additional settings coming soon.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;