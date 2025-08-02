import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import useAppStore from '../store/useAppStore';

export const useDownloadedModels = () => {
  const { settings, setDownloadedModels, setDownloadProgress } = useAppStore();

  // Check for downloaded models on app start and when download location changes
  useEffect(() => {
    const checkDownloadedModels = async () => {
      try {
        // Get the actual download path to use
        let downloadPath = settings.downloadLocation;
        
        // If no custom download location is set, get the default path
        if (!downloadPath) {
          try {
            downloadPath = await invoke('get_default_download_path');
          } catch (error) {
            console.error('Failed to get default download path:', error);
            downloadPath = null; // Fallback to backend default
          }
        }
        
        const downloadedModels = await invoke('check_downloaded_models', {
          downloadPath: downloadPath,
        });
        
        console.log('Found downloaded models in filesystem:', downloadedModels);
        
        // Always sync with filesystem - this is the source of truth
        setDownloadedModels(downloadedModels);
      } catch (error) {
        console.error('Failed to check downloaded models:', error);
        // If check fails, at least preserve the stored state
      }
    };

    // Always check on mount and when settings change
    checkDownloadedModels();
  }, [settings.downloadLocation, setDownloadedModels]);

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