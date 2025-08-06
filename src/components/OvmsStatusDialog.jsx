import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";

const OvmsStatusDialog = ({ open, onClose }) => {
  const [ovmsStatus, setOvmsStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  // Auto-check status when dialog opens
  useEffect(() => {
    if (open) {
      handleCheckOvmsStatus();
    }
  }, [open]);

  const handleCheckOvmsStatus = async () => {
    setCheckingStatus(true);
    setStatusError("");
    setOvmsStatus(null);

    try {
      const ovmsStatusResponse = await invoke("check_ovms_status");
      console.log(
        "OvmsStatusDialog: OVMS status response:",
        ovmsStatusResponse
      );
      setOvmsStatus(ovmsStatusResponse);
    } catch (error) {
      console.error("OvmsStatusDialog: Failed to check OVMS status:", error);
      setStatusError(error.toString());
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleGetModelDetails = async (modelName) => {
    try {
      const response = await invoke("get_ovms_model_metadata", { modelName });
      const metadataData = JSON.parse(response);
      // ...removed debug log...

      // Create a more detailed alert with model information
      alert(
        `Model Details for ${modelName}:\n\n${JSON.stringify(
          metadataData,
          null,
          2
        )}`
      );
    } catch (error) {
      console.error("OvmsStatusDialog: Failed to get model metadata:", error);
      alert(`Failed to get details for ${modelName}:\n${error.toString()}`);
    }
  };

  const handleClose = () => {
    setOvmsStatus(null);
    setStatusError("");
    setCheckingStatus(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <SettingsIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {checkingStatus
                ? "Checking OVMS Status..."
                : "OVMS Server Status"}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 2 }}>
          {checkingStatus && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <CircularProgress size={24} />
              <Typography variant="body1">
                Checking OVMS server status...
              </Typography>
            </Box>
          )}

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
                  <strong>Status:</strong> {ovmsStatus.status}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>
                    Loaded Models ({ovmsStatus.loaded_models?.length || 0}):
                  </strong>
                </Typography>
                {!ovmsStatus.loaded_models ||
                ovmsStatus.loaded_models.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No models currently loaded
                  </Typography>
                ) : (
                  ovmsStatus.loaded_models.map((modelName, idx) => (
                    <Box key={idx} sx={{ ml: 2, mb: 1 }}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleGetModelDetails(modelName)}
                        sx={{
                          p: 0,
                          textTransform: "none",
                          justifyContent: "flex-start",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                          {modelName}
                        </Typography>
                      </Button>
                      <Typography
                        variant="body2"
                        color="success.main"
                        sx={{ ml: 1 }}
                      >
                        Status: AVAILABLE
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Alert>
          )}
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

export default OvmsStatusDialog;
