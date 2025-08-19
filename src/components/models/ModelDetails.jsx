import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  ThumbUp as ThumbUpIcon,
  GetApp as GetAppIcon,
  CalendarToday as CalendarIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import { useModels, useUI } from '../../store';

const ModelDetails = () => {
  const { 
    selectedModel, 
    setSelectedModel
  } = useModels();
  const { showNotification } = useUI();

  const handleClose = () => {
    setSelectedModel(null);
  };

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!selectedModel) return null;

  return (
    <Dialog 
      open={!!selectedModel} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{selectedModel.id}</Typography>
          <Button onClick={handleClose} color="inherit">
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="h6" gutterBottom>
            Model Information
          </Typography>
          
          {selectedModel.author && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body1">
                <strong>Author:</strong> {selectedModel.author}
              </Typography>
            </Box>
          )}

          {selectedModel.pipeline_tag && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" gutterBottom>
                <strong>Pipeline:</strong>
              </Typography>
              <Chip 
                label={selectedModel.pipeline_tag} 
                color="primary" 
                variant="outlined"
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {selectedModel.downloads && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <GetAppIcon sx={{ mr: 0.5, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {formatNumber(selectedModel.downloads)} downloads
                </Typography>
              </Box>
            )}
            {selectedModel.likes && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ThumbUpIcon sx={{ mr: 0.5, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {formatNumber(selectedModel.likes)} likes
                </Typography>
              </Box>
            )}
          </Box>

          {selectedModel.created_at && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                <strong>Created:</strong> {formatDate(selectedModel.created_at)}
              </Typography>
            </Box>
          )}

          {selectedModel.last_modified && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                <strong>Last Modified:</strong> {formatDate(selectedModel.last_modified)}
              </Typography>
            </Box>
          )}

          {selectedModel.sha && (
            <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace' }}>
              <strong>SHA:</strong> {selectedModel.sha.length > 12 ? selectedModel.sha.substring(0, 12) + '...' : selectedModel.sha}
            </Typography>
          )}

          {selectedModel.tags && selectedModel.tags.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TagIcon sx={{ mr: 1 }} />
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedModel.tags.map((tag, index) => (
                  <Chip 
                    key={index} 
                    label={tag} 
                    size="small" 
                    variant="outlined" 
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelDetails;