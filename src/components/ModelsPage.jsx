import React, { useState } from 'react';
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
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import SearchBar from './SearchBar';
import ModelList from './ModelList';
import ModelDetails from './ModelDetails';
import OvmsStatusDialog from './OvmsStatusDialog';
import useAppStore from '../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';

const DownloadedModelCard = ({ modelId }) => {
  const { removeDownloadedModel, showNotification } = useAppStore();

  const handleDelete = async () => {
    const userConfirmed = window.confirm(`Are you sure you want to delete ${modelId}? This will permanently remove all downloaded files.`);
    
    if (!userConfirmed) {
      return;
    }

    try {
      // Always use default path (no custom download location)
      const result = await invoke('delete_downloaded_model', {
        modelId: modelId,
        downloadPath: null, // Use default path
      });
      
      removeDownloadedModel(modelId);
      showNotification(result, 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      showNotification(`Failed to delete model: ${error}`, 'error');
    }
  };

  const handleOpenFolder = async () => {
    try {
      // Always use default path (no custom download location)
      const result = await invoke('open_model_folder', {
        modelId: modelId,
        downloadPath: null, // Use default path
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

const ModelsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [ovmsStatusDialogOpen, setOvmsStatusDialogOpen] = useState(false);
  const { downloadedModels } = useAppStore();
  const downloadedModelsList = Array.from(downloadedModels);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Models
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Search, download, and manage your AI models
      </Typography>

      <Tabs 
        value={activeTab} 
        onChange={handleTabChange} 
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab 
          icon={<SearchIcon />} 
          label="Browse Models" 
          iconPosition="start"
        />
        <Tab 
          icon={<DownloadIcon />} 
          label={`Downloaded (${downloadedModelsList.length})`}
          iconPosition="start"
        />
      </Tabs>

      {activeTab === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Hugging Face Models
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Search and download models from the Hugging Face Hub
          </Typography>
          
          <SearchBar />
          <ModelList />
          <ModelDetails />
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Downloaded Models
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage your locally downloaded models
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => setOvmsStatusDialogOpen(true)}
              startIcon={<SettingsIcon />}
              size="small"
            >
              Check OVMS
            </Button>
          </Box>

          {downloadedModelsList.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No downloaded models found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Download some models from the Browse Models tab to see them here
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setActiveTab(0)}
                sx={{ mt: 2 }}
                startIcon={<SearchIcon />}
              >
                Browse Models
              </Button>
            </Card>
          ) : (
            <>
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
      )}

      {/* OVMS Status Dialog */}
      <OvmsStatusDialog 
        open={ovmsStatusDialogOpen} 
        onClose={() => setOvmsStatusDialogOpen(false)} 
      />
    </Box>
  );
};

export default ModelsPage;