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
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Terminal as TerminalIcon,
  CloudQueue as CloudIcon,
} from "@mui/icons-material";

const AddMcpServerDialog = ({ open, onClose, onAdd, editData = null }) => {
  const [transportType, setTransportType] = useState("stdio");
  const [formData, setFormData] = useState({
    name: "",
    command: "",
    args: [],
    env: {},
    url: "",
  });
  const [newArg, setNewArg] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Common MCP server templates
  const templates = {
    stdio: [
      {
        name: "Memory Server",
        command: "uvx",
        args: ["@modelcontextprotocol/server-memory"],
        env: {},
      },
      {
        name: "Filesystem Server",
        command: "uvx",
        args: ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"],
        env: {},
      },
      {
        name: "GitHub Server",
        command: "uvx",
        args: ["@modelcontextprotocol/server-github"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>" },
      },
    ],
    url: [
      {
        name: "Example SSE Server",
        url: "http://localhost:3000/sse",
      },
      {
        name: "Example HTTP Server",
        url: "http://localhost:3000/mcp",
      },
    ],
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleTransportTypeChange = (event, newTransportType) => {
    if (newTransportType !== null) {
      setTransportType(newTransportType);
      // Clear fields when switching transport types
      if (newTransportType === "stdio") {
        setFormData(prev => ({ ...prev, url: "" }));
      } else {
        setFormData(prev => ({ ...prev, command: "", args: [], env: {} }));
      }
      setError(null);
    }
  };

  const handleAddArg = () => {
    if (newArg.trim()) {
      // Split arguments by spaces and filter out empty strings
      const argsToAdd = newArg.trim().split(/\s+/).filter(arg => arg.length > 0);
      setFormData(prev => ({
        ...prev,
        args: [...prev.args, ...argsToAdd],
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
    if (transportType === "stdio") {
      setFormData({
        name: template.name,
        command: template.command,
        args: [...template.args],
        env: { ...template.env },
        url: "",
      });
    } else {
      setFormData({
        name: template.name,
        command: "",
        args: [],
        env: {},
        url: template.url,
      });
    }
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
    
    if (transportType === "stdio") {
      if (!formData.command.trim()) {
        setError("Command is required for stdio transport");
        return;
      }
    } else {
      if (!formData.url.trim()) {
        setError("URL is required for URL-based transport");
        return;
      }
      if (!formData.url.includes("://")) {
        setError("URL must include protocol (http:// or https://)");
        return;
      }
    }

    try {
      setLoading(true);
      const serverConfig = {
        name: formData.name.trim(),
      };
      
      if (transportType === "stdio") {
        serverConfig.command = formData.command.trim();
        serverConfig.args = formData.args.length > 0 ? formData.args : null;
        serverConfig.env = Object.keys(formData.env).length > 0 ? formData.env : null;
      } else {
        serverConfig.url = formData.url.trim();
      }
      
      await onAdd(serverConfig);
      handleClose();
    } catch (err) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", command: "", args: [], env: {}, url: "" });
    setTransportType("stdio");
    setNewArg("");
    setNewEnvKey("");
    setNewEnvValue("");
    setError(null);
    setLoading(false);
    onClose();
  };

  // Initialize form data when editing
  React.useEffect(() => {
    if (editData && open) {
      setFormData({
        name: editData.name || "",
        command: editData.config.command || "",
        args: editData.config.args || [],
        env: editData.config.env || {},
        url: editData.config.url || "",
      });
      
      // Determine transport type based on config
      if (editData.config.command) {
        setTransportType("stdio");
      } else {
        setTransportType("url");
      }
    }
  }, [editData, open]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6">{editData ? "Edit MCP Server" : "Add MCP Server"}</Typography>
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

        {/* Transport Type Toggle */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Transport Type
          </Typography>
          <ToggleButtonGroup
            value={transportType}
            exclusive
            onChange={handleTransportTypeChange}
            aria-label="transport type"
          >
            <ToggleButton value="stdio" aria-label="stdio transport">
              <TerminalIcon sx={{ mr: 1 }} />
              Command (stdio)
            </ToggleButton>
            <ToggleButton value="url" aria-label="url transport">
              <CloudIcon sx={{ mr: 1 }} />
              URL (SSE/HTTP)
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Templates */}
        {!editData && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Quick Templates
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {templates[transportType].map((template, index) => (
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
        )}

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

          {/* Transport-specific fields */}
          {transportType === "stdio" ? (
            <>
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
            </>
          ) : (
            <>
              {/* URL */}
              <TextField
                fullWidth
                label="Server URL"
                value={formData.url}
                onChange={(e) => handleInputChange("url", e.target.value)}
                margin="normal"
                required
                helperText="URL ending with /sse for SSE transport or /mcp for HTTP transport"
                placeholder="http://localhost:3000/sse"
              />
            </>
          )}

          {/* Arguments and Environment Variables (only for stdio) */}
          {transportType === "stdio" && (
            <>
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
                    placeholder="Add argument (spaces will split into separate args)"
                    value={newArg}
                    onChange={(e) => setNewArg(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddArg();
                      }
                    }}
                    sx={{ flexGrow: 1 }}
                    helperText="Tip: Enter multiple arguments separated by spaces"
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
            </>
          )}

          {/* Help Text */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {transportType === "stdio" ? (
                <>
                  <strong>Examples:</strong><br />
                  • Memory: uvx @modelcontextprotocol/server-memory<br />
                  • Filesystem: uvx @modelcontextprotocol/server-filesystem /path/to/files<br />
                  • GitHub: uvx @modelcontextprotocol/server-github (requires GITHUB_PERSONAL_ACCESS_TOKEN env var)
                </>
              ) : (
                <>
                  <strong>URL Transport:</strong><br />
                  • SSE: URLs ending with "/sse" use Server-Sent Events<br />
                  • HTTP: URLs ending with "/mcp" use Streamable HTTP<br />
                  • Example: http://localhost:3000/sse or https://api.example.com/mcp
                </>
              )}
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
          disabled={
            loading || 
            !formData.name.trim() || 
            (transportType === "stdio" && !formData.command.trim()) ||
            (transportType === "url" && !formData.url.trim())
          }
        >
          {loading ? (editData ? "Updating..." : "Adding...") : (editData ? "Update Server" : "Add Server")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMcpServerDialog;