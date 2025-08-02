import React, { useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import useAppStore from '../store/useAppStore';

const NotificationSnackbar = () => {
  const { notification, clearNotification } = useAppStore();

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    clearNotification();
  };

  useEffect(() => {
    if (notification) {
      // Auto-close after 6 seconds for success/info, 10 seconds for errors
      const timeout = notification.type === 'error' ? 10000 : 6000;
      const timer = setTimeout(() => {
        clearNotification();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  if (!notification) return null;

  return (
    <Snackbar
      open={!!notification}
      autoHideDuration={null}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={handleClose} 
        severity={notification.type} 
        sx={{ 
          width: '100%',
          maxWidth: 400,
          whiteSpace: 'pre-line' // Preserve line breaks
        }}
      >
        {notification.message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSnackbar;