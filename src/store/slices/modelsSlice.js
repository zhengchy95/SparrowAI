export const createModelsSlice = (set, get) => ({
  // Search state
  searchQuery: "",
  searchResults: [],
  selectedModel: null,
  isSearching: false,
  
  // Download state
  downloadingModels: new Set(),
  downloadProgress: {},
  downloadedModels: new Set(),
  
  // OVMS state
  isOvmsRunning: false,
  loadedModel: null,
  
  // Search actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setIsSearching: (isSearching) => set({ isSearching }),
  
  clearSearch: () => set({
    searchQuery: "",
    searchResults: [],
    selectedModel: null,
  }),
  
  // Download actions
  setModelDownloading: (modelId, isDownloading) =>
    set((state) => {
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
  
  setDownloadProgress: (modelId, progress) =>
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [modelId]: progress },
    })),
    
  getDownloadProgress: (modelId) => get().downloadProgress[modelId] || 0,
  
  addDownloadedModel: (modelId) =>
    set((state) => {
      const newDownloadedModels = new Set(state.downloadedModels);
      newDownloadedModels.add(modelId);
      return { downloadedModels: newDownloadedModels };
    }),
    
  removeDownloadedModel: (modelId) =>
    set((state) => {
      const newDownloadedModels = new Set(state.downloadedModels);
      newDownloadedModels.delete(modelId);
      return { downloadedModels: newDownloadedModels };
    }),
    
  setDownloadedModels: (modelIds) =>
    set({ downloadedModels: new Set(modelIds) }),
  
  // OVMS actions
  setIsOvmsRunning: (isRunning) => set({ isOvmsRunning: isRunning }),
  setLoadedModel: (modelId) => set({ loadedModel: modelId }),
});