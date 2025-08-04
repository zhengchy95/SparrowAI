import React, { useState, useEffect } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  CheckCircle as LoadedIcon,
  RadioButtonUnchecked as NotLoadedIcon,
} from "@mui/icons-material";
import SearchBar from "./SearchBar";
import ModelList from "./ModelList";
import ModelDetails from "./ModelDetails";
import OvmsStatusDialog from "./OvmsStatusDialog";
import useAppStore from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";

const DownloadedModelCard = ({ modelId, loadedModelId }) => {
  const { removeDownloadedModel, showNotification } = useAppStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isLoaded = loadedModelId === modelId;

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);

    try {
      // Always use default path (no custom download location)
      const result = await invoke("delete_downloaded_model", {
        modelId: modelId,
        downloadPath: null, // Use default path
      });

      removeDownloadedModel(modelId);
      showNotification(result, "success");
    } catch (error) {
      console.error("Delete failed:", error);
      showNotification(`Failed to delete model: ${error}`, "error");
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleOpenFolder = async () => {
    try {
      // Always use default path (no custom download location)
      const result = await invoke("open_model_folder", {
        modelId: modelId,
        downloadPath: null, // Use default path
      });

      showNotification(result, "success");
    } catch (error) {
      console.error("Failed to open folder:", error);
      showNotification(`Failed to open folder: ${error}`, "error");
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              {modelId.includes("/") ? modelId.split("/")[1] : modelId}
            </Typography>
            {modelId.includes("/") && (
              <Chip
                label={modelId.split("/")[0]}
                size="small"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title={isLoaded ? "Model is loaded" : "Model not loaded"}>
              <IconButton
                size="small"
                sx={{
                  color: isLoaded ? "success.main" : "text.disabled",
                  cursor: "default",
                }}
                disabled
              >
                {isLoaded ? <LoadedIcon /> : <NotLoadedIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Open Model Folder">
              <IconButton color="primary" onClick={handleOpenFolder}>
                <FolderIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete Model">
              <IconButton color="error" onClick={handleDeleteClick}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete Model</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete <strong>{modelId}</strong>?
            <br />
            This will permanently remove all downloaded files and cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            No, Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

const ModelsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [ovmsStatusDialogOpen, setOvmsStatusDialogOpen] = useState(false);
  const [loadedModelId, setLoadedModelId] = useState(null);
  const { downloadedModels } = useAppStore();
  const downloadedModelsList = Array.from(downloadedModels);

  // Check loaded model when component mounts or when switching to downloaded models tab
  useEffect(() => {
    if (activeTab === 1) {
      checkLoadedModel();
    }
  }, [activeTab]);

  const checkLoadedModel = async () => {
    try {
      const result = await invoke("get_loaded_model");
      setLoadedModelId(result);
    } catch (error) {
      console.error("Failed to get loaded model:", error);
      setLoadedModelId(null);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<SearchIcon />} label="Browse Models" iconPosition="start" />
        <Tab
          icon={<DownloadIcon />}
          label={`Downloaded (${downloadedModelsList.length})`}
          iconPosition="start"
        />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ width: "100%", overflow: "auto" }}>
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
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 2,
            }}
          >
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
            <Card sx={{ p: 4, textAlign: "center" }}>
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
                  <Grid size={12} key={modelId}>
                    <DownloadedModelCard
                      modelId={modelId}
                      loadedModelId={loadedModelId}
                    />
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
