import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import {
  UploadFile as UploadFileIcon,
  Delete as DeleteIcon,
  Description as DocumentIcon,
  CloudUpload as CloudUploadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  InsertDriveFile as FileIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { useUI } from "../../store";

const DocumentsPage = () => {
  const { showNotification } = useUI();
  const [files, setFiles] = useState([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);
  const [fileChunks, setFileChunks] = useState({});

  useEffect(() => {
    const safeLoadDocuments = async () => {
      try {
        await loadDocuments();
      } catch (err) {
        console.error("Critical error loading documents:", err);
        setError("Failed to initialize Documents page. Please try refreshing the app.");
        setLoading(false);
      }
    };
    
    safeLoadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      
      // Load files with fallback
      let fileList = [];
      try {
        const result = await invoke("get_all_files");
        fileList = Array.isArray(result) ? result : [];
        console.log("Loaded files:", fileList);
      } catch (docError) {
        console.error("Failed to load files list:", docError);
        fileList = [];
      }
      
      // Load document count with fallback
      let count = 0;
      try {
        count = await invoke("get_document_count");
        count = typeof count === 'number' ? count : 0;
      } catch (countError) {
        console.error("Failed to load document count:", countError);
        count = fileList.reduce((acc, file) => acc + (file.chunk_count || 0), 0); // Fallback to sum of chunks
      }
      
      setFiles(fileList);
      setDocumentCount(count);
      
    } catch (error) {
      console.error("Failed to load documents:", error);
      showNotification("Failed to load documents", "error");
      // Set safe fallback values
      setFiles([]);
      setDocumentCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const supportedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!supportedTypes.includes(file.type)) {
      showNotification("Unsupported file type. Please upload PDF, DOCX, or XLSX files.", "error");
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      showNotification("File size must be less than 50MB", "error");
      return;
    }

    try {
      setUploadingDocument(true);
      
      // Save file to temp location
      const filePath = await invoke("save_temp_file", { 
        fileName: file.name,
        fileData: Array.from(new Uint8Array(await file.arrayBuffer()))
      });
      
      // Process document
      const documents = await invoke("process_document", { filePath });
      
      if (!documents || documents.length === 0) {
        showNotification("No content could be extracted from the document", "warning");
        return;
      }
      
      // Create embeddings
      const documentsWithEmbeddings = await invoke("create_document_embeddings", { documents });
      
      // Store in vector database
      await invoke("store_documents", { documents: documentsWithEmbeddings });
      
      showNotification(`Document processed: ${documents.length} chunks created`, "success");
      
      // Reload documents
      await loadDocuments();
      
      // Reset file input
      event.target.value = '';
      
    } catch (error) {
      console.error("Document processing error:", error);
      showNotification(`Document processing failed: ${error}`, "error");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteFile = async (filePath) => {
    if (!filePath) {
      showNotification("Invalid file path", "error");
      return;
    }

    try {
      const deletedCount = await invoke("delete_file_by_path", { filePath: filePath });
      if (deletedCount > 0) {
        await loadDocuments();
        showNotification(`File deleted successfully (${deletedCount} chunks removed)`, "success");
      } else {
        showNotification("File not found or already deleted", "warning");
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      showNotification(`Failed to delete file: ${error}`, "error");
      // Refresh documents list to ensure UI is in sync
      await loadDocuments();
    }
  };

  const handleClearAllDocuments = async () => {
    try {
      await invoke("clear_all_documents");
      await loadDocuments();
      showNotification("All documents cleared successfully", "success");
      setShowDeleteAllDialog(false);
    } catch (error) {
      console.error("Failed to clear documents:", error);
      showNotification(`Failed to clear documents: ${error}`, "error");
      setShowDeleteAllDialog(false);
      // Still try to refresh the documents list
      await loadDocuments();
    }
  };

  const loadFileChunks = async (filePath) => {
    try {
      const chunks = await invoke("get_file_chunks", { filePath: filePath });
      setFileChunks(prev => ({ ...prev, [filePath]: chunks }));
    } catch (error) {
      console.error("Failed to load file chunks:", error);
      showNotification("Failed to load file chunks", "error");
    }
  };

  const handleFileExpand = async (filePath) => {
    if (expandedFile === filePath) {
      // Collapse
      setExpandedFile(null);
    } else {
      // Expand
      setExpandedFile(filePath);
      if (!fileChunks[filePath]) {
        await loadFileChunks(filePath);
      }
    }
  };

  // Show error state
  if (error) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => {
            setError(null);
            loadDocuments();
          }}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Document Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload and manage documents for RAG (Retrieval-Augmented Generation)
        </Typography>
      </Box>

      {/* Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUploadIcon />
            Upload Documents
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Supported formats: PDF, DOCX, XLSX, XLS (Max 50MB per file)
          </Typography>
          
          <input
            type="file"
            accept=".pdf,.docx,.xlsx,.xls"
            onChange={handleDocumentUpload}
            style={{ display: 'none' }}
            id="document-upload"
            multiple={false}
          />
          <label htmlFor="document-upload">
            <Button
              variant="contained"
              component="span"
              disabled={uploadingDocument}
              startIcon={uploadingDocument ? <CircularProgress size={20} /> : <UploadFileIcon />}
              size="large"
            >
              {uploadingDocument ? "Processing..." : "Upload Document"}
            </Button>
          </label>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DocumentIcon />
              Documents ({files.length})
            </Typography>
            {files.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => setShowDeleteAllDialog(true)}
              >
                Clear All
              </Button>
            )}
          </Box>
        </CardContent>

        <CardContent sx={{ flexGrow: 1, pt: 0 }}>
          {files.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'background.default' }}>
              <DocumentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No documents uploaded
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload documents to enable RAG functionality in your chats
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {files.map((file, index) => {
                // Safe property access with fallbacks
                const safeFile = {
                  file_path: file?.file_path || `file-${index}`,
                  file_name: file?.file_name || 'Untitled Document',
                  file_type: file?.file_type || 'unknown',
                  chunk_count: file?.chunk_count || 0,
                  created_at: file?.created_at,
                };

                const isExpanded = expandedFile === safeFile.file_path;
                const chunks = fileChunks[safeFile.file_path] || [];

                return (
                  <Card
                    key={safeFile.file_path}
                    sx={{
                      mb: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                             onClick={() => handleFileExpand(safeFile.file_path)}>
                          <FileIcon sx={{ mr: 2, color: 'primary.main' }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {safeFile.file_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {safeFile.file_type.toUpperCase()} • {safeFile.chunk_count} chunks • {' '}
                              {safeFile.created_at ? new Date(safeFile.created_at).toLocaleDateString() : 'Unknown date'}
                            </Typography>
                          </Box>
                          <IconButton size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDeleteFile(safeFile.file_path)}
                          color="error"
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      
                      {/* Expandable chunks view */}
                      {isExpanded && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Document Chunks ({safeFile.chunk_count})
                          </Typography>
                          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                            {chunks.map((doc, chunkIndex) => (
                              <ListItem
                                key={doc?.id || chunkIndex}
                                sx={{ 
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  mb: 1,
                                  backgroundColor: 'background.paper'
                                }}
                              >
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={500}>
                                    Chunk {(doc?.chunk_index !== null && doc?.chunk_index !== undefined) ? doc.chunk_index + 1 : chunkIndex + 1}
                                  </Typography>
                                  <Typography variant="body2" sx={{ 
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}>
                                    {doc?.content?.substring(0, 300) || 'No content available'}...
                                  </Typography>
                                </Box>
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete All Confirmation Dialog */}
      <Dialog
        open={showDeleteAllDialog}
        onClose={() => setShowDeleteAllDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Clear All Documents</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. All {files.length} documents will be permanently removed.
          </Alert>
          <Typography>
            Are you sure you want to clear all documents? This will remove all uploaded files and their processed chunks from the system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteAllDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleClearAllDocuments}
            color="error"
            variant="contained"
          >
            Clear All Documents
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentsPage;