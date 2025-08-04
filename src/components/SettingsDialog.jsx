import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Switch,
  TextField,
  Slider,
  Grid,
  Tabs,
  Tab,
  Paper,
  MenuItem,
  Select,
  Chip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  History as HistoryIcon,
  Tune as TuneIcon,
  TextFields as TextFieldsIcon,
  Palette as PaletteIcon,
  Chat as ChatIcon,
  Brightness6 as ThemeIcon,
} from "@mui/icons-material";
import useAppStore from "../store/useAppStore";
import { getAvailableThemeColors } from "../Themes";

const SettingsDialog = () => {
  const [activeTab, setActiveTab] = useState(0);
  const {
    settingsDialogOpen,
    setSettingsDialogOpen,
    themeMode,
    setThemeMode,
    themeColor,
    setThemeColor,
    settings,
    updateSettings,
  } = useAppStore();

  const handleClose = () => {
    setSettingsDialogOpen(false);
  };

  const handleThemeChange = (event) => {
    setThemeMode(event.target.value);
  };

  const handleThemeColorChange = (event) => {
    setThemeColor(event.target.value);
  };

  const handleConversationHistoryChange = (event) => {
    updateSettings({ includeConversationHistory: event.target.checked });
  };

  const handleSystemPromptChange = (event) => {
    updateSettings({ systemPrompt: event.target.value });
  };

  const handleTemperatureChange = (event, newValue) => {
    updateSettings({ temperature: newValue });
  };

  const handleTopPChange = (event, newValue) => {
    updateSettings({ topP: newValue });
  };

  const handleSeedChange = (event) => {
    const value = event.target.value;
    const parsed = value === "" ? null : parseInt(value);
    // Ensure seed is positive (u64 requirement)
    updateSettings({ seed: parsed && parsed >= 0 ? parsed : null });
  };

  const handleMaxTokensChange = (event) => {
    const value = event.target.value;
    const parsed = value === "" ? null : parseInt(value);
    // Ensure positive values
    updateSettings({ maxTokens: parsed && parsed > 0 ? parsed : null });
  };

  const handleMaxCompletionTokensChange = (event) => {
    const value = event.target.value;
    const parsed = value === "" ? null : parseInt(value);
    // Ensure positive values
    updateSettings({
      maxCompletionTokens: parsed && parsed > 0 ? parsed : null,
    });
  };

  return (
    <Dialog
      open={settingsDialogOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
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
            <Typography variant="h6">Settings</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", px: 3, pt: 1 }}
        >
          <Tab
            icon={<ThemeIcon />}
            label="Appearance"
            iconPosition="start"
            sx={{ minHeight: 56 }}
          />
          <Tab
            icon={<ChatIcon />}
            label="Chat"
            iconPosition="start"
            sx={{ minHeight: 56 }}
          />
          <Tab
            icon={<TuneIcon />}
            label="Advanced"
            iconPosition="start"
            sx={{ minHeight: 56 }}
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Appearance Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ThemeIcon />
                Appearance Settings
              </Typography>
              
              <Paper sx={{ p: 3, mb: 3, backgroundColor: "background.default" }}>
                <Typography variant="subtitle1" fontWeight={500} gutterBottom>
                  Theme Mode
                </Typography>
                <RadioGroup
                  value={themeMode}
                  onChange={handleThemeChange}
                  sx={{ mb: 2 }}
                >
                  <FormControlLabel
                    value="light"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LightModeIcon sx={{ fontSize: 18 }} />
                        Light Mode
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="dark"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <DarkModeIcon sx={{ fontSize: 18 }} />
                        Dark Mode
                      </Box>
                    }
                  />
                </RadioGroup>
              </Paper>

              <Paper sx={{ p: 3, backgroundColor: "background.default" }}>
                <Typography variant="subtitle1" fontWeight={500} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PaletteIcon sx={{ fontSize: 18 }} />
                  Theme Color
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose your preferred theme color
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={themeColor}
                    onChange={handleThemeColorChange}
                    displayEmpty
                  >
                    {getAvailableThemeColors().map((color) => (
                      <MenuItem key={color} value={color}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              backgroundColor: color === "orange" ? "#ff8c00" :
                                             color === "blue" ? "#2196f3" :
                                             color === "purple" ? "#9c27b0" :
                                             color === "green" ? "#4caf50" :
                                             color === "red" ? "#f44336" :
                                             color === "teal" ? "#009688" :
                                             color === "indigo" ? "#3f51b5" :
                                             color === "pink" ? "#e91e63" : "#ff8c00",
                              border: "2px solid",
                              borderColor: "divider",
                            }}
                          />
                          <Typography sx={{ textTransform: "capitalize" }}>
                            {color}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Paper>
            </Box>
          )}

          {/* Chat Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ChatIcon />
                Chat Settings
              </Typography>

              <Paper sx={{ p: 3, mb: 3, backgroundColor: "background.default" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.includeConversationHistory || false}
                      onChange={handleConversationHistoryChange}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        Include Conversation History
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Include previous messages in AI responses for better context
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", mb: 0 }}
                />
              </Paper>

              <Paper sx={{ p: 3, backgroundColor: "background.default" }}>
                <Typography variant="subtitle1" fontWeight={500} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TextFieldsIcon sx={{ fontSize: 18 }} />
                  System Prompt
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Define how the AI assistant should behave
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={
                    settings.systemPrompt ??
                    "You're an AI assistant that provides helpful responses."
                  }
                  onChange={handleSystemPromptChange}
                  placeholder="Enter system prompt for the AI assistant..."
                  variant="outlined"
                  size="small"
                />
              </Paper>
            </Box>
          )}

          {/* Advanced Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TuneIcon />
                Advanced Settings
              </Typography>

              <Paper sx={{ p: 3, backgroundColor: "background.default" }}>
                <Typography variant="subtitle1" fontWeight={500} gutterBottom>
                  Model Parameters
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Fine-tune the AI model behavior
                </Typography>

                <Grid container spacing={3}>
                  <Grid size={6}>
                    <Typography variant="body2" gutterBottom>
                      Temperature: {settings.temperature ?? 0.7}
                    </Typography>
                    <Slider
                      value={settings.temperature ?? 0.7}
                      onChange={handleTemperatureChange}
                      min={0}
                      max={2}
                      step={0.1}
                      marks={[
                        { value: 0, label: "0" },
                        { value: 1, label: "1" },
                        { value: 2, label: "2" },
                      ]}
                      valueLabelDisplay="auto"
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Controls randomness (0 = focused, 2 = creative)
                    </Typography>
                  </Grid>

                  <Grid size={6}>
                    <Typography variant="body2" gutterBottom>
                      Top P: {settings.topP ?? 1.0}
                    </Typography>
                    <Slider
                      value={settings.topP ?? 1.0}
                      onChange={handleTopPChange}
                      min={0}
                      max={1}
                      step={0.05}
                      marks={[
                        { value: 0, label: "0" },
                        { value: 0.5, label: "0.5" },
                        { value: 1, label: "1" },
                      ]}
                      valueLabelDisplay="auto"
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Nucleus sampling parameter
                    </Typography>
                  </Grid>

                  <Grid size={12}>
                    <Grid container spacing={2}>
                      <Grid size={4}>
                        <TextField
                          label="Seed"
                          type="number"
                          value={settings.seed ?? ""}
                          onChange={handleSeedChange}
                          placeholder="Random"
                          variant="outlined"
                          size="small"
                          fullWidth
                          inputProps={{ min: 0 }}
                          helperText="For reproducible outputs"
                        />
                      </Grid>
                      <Grid size={4}>
                        <TextField
                          label="Max Tokens"
                          type="number"
                          value={settings.maxTokens ?? ""}
                          onChange={handleMaxTokensChange}
                          placeholder="Auto"
                          variant="outlined"
                          size="small"
                          fullWidth
                          inputProps={{ min: 1 }}
                          helperText="Total token limit"
                        />
                      </Grid>
                      <Grid size={4}>
                        <TextField
                          label="Max Completion Tokens"
                          type="number"
                          value={settings.maxCompletionTokens ?? ""}
                          onChange={handleMaxCompletionTokensChange}
                          placeholder="Auto"
                          variant="outlined"
                          size="small"
                          fullWidth
                          inputProps={{ min: 1 }}
                          helperText="Response token limit"
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
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

export default SettingsDialog;
