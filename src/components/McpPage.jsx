import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as ConnectIcon,
  Stop as DisconnectIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import useAppStore from "../store/useAppStore";
import AddMcpServerDialog from "./AddMcpServerDialog";

const McpPage = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const { showNotification } = useAppStore();

  // Load MCP servers on component mount
  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const serverList = await invoke("get_mcp_servers");
      setServers(serverList);
    } catch (err) {
      console.error("Failed to load MCP servers:", err);
      setError(err.toString());
      showNotification("Failed to load MCP servers", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (serverName) => {
    try {
      setActionLoading(prev => ({ ...prev, [serverName]: "connecting" }));
      showNotification(`Starting MCP server: ${serverName}...`, "info");
      
      const result = await invoke("connect_mcp_server", { serverName });
      showNotification(result, "success");
      
      // Refresh the server list first
      await loadServers(); 
      
      // After connecting, try to fetch tools and update the server state
      try {
        const tools = await invoke("fetch_mcp_server_tools", { serverName });
        showNotification(`Fetched ${tools.length} tools from ${serverName}`, "success");
        console.log(`Fetched ${tools.length} tools from ${serverName}:`, tools);
        
        // Update the servers state with the fetched tools
        setServers(prev => prev.map(server => 
          server.name === serverName 
            ? { ...server, tools: tools.map(tool => tool.name || tool) }
            : server
        ));
      } catch (toolErr) {
        console.warn("Failed to fetch tools:", toolErr);
        showNotification("Server started but failed to fetch tools", "warning");
      }
    } catch (err) {
      console.error("Failed to start MCP server:", err);
      showNotification(`Failed to start server: ${err}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [serverName]: null }));
    }
  };

  const handleDisconnect = async (serverName) => {
    try {
      setActionLoading(prev => ({ ...prev, [serverName]: "disconnecting" }));
      const result = await invoke("disconnect_mcp_server", { serverName });
      showNotification(`Stopped MCP server: ${serverName}`, "success");
      await loadServers(); // Refresh the list
    } catch (err) {
      console.error("Failed to stop MCP server:", err);
      showNotification(`Failed to stop server: ${err}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [serverName]: null }));
    }
  };

  const handleRemove = async (serverName) => {
    try {
      setActionLoading(prev => ({ ...prev, [serverName]: "removing" }));
      const result = await invoke("remove_mcp_server", { serverName });
      showNotification(result, "success");
      await loadServers(); // Refresh the list
    } catch (err) {
      console.error("Failed to remove MCP server:", err);
      showNotification(`Failed to remove: ${err}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [serverName]: null }));
    }
  };

  const handleAddServer = async (serverConfig) => {
    try {
      const result = await invoke("add_mcp_server", { request: serverConfig });
      showNotification(result, "success");
      setAddDialogOpen(false);
      await loadServers(); // Refresh the list
    } catch (err) {
      console.error("Failed to add MCP server:", err);
      showNotification(`Failed to add server: ${err}`, "error");
      throw err; // Let the dialog handle the error
    }
  };

  const handleEditServer = async (serverConfig) => {
    try {
      const result = await invoke("edit_mcp_server", { request: serverConfig });
      showNotification(result, "success");
      setEditDialogOpen(false);
      setEditingServer(null);
      await loadServers(); // Refresh the list
    } catch (err) {
      console.error("Failed to edit MCP server:", err);
      showNotification(`Failed to edit server: ${err}`, "error");
      throw err; // Let the dialog handle the error
    }
  };

  const openEditDialog = (server) => {
    if (server.status === "connected") {
      showNotification("Cannot edit a connected server. Please disconnect first.", "warning");
      return;
    }
    setEditingServer(server);
    setEditDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "connected":
        return "success";
      case "error":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading MCP servers...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" fontWeight="bold">
          MCP Servers
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadServers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Server
          </Button>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Description */}
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Model Context Protocol (MCP) servers provide tools and resources that can
        be used by AI models. Configure and manage your MCP server connections here.
      </Typography>

      {/* Servers Table */}
      {servers.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No MCP servers configured
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add your first MCP server to get started with extended AI capabilities.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Your First Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Configuration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Tools</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {servers.map((server) => (
                <TableRow key={server.name}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {server.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {server.config.command ? (
                      // Stdio transport
                      <>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Command:</strong> {server.config.command}
                        </Typography>
                        {server.config.args && server.config.args.length > 0 && (
                          <Typography variant="caption" display="block">
                            Args: {server.config.args.join(" ")}
                          </Typography>
                        )}
                        <Chip label="stdio" size="small" variant="outlined" sx={{ mt: 0.5 }} />
                      </>
                    ) : server.config.url ? (
                      // URL-based transport (SSE or HTTP)
                      <>
                        <Typography variant="body2" color="text.secondary">
                          <strong>URL:</strong> {server.config.url}
                        </Typography>
                        <Chip 
                          label={server.config.url.endsWith('/sse') ? 'SSE' : server.config.url.endsWith('/mcp') ? 'HTTP' : 'URL'}
                          size="small" 
                          variant="outlined" 
                          sx={{ mt: 0.5 }} 
                        />
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Invalid configuration
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusText(server.status)}
                      color={getStatusColor(server.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {server.tools && server.tools.length > 0 ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {server.tools.slice(0, 3).map((tool, index) => (
                          <Chip
                            key={index}
                            label={tool}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {server.tools.length > 3 && (
                          <Chip
                            label={`+${server.tools.length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No tools available
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {server.status === "connected" ? (
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleDisconnect(server.name)}
                          disabled={actionLoading[server.name] === "disconnecting"}
                          title="Stop Server"
                        >
                          {actionLoading[server.name] === "disconnecting" ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DisconnectIcon />
                          )}
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleConnect(server.name)}
                          disabled={actionLoading[server.name] === "connecting"}
                          title="Start Server"
                        >
                          {actionLoading[server.name] === "connecting" ? (
                            <CircularProgress size={16} />
                          ) : (
                            <ConnectIcon />
                          )}
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openEditDialog(server)}
                        disabled={server.status === "connected"}
                        title="Edit Server"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemove(server.name)}
                        disabled={actionLoading[server.name] === "removing"}
                        title="Remove"
                      >
                        {actionLoading[server.name] === "removing" ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Server Dialog */}
      <AddMcpServerDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddServer}
      />

      {/* Edit Server Dialog */}
      <AddMcpServerDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingServer(null);
        }}
        onAdd={handleEditServer}
        editData={editingServer}
      />
    </Box>
  );
};

export default McpPage;