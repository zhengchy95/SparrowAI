import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useModels } from '../store';

export const useDownloadedModels = () => {
  const { setDownloadedModels, setDownloadProgress } = useModels();

  // Check for downloaded models on app start
  useEffect(() => {
    const checkDownloadedModels = async () => {
      try {
        // Always use default path (no custom download location)
        const downloadedModels = await invoke('check_downloaded_models', {
          downloadPath: null, // Use default path
        });
        
        console.log('Found downloaded models in filesystem:', downloadedModels);
        
        // Always sync with filesystem - this is the source of truth
        setDownloadedModels(downloadedModels);
      } catch (error) {
        console.error('Failed to check downloaded models:', error);
        // If check fails, at least preserve the stored state
      }
    };

    // Check on mount
    checkDownloadedModels();
  }, [setDownloadedModels]);

  // Listen for download progress events
  useEffect(() => {
    const unlisten = listen('download-progress', (event) => {
      const { modelId, progress, currentFile, fileIndex, totalFiles } = event.payload;
      
      setDownloadProgress(modelId, {
        progress,
        currentFile,
        fileIndex,
        totalFiles,
      });
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [setDownloadProgress]);
};

export default useDownloadedModels;