import React, { useState, useEffect } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  ThumbUp as ThumbUpIcon,
  GetApp as GetAppIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import useAppStore from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";

const ModelCard = ({ modelId }) => {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    setSelectedModel,
    setModelDownloading,
    isModelDownloading,
    isModelDownloaded,
    addDownloadedModel,
    removeDownloadedModel,
    getDownloadProgress,
    showNotification,
  } = useAppStore();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        setLoading(true);
        const modelInfo = await invoke("get_model_info", { modelId });
        setModel(modelInfo);
        setError(null);
      } catch (err) {
        console.error("ModelList: Failed to fetch model info:", err);
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    };

    fetchModelInfo();
  }, [modelId]);

  const isDownloading = model ? isModelDownloading(model.id) : false;
  const isDownloaded = model ? isModelDownloaded(model.id) : false;
  const downloadProgress = model ? getDownloadProgress(model.id) : null;

  const handleDownload = async () => {
    setModelDownloading(model.id, true);
    showNotification(`Starting download of ${model.id}...`, "info");

    try {
      // Always use default path (no custom download location)
      const result = await invoke("download_entire_model", {
        modelId: model.id,
        downloadPath: null, // Use default path
      });

      // ...removed debug log...
      addDownloadedModel(model.id);

      // Extract model name and size from result
      const modelName = model.id.split("/").pop() || model.id;
      const sizeMatch = result.match(/\((\d+(?:\.\d+)?)\s*MB\)/);
      const sizeInMB = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
      const sizeInGB = (sizeInMB / 1024).toFixed(2);

      showNotification(
        `Downloaded: ${modelName}\nSize: ${sizeInGB} GB`,
        "success"
      );
    } catch (error) {
      console.error("ModelList: Download failed:", error);
      showNotification(`Download failed: ${error}`, "error");
    } finally {
      setModelDownloading(model.id, false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);

    try {
      // Always use default path (no custom download location)
      const result = await invoke("delete_downloaded_model", {
        modelId: model.id,
        downloadPath: null, // Use default path
      });

      // Only remove from UI state if backend deletion succeeded
      removeDownloadedModel(model.id);
      showNotification(result, "success");
    } catch (error) {
      console.error("ModelList: Delete failed:", error);
      showNotification(`Failed to delete model: ${error}`, "error");
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return "N/A";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString();
    } catch (e) {
      return "N/A";
    }
  };

  if (loading) {
    return (
      <Card sx={{ mb: 2, width: "100%" }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
            <Skeleton variant="rectangular" width={40} height={40} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
            <Skeleton variant="text" width={100} height={20} />
            <Skeleton variant="text" width={80} height={20} />
          </Box>
          <Skeleton variant="text" width="80%" height={20} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 2, width: "100%" }}>
        <CardContent>
          <Typography color="error" variant="body1">
            Failed to load model: {modelId}
          </Typography>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <Card sx={{ mb: 2, width: "100%" }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              {model.id}
            </Typography>
            {model.author && (
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
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
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <IconButton
              color="primary"
              onClick={() => setSelectedModel(model)}
              title="View Details"
              sx={{ mb: 1 }}
            >
              <InfoIcon />
            </IconButton>

            <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
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
                    <Button
                      startIcon={<DeleteIcon />}
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={handleDeleteClick}
                    >
                      Delete
                    </Button>
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
                  {isDownloading ? "Downloading..." : "Download"}
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          {model.downloads !== undefined && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <GetAppIcon sx={{ mr: 0.5, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {formatNumber(model.downloads)} downloads
              </Typography>
            </Box>
          )}
          {model.likes !== undefined && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
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
              <Typography
                variant="body2"
                color="text.secondary"
                display="inline"
              >
                +{model.tags.length - 5} more
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Last commit: {formatDate(model.last_modified)}
          </Typography>
          {model.sha && (
            <Typography variant="body2" color="text.secondary">
              SHA: {model.sha.substring(0, 7)}
            </Typography>
          )}
        </Box>

        {isDownloading && downloadProgress && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Downloading: {downloadProgress.currentFile} (
              {downloadProgress.fileIndex}/{downloadProgress.totalFiles})
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
            Are you sure you want to delete <strong>{model.id}</strong>?
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

const ModelList = () => {
  const { searchResults, searchQuery, isSearching } = useAppStore();

  if (!searchQuery) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">
          Search for OpenVINO models to get started
        </Typography>
      </Box>
    );
  }

  if (isSearching) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
          Searching for models...
        </Typography>
      </Box>
    );
  }

  if (searchResults.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
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
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
        Search Results ({searchResults.length})
      </Typography>
      <Box>
        {searchResults.map((modelId, index) => (
          <ModelCard key={modelId || index} modelId={modelId} />
        ))}
      </Box>
    </Box>
  );
};

export default ModelList;
