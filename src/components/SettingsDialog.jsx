import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  FolderOpen as FolderIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

const SettingsDialog = () => {
  const { 
    settingsDialogOpen, 
    setSettingsDialogOpen, 
    settings, 
    setDownloadLocation 
  } = useAppStore();
  
  const [tempDownloadLocation, setTempDownloadLocation] = useState('');
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
  const [isChanged, setIsChanged] = useState(false);
  const [ovmsStatus, setOvmsStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (settingsDialogOpen) {
      setTempDownloadLocation(settings.downloadLocation || '');
      setIsChanged(false);
      
      // Get default download path
      const getDefaultPath = async () => {
        try {
          const defaultPath = await invoke('get_default_download_path');
          setDefaultDownloadPath(defaultPath);
        } catch (error) {
          console.error('Failed to get default download path:', error);
          setDefaultDownloadPath('downloads');
        }
      };
      
      getDefaultPath();
    }
  }, [settingsDialogOpen, settings.downloadLocation]);

  const handleClose = () => {
    setSettingsDialogOpen(false);
    setTempDownloadLocation(settings.downloadLocation || '');
    setIsChanged(false);
  };

  const handleSave = () => {
    setDownloadLocation(tempDownloadLocation);
    setIsChanged(false);
    setSettingsDialogOpen(false);
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Download Folder',
        defaultPath: tempDownloadLocation || undefined,
      });
      
      if (selected && typeof selected === 'string') {
        setTempDownloadLocation(selected);
        setIsChanged(selected !== settings.downloadLocation);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleLocationChange = (event) => {
    const newLocation = event.target.value;
    setTempDownloadLocation(newLocation);
    setIsChanged(newLocation !== settings.downloadLocation);
  };

  const handleCheckOvmsStatus = async () => {
    setCheckingStatus(true);
    setStatusError('');
    setOvmsStatus(null);

    try {
      const response = await invoke('check_ovms_status');
      const statusData = JSON.parse(response);
      setOvmsStatus(statusData);
    } catch (error) {
      console.error('Failed to check OVMS status:', error);
      setStatusError(error.toString());
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleGetModelDetails = async (modelName) => {
    try {
      const response = await invoke('get_ovms_model_metadata', { modelName });
      const metadataData = JSON.parse(response);
      console.log('Model metadata:', metadataData);
      
      // Create a more detailed alert with model information
      alert(`Model Details for ${modelName}:\n\n${JSON.stringify(metadataData, null, 2)}`);
    } catch (error) {
      console.error('Failed to get model metadata:', error);
      alert(`Failed to get details for ${modelName}:\n${error.toString()}`);
    }
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
            Download Settings
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose where downloaded models will be saved on your computer.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField
                fullWidth
                label="Download Location"
                value={tempDownloadLocation}
                onChange={handleLocationChange}
                placeholder={defaultDownloadPath || "Select or enter a folder path..."}
                helperText={
                  !tempDownloadLocation 
                    ? `If empty, models will be saved to: ${defaultDownloadPath || 'downloads'}` 
                    : undefined
                }
              />
              <Button
                variant="outlined"
                onClick={handleBrowseFolder}
                startIcon={<FolderIcon />}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                Browse
              </Button>
            </Box>
          </Box>

          {tempDownloadLocation && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Models will be saved to: <strong>{tempDownloadLocation}</strong>
            </Alert>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            OVMS Server Status
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Check the status of your OVMS (OpenVINO Model Server) and view loaded models.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
              <Button
                variant="outlined"
                onClick={handleCheckOvmsStatus}
                disabled={checkingStatus}
                startIcon={checkingStatus ? <CircularProgress size={20} /> : <CheckIcon />}
              >
                {checkingStatus ? 'Checking...' : 'Check OVMS Status'}
              </Button>
            </Box>

            {statusError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Error:</strong> {statusError}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Make sure OVMS server is running on localhost:8000
                </Typography>
              </Alert>
            )}

            {ovmsStatus && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>OVMS Server is running!</strong>
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Loaded Models:</strong>
                  </Typography>
                  {Object.keys(ovmsStatus).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No models currently loaded
                    </Typography>
                  ) : (
                    Object.entries(ovmsStatus).map(([modelName, modelInfo]) => (
                      <Box key={modelName} sx={{ ml: 2, mb: 1 }}>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleGetModelDetails(modelName)}
                          sx={{ p: 0, textTransform: 'none', justifyContent: 'flex-start' }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {modelName}
                          </Typography>
                        </Button>
                        {modelInfo.model_version_status?.map((version, idx) => (
                          <Typography 
                            key={idx} 
                            variant="body2" 
                            color={version.state === 'AVAILABLE' ? 'success.main' : 'error.main'}
                            sx={{ ml: 1 }}
                          >
                            Version {version.version}: {version.state} ({version.status?.error_message || 'OK'})
                            {version.state !== 'AVAILABLE' && (
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ display: 'block', ml: 1, fontStyle: 'italic' }}
                              >
                                Click model name for detailed error info
                              </Typography>
                            )}
                          </Typography>
                        ))}
                      </Box>
                    ))
                  )}
                </Box>
              </Alert>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!isChanged}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;