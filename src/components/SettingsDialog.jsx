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
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';

const SettingsDialog = () => {
  const { 
    settingsDialogOpen, 
    setSettingsDialogOpen
  } = useAppStore();

  const handleClose = () => {
    setSettingsDialogOpen(false);
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
            Application Settings
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            No settings available at this time. Application uses default configurations.
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