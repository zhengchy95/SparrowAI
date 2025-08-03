import React, { useState } from 'react';
import {
  Paper,
  InputBase,
  IconButton,
  Box,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import useAppStore from '../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';

const SearchBar = () => {
  const { searchQuery, isSearching, setSearchQuery, setSearchResults, setIsSearching } = useAppStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSearch = async () => {
    if (!localQuery.trim()) return;
    
    setIsSearching(true);
    setSearchQuery(localQuery);
    
    try {
      const result = await invoke('search_models', { query: localQuery, limit: 10 });
      setSearchResults(result.models.map(model => model.id));
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper
        component="form"
        sx={{
          p: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          maxWidth: 600,
          mx: 'auto',
          borderRadius: '24px',
          transition: 'all 0.2s ease',
          '&:focus-within': {
            borderColor: 'primary.main',
            boxShadow: '0 0 0 2px rgba(255, 140, 0, 0.1)',
          },
        }}
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <InputBase
          sx={{ 
            ml: 1, 
            flex: 1,
            fontSize: '16px',
          }}
          placeholder="Search Hugging Face models..."
          inputProps={{ 'aria-label': 'search hugging face models' }}
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSearching}
        />
        <IconButton 
          type="button" 
          sx={{ 
            p: '8px',
            color: localQuery.trim() ? 'primary.main' : 'text.disabled',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }} 
          aria-label="search"
          onClick={handleSearch}
          disabled={isSearching || !localQuery.trim()}
        >
          {isSearching ? <CircularProgress size={20} color="primary" /> : <SearchIcon />}
        </IconButton>
      </Paper>
    </Box>
  );
};

export default SearchBar;