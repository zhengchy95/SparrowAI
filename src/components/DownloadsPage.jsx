import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';

const DownloadedModelCard = ({ modelId }) => {
  const { removeDownloadedModel, settings, showNotification } = useAppStore();

  const handleDelete = async () => {
    // Show confirmation dialog
    const userConfirmed = window.confirm(`Are you sure you want to delete ${modelId}? This will permanently remove all downloaded files.`);
    
    if (!userConfirmed) {
      console.log('User cancelled deletion');
      return;
    }

    try {
      console.log('User confirmed deletion, proceeding...');
      
      // Get the actual download path to use
      let downloadPath = settings.downloadLocation;
      
      // If no custom download location is set, get the default path
      if (!downloadPath) {
        try {
          downloadPath = await invoke('get_default_download_path');
        } catch (error) {
          console.error('Failed to get default download path:', error);
          downloadPath = null; // Fallback to backend default
        }
      }
      
      const result = await invoke('delete_downloaded_model', {
        modelId: modelId,
        downloadPath: downloadPath,
      });
      
      // Only remove from UI state if backend deletion succeeded
      removeDownloadedModel(modelId);
      showNotification(result, 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      showNotification(`Failed to delete model: ${error}`, 'error');
    }
  };

  const handleOpenFolder = async () => {
    try {
      // Get the actual download path to use
      let downloadPath = settings.downloadLocation;
      
      // If no custom download location is set, get the default path
      if (!downloadPath) {
        try {
          downloadPath = await invoke('get_default_download_path');
        } catch (error) {
          console.error('Failed to get default download path:', error);
          downloadPath = null; // Fallback to backend default
        }
      }
      
      const result = await invoke('open_model_folder', {
        modelId: modelId,
        downloadPath: downloadPath,
      });
      
      showNotification(result, 'success');
    } catch (error) {
      console.error('Failed to open folder:', error);
      showNotification(`Failed to open folder: ${error}`, 'error');
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              {modelId.includes('/') ? modelId.split('/')[1] : modelId}
            </Typography>
            {modelId.includes('/') && (
              <Chip 
                label={modelId.split('/')[0]} 
                size="small" 
                variant="outlined"
                sx={{ mb: 1 }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Open Model Folder">
              <IconButton
                color="primary"
                onClick={handleOpenFolder}
              >
                <FolderIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Delete Model">
              <IconButton
                color="error"
                onClick={handleDelete}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DownloadsPage = () => {
  const { downloadedModels, settings } = useAppStore();
  const downloadedModelsList = Array.from(downloadedModels);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Downloaded Models
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage your locally downloaded Hugging Face models
      </Typography>

      {settings.downloadLocation && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>Download Location:</strong> {settings.downloadLocation}
        </Alert>
      )}

      {downloadedModelsList.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No downloaded models found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Download some models from the Models page to see them here
          </Typography>
        </Card>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            {downloadedModelsList.length} Model{downloadedModelsList.length !== 1 ? 's' : ''}
          </Typography>
          
          <Grid container spacing={2}>
            {downloadedModelsList.map((modelId) => (
              <Grid item xs={12} key={modelId}>
                <DownloadedModelCard modelId={modelId} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default DownloadsPage;