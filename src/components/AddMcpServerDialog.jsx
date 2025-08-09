import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

const AddMcpServerDialog = ({ open, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: "",
    command: "",
    args: [],
    env: {},
  });
  const [newArg, setNewArg] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Common MCP server templates
  const templates = [
    {
      name: "Memory Server",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
      env: {},
    },
    {
      name: "Filesystem Server",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"],
      env: {},
    },
    {
      name: "GitHub Server",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>" },
    },
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleAddArg = () => {
    if (newArg.trim()) {
      setFormData(prev => ({
        ...prev,
        args: [...prev.args, newArg.trim()],
      }));
      setNewArg("");
    }
  };

  const handleRemoveArg = (index) => {
    setFormData(prev => ({
      ...prev,
      args: prev.args.filter((_, i) => i !== index),
    }));
  };

  const handleAddEnvVar = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
      setFormData(prev => ({
        ...prev,
        env: { ...prev.env, [newEnvKey.trim()]: newEnvValue.trim() },
      }));
      setNewEnvKey("");
      setNewEnvValue("");
    }
  };

  const handleRemoveEnvVar = (key) => {
    setFormData(prev => {
      const newEnv = { ...prev.env };
      delete newEnv[key];
      return { ...prev, env: newEnv };
    });
  };

  const handleTemplateSelect = (template) => {
    setFormData({
      name: template.name,
      command: template.command,
      args: [...template.args],
      env: { ...template.env },
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Server name is required");
      return;
    }
    if (!formData.command.trim()) {
      setError("Command is required");
      return;
    }

    try {
      setLoading(true);
      await onAdd({
        name: formData.name.trim(),
        command: formData.command.trim(),
        args: formData.args,
        env: Object.keys(formData.env).length > 0 ? formData.env : null,
      });
      handleClose();
    } catch (err) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", command: "", args: [], env: {} });
    setNewArg("");
    setNewEnvKey("");
    setNewEnvValue("");
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6">Add MCP Server</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Templates */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Templates
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {templates.map((template, index) => (
              <Chip
                key={index}
                label={template.name}
                onClick={() => handleTemplateSelect(template)}
                variant="outlined"
                clickable
              />
            ))}
          </Stack>
        </Box>

        <form onSubmit={handleSubmit}>
          {/* Server Name */}
          <TextField
            fullWidth
            label="Server Name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            margin="normal"
            required
            helperText="A unique name to identify this MCP server"
          />

          {/* Command */}
          <TextField
            fullWidth
            label="Command"
            value={formData.command}
            onChange={(e) => handleInputChange("command", e.target.value)}
            margin="normal"
            required
            helperText="The executable command (e.g., npx, python, node)"
          />

          {/* Arguments */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Arguments
            </Typography>
            
            {/* Existing args */}
            {formData.args.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                {formData.args.map((arg, index) => (
                  <Chip
                    key={index}
                    label={arg}
                    onDelete={() => handleRemoveArg(index)}
                    deleteIcon={<DeleteIcon />}
                    size="small"
                  />
                ))}
              </Stack>
            )}

            {/* Add new arg */}
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                placeholder="Add argument"
                value={newArg}
                onChange={(e) => setNewArg(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddArg();
                  }
                }}
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddArg}
                disabled={!newArg.trim()}
              >
                <AddIcon />
              </Button>
            </Box>
          </Box>

          {/* Environment Variables */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Environment Variables (Optional)
            </Typography>
            
            {/* Existing env vars */}
            {Object.entries(formData.env).length > 0 && (
              <Box sx={{ mb: 1 }}>
                {Object.entries(formData.env).map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="body2">
                      <strong>{key}</strong> = {value}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveEnvVar(key)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {/* Add new env var */}
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                placeholder="Key"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                placeholder="Value"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddEnvVar}
                disabled={!newEnvKey.trim() || !newEnvValue.trim()}
              >
                <AddIcon />
              </Button>
            </Box>
          </Box>

          {/* Help Text */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Examples:</strong><br />
              • Memory: npx -y @modelcontextprotocol/server-memory<br />
              • Filesystem: npx -y @modelcontextprotocol/server-filesystem /path/to/files<br />
              • GitHub: npx -y @modelcontextprotocol/server-github (requires GITHUB_PERSONAL_ACCESS_TOKEN env var)
            </Typography>
          </Alert>
        </form>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.name.trim() || !formData.command.trim()}
        >
          {loading ? "Adding..." : "Add Server"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMcpServerDialog;