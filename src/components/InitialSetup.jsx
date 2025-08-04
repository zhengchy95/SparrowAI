import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Alert,
  CircularProgress,
  Fade,
  Zoom,
  Button,
} from "@mui/material";
import {
  Download as DownloadIcon,
  UnarchiveOutlined as ExtractIcon,
  CheckCircle as CheckIcon,
  Settings as SetupIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import useAppStore from "../store/useAppStore";

const InitialSetup = ({ onSetupComplete }) => {
  const { setIsOvmsRunning } = useAppStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [isRetrying, setIsRetrying] = useState(false);

  const steps = [
    {
      label: "Downloading OVMS",
      description: "Downloading OpenVINO Model Server from GitHub releases",
      icon: <DownloadIcon />,
    },
    {
      label: "Extracting Files",
      description: "Extracting and setting up OVMS executable",
      icon: <ExtractIcon />,
    },
    {
      label: "Starting Server",
      description: "Initializing OVMS server for the first time",
      icon: <CheckIcon />,
    },
  ];

  useEffect(() => {
    startSetupProcess();
  }, []);

  const startSetupProcess = async () => {
    try {
      // Step 1: Download OVMS
      setCurrentStep(0);
      setStatusMessage("Downloading OVMS (this may take a few minutes)...");
      setProgress(15);

      const downloadResult = await invoke("download_ovms");
      console.log("Download result:", downloadResult);

      // Step 2: Extraction completed
      setCurrentStep(1);
      setStatusMessage("OVMS downloaded and extracted successfully");
      setProgress(80);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 3: Server startup
      setCurrentStep(2);
      setStatusMessage("Starting OVMS server for the first time...");
      setProgress(95);

      // Start the OVMS server after download
      try {
        await invoke("start_ovms_server"); // Use the new command
        console.log("OVMS server started successfully");
        setIsOvmsRunning(true); // Update the OVMS running state
      } catch (serverErr) {
        console.warn("OVMS server startup warning:", serverErr);
        setIsOvmsRunning(false); // Ensure state is set to false on error
        // Don't fail the setup if server startup has issues
      }

      // Complete
      setProgress(100);
      setStatusMessage("Setup complete! Welcome to SparrowAI");
      setIsComplete(true);

      // Wait a moment before calling onSetupComplete
      setTimeout(() => {
        onSetupComplete();
      }, 2000);
    } catch (err) {
      console.error("Setup failed:", err);
      setError(err.toString());
      setStatusMessage(
        "Setup failed. Please check your internet connection and try again."
      );
      setIsOvmsRunning(false); // Ensure OVMS state is set to false on setup failure
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsRetrying(true);
    setCurrentStep(0);
    setProgress(0);
    setIsComplete(false);
    setStatusMessage("Retrying setup...");
    startSetupProcess();
  };

  const getStepIcon = (stepIndex) => {
    if (stepIndex < currentStep) {
      return (
        <Zoom in>
          <CheckIcon color="success" />
        </Zoom>
      );
    } else if (stepIndex === currentStep) {
      return <CircularProgress size={20} />;
    } else {
      return steps[stepIndex].icon;
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        p: 3,
      }}
    >
      <Fade in timeout={800}>
        <Paper
          elevation={24}
          sx={{
            maxWidth: 600,
            width: "100%",
            p: 4,
            borderRadius: 3,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
          }}
        >
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: "bold",
                background: "linear-gradient(45deg, #667eea, #764ba2)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SparrowAI
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Initial Setup
            </Typography>
            {isComplete && (
              <Chip
                label="Setup Complete!"
                color="success"
                icon={<CheckIcon />}
                sx={{ mt: 1 }}
              />
            )}
          </Box>

          {/* Error Display */}
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  startIcon={
                    isRetrying ? (
                      <CircularProgress size={16} />
                    ) : (
                      <RefreshIcon />
                    )
                  }
                >
                  {isRetrying ? "Retrying..." : "Retry"}
                </Button>
              }
            >
              <Typography variant="body2">{error}</Typography>
            </Alert>
          )}

          {/* Progress Bar */}
          <Box mb={3}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={1}
            >
              <Typography variant="body2" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 4,
                  background: "linear-gradient(45deg, #667eea, #764ba2)",
                },
              }}
            />
          </Box>

          {/* Status Message */}
          <Box textAlign="center" mb={3}>
            <Typography variant="body1" color="text.primary">
              {statusMessage}
            </Typography>
          </Box>

          {/* Steps */}
          <Stepper activeStep={currentStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  icon={getStepIcon(index)}
                  sx={{
                    "& .MuiStepLabel-iconContainer": {
                      color: "text.secondary",
                    },
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: index <= currentStep ? "bold" : "normal",
                      color: "text.secondary",
                    }}
                  >
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {/* Footer */}
          <Box textAlign="center" mt={4}>
            <Typography variant="caption" color="text.secondary">
              Setting up your AI workspace...
            </Typography>
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
};

export default InitialSetup;
