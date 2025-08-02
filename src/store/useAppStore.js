import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      // Search state
      searchQuery: '',
      searchResults: [],
      selectedModel: null,
      isSearching: false,
      downloadingModels: new Set(),
      downloadProgress: {},
      downloadedModels: new Set(),
      
      // Settings state
      settings: {
        downloadLocation: '',
      },
      settingsDialogOpen: false,
      sidebarCollapsed: false,
      
      // Notification state
      notification: null,
      
      // Search actions
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setIsSearching: (isSearching) => set({ isSearching }),
      setModelDownloading: (modelId, isDownloading) => set((state) => {
        const newDownloadingModels = new Set(state.downloadingModels);
        if (isDownloading) {
          newDownloadingModels.add(modelId);
        } else {
          newDownloadingModels.delete(modelId);
        }
        return { downloadingModels: newDownloadingModels };
      }),
      isModelDownloading: (modelId) => get().downloadingModels.has(modelId),
      isModelDownloaded: (modelId) => get().downloadedModels.has(modelId),
      setDownloadProgress: (modelId, progress) => set((state) => ({
        downloadProgress: { ...state.downloadProgress, [modelId]: progress }
      })),
      getDownloadProgress: (modelId) => get().downloadProgress[modelId] || 0,
      addDownloadedModel: (modelId) => set((state) => {
        const newDownloadedModels = new Set(state.downloadedModels);
        newDownloadedModels.add(modelId);
        return { downloadedModels: newDownloadedModels };
      }),
      removeDownloadedModel: (modelId) => set((state) => {
        const newDownloadedModels = new Set(state.downloadedModels);
        newDownloadedModels.delete(modelId);
        return { downloadedModels: newDownloadedModels };
      }),
      setDownloadedModels: (modelIds) => set({ downloadedModels: new Set(modelIds) }),
      
      clearSearch: () => set({ 
        searchQuery: '', 
        searchResults: [], 
        selectedModel: null 
      }),
      
      // Settings actions
      setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      setDownloadLocation: (location) => set((state) => ({
        settings: { ...state.settings, downloadLocation: location }
      })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      // Notification actions
      showNotification: (message, type = 'info') => set({ 
        notification: { message, type, timestamp: Date.now() } 
      }),
      clearNotification: () => set({ notification: null }),
    }),
    {
      name: 'sparrow-app-state',
      partialize: (state) => ({ 
        settings: state.settings,
        downloadedModels: Array.from(state.downloadedModels),
        sidebarCollapsed: state.sidebarCollapsed
      }),
      merge: (persistedState, currentState) => {
        return {
          ...currentState,
          ...persistedState,
          downloadedModels: new Set(persistedState?.downloadedModels || []),
          // Reset transient state
          downloadingModels: new Set(),
          downloadProgress: {},
          notification: null,
          settingsDialogOpen: false,
          selectedModel: null,
          isSearching: false,
        };
      }
    }
  )
);

export default useAppStore;