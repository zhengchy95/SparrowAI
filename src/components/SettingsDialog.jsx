import React from 'react';
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
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  History as HistoryIcon,
  Tune as TuneIcon,
  TextFields as TextFieldsIcon,
} from '@mui/icons-material';
import useAppStore from '../store/useAppStore';

const SettingsDialog = () => {
  const { 
    settingsDialogOpen, 
    setSettingsDialogOpen,
    themeMode,
    setThemeMode,
    settings,
    updateSettings
  } = useAppStore();

  const handleClose = () => {
    setSettingsDialogOpen(false);
  };

  const handleThemeChange = (event) => {
    setThemeMode(event.target.value);
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
    const parsed = value === '' ? null : parseInt(value);
    // Ensure seed is positive (u64 requirement)
    updateSettings({ seed: parsed && parsed >= 0 ? parsed : null });
  };

  const handleMaxTokensChange = (event) => {
    const value = event.target.value;
    const parsed = value === '' ? null : parseInt(value);
    // Ensure positive values
    updateSettings({ maxTokens: parsed && parsed > 0 ? parsed : null });
  };

  const handleMaxCompletionTokensChange = (event) => {
    const value = event.target.value;
    const parsed = value === '' ? null : parseInt(value);
    // Ensure positive values
    updateSettings({ maxCompletionTokens: parsed && parsed > 0 ? parsed : null });
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
            Appearance
          </Typography>
          
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ mb: 2, fontWeight: 500 }}>
              Theme Mode
            </FormLabel>
            <RadioGroup
              value={themeMode}
              onChange={handleThemeChange}
              sx={{ ml: 1 }}
            >
              <FormControlLabel 
                value="light" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LightModeIcon sx={{ fontSize: 20 }} />
                    Light
                  </Box>
                }
              />
              <FormControlLabel 
                value="dark" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DarkModeIcon sx={{ fontSize: 20 }} />
                    Dark
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Chat Settings
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.includeConversationHistory || false}
                onChange={handleConversationHistoryChange}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 20 }} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Include Conversation History
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Include previous messages in AI responses for better context
                  </Typography>
                </Box>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 2 }}
          />

          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextFieldsIcon sx={{ fontSize: 20 }} />
              System Prompt
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={settings.systemPrompt ?? "You're an AI assistant that provides helpful responses."}
              onChange={handleSystemPromptChange}
              placeholder="Enter system prompt for the AI assistant..."
              variant="outlined"
              size="small"
              sx={{ mb: 2 }}
            />
          </Box>

          <Typography variant="body2" fontWeight={500} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneIcon sx={{ fontSize: 20 }} />
            Model Parameters
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
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
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' }
                ]}
                valueLabelDisplay="auto"
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                Controls randomness (0 = focused, 2 = creative)
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
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
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' }
                ]}
                valueLabelDisplay="auto"
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                Nucleus sampling parameter
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <TextField
                    label="Seed"
                    type="number"
                    value={settings.seed ?? ''}
                    onChange={handleSeedChange}
                    placeholder="Random"
                    variant="outlined"
                    size="small"
                    fullWidth
                    inputProps={{ min: 0 }}
                    helperText="For reproducible outputs"
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Max Tokens"
                    type="number"
                    value={settings.maxTokens ?? ''}
                    onChange={handleMaxTokensChange}
                    placeholder="Auto"
                    variant="outlined"
                    size="small"
                    fullWidth
                    inputProps={{ min: 1 }}
                    helperText="Total token limit"
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Max Completion Tokens"
                    type="number"
                    value={settings.maxCompletionTokens ?? ''}
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

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Application Settings
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Additional settings coming soon.
          </Typography>
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