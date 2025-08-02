import React from 'react';
import { Box, Typography } from '@mui/material';
import SearchBar from './SearchBar';
import ModelList from './ModelList';
import ModelDetails from './ModelDetails';

const ModelsPage = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Hugging Face Models
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Search and download models from the Hugging Face Hub
      </Typography>

      <SearchBar />
      <ModelList />
      <ModelDetails />
    </Box>
  );
};

export default ModelsPage;