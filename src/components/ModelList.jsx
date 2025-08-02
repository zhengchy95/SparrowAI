import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  IconButton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  ThumbUp as ThumbUpIcon,
  GetApp as GetAppIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';

const ModelCard = ({ model }) => {
  const { 
    setSelectedModel, 
    setModelDownloading, 
    isModelDownloading, 
    isModelDownloaded,
    addDownloadedModel,
    removeDownloadedModel,
    getDownloadProgress,
    settings, 
    showNotification 
  } = useAppStore();
  
  const isDownloading = isModelDownloading(model.id);
  const isDownloaded = isModelDownloaded(model.id);
  const downloadProgress = getDownloadProgress(model.id);

  const handleDownload = async () => {
    setModelDownloading(model.id, true);
    showNotification(`Starting download of ${model.id}...`, 'info');
    
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
      
      const result = await invoke('download_entire_model', {
        modelId: model.id,
        downloadPath: downloadPath,
      });
      
      console.log('Download completed:', result);
      addDownloadedModel(model.id);
      showNotification(`Download completed!\n\n${result}`, 'success');
    } catch (error) {
      console.error('Download failed:', error);
      showNotification(`Download failed: ${error}`, 'error');
    } finally {
      setModelDownloading(model.id, false);
    }
  };

  const handleDelete = async () => {
    // Show confirmation dialog
    const userConfirmed = window.confirm(`Are you sure you want to delete ${model.id}? This will permanently remove all downloaded files.`);
    
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
        modelId: model.id,
        downloadPath: downloadPath,
      });
      
      // Only remove from UI state if backend deletion succeeded
      removeDownloadedModel(model.id);
      showNotification(result, 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      showNotification(`Failed to delete model: ${error}`, 'error');
    }
  };

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              {model.id}
            </Typography>
            {model.author && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {model.author}
                </Typography>
              </Box>
            )}
            {model.pipeline_tag && (
              <Chip 
                label={model.pipeline_tag} 
                size="small" 
                color="primary" 
                sx={{ mr: 1, mb: 1 }} 
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <IconButton 
              color="primary" 
              onClick={() => setSelectedModel(model)}
              title="View Details"
              sx={{ mb: 1 }}
            >
              <InfoIcon />
            </IconButton>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isDownloaded ? (
                <>
                  <Tooltip title="Model Downloaded">
                    <Button
                      startIcon={<CheckCircleIcon />}
                      variant="outlined"
                      size="small"
                      color="success"
                      disabled
                    >
                      Downloaded
                    </Button>
                  </Tooltip>
                  <Tooltip title="Delete Downloaded Model">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={handleDelete}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <Button
                  startIcon={<DownloadIcon />}
                  variant="contained"
                  size="small"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? 'Downloading...' : 'Download'}
                </Button>
              )}
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          {model.downloads && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <GetAppIcon sx={{ mr: 0.5, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {formatNumber(model.downloads)} downloads
              </Typography>
            </Box>
          )}
          {model.likes && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ThumbUpIcon sx={{ mr: 0.5, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {formatNumber(model.likes)} likes
              </Typography>
            </Box>
          )}
        </Box>

        {model.tags && model.tags.length > 0 && (
          <Box sx={{ mb: 1 }}>
            {model.tags.slice(0, 5).map((tag, index) => (
              <Chip 
                key={index} 
                label={tag} 
                size="small" 
                variant="outlined" 
                sx={{ mr: 0.5, mb: 0.5 }} 
              />
            ))}
            {model.tags.length > 5 && (
              <Typography variant="body2" color="text.secondary" display="inline">
                +{model.tags.length - 5} more
              </Typography>
            )}
          </Box>
        )}

        <Typography variant="body2" color="text.secondary">
          Last modified: {formatDate(model.last_modified)}
        </Typography>

        {isDownloading && downloadProgress && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Downloading: {downloadProgress.currentFile} ({downloadProgress.fileIndex}/{downloadProgress.totalFiles})
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={downloadProgress.progress} 
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {downloadProgress.progress}% complete
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const ModelList = () => {
  const { searchResults, searchQuery } = useAppStore();

  if (!searchQuery) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Search for Hugging Face models to get started
        </Typography>
      </Box>
    );
  }

  if (searchResults.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No models found for "{searchQuery}"
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Try searching for a different model name
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Search Results ({searchResults.length})
      </Typography>
      <Grid container spacing={2}>
        {searchResults.map((model, index) => (
          <Grid item xs={12} key={index}>
            <ModelCard model={model} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ModelList;