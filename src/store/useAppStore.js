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
        includeConversationHistory: true, // Default to true
        systemPrompt: "You're an AI assistant that provides helpful responses.",
        temperature: 0.7,
        topP: 1.0,
        seed: null,
        maxTokens: null,
        maxCompletionTokens: null,
      },
      settingsDialogOpen: false,
      sidebarCollapsed: false,
      themeMode: 'dark', // 'light' or 'dark'
      
      // Chat sessions state
      chatSessions: {},
      activeChatSessionId: null,
      currentChatMessages: [],
      
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
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      
      // Chat session actions
      setChatSessions: (sessions) => set({ chatSessions: sessions }),
      setActiveChatSessionId: (sessionId) => set({ activeChatSessionId: sessionId }),
      setCurrentChatMessages: (messages) => set({ currentChatMessages: Array.isArray(messages) ? messages : [] }),
      addChatSession: (session) => set((state) => ({
        chatSessions: { ...state.chatSessions, [session.id]: session }
      })),
      updateChatSession: (sessionId, updates) => set((state) => ({
        chatSessions: {
          ...state.chatSessions,
          [sessionId]: { ...state.chatSessions[sessionId], ...updates }
        }
      })),
      removeChatSession: (sessionId) => set((state) => {
        const newSessions = { ...state.chatSessions };
        delete newSessions[sessionId];
        return {
          chatSessions: newSessions,
          activeChatSessionId: state.activeChatSessionId === sessionId ? null : state.activeChatSessionId
        };
      }),
      addMessageToCurrentChat: (message) => set((state) => ({
        currentChatMessages: [...(state.currentChatMessages || []), message]
      })),
      clearCurrentChatMessages: () => set({ currentChatMessages: [] }),
      
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
        sidebarCollapsed: state.sidebarCollapsed,
        themeMode: state.themeMode
      }),
      merge: (persistedState, currentState) => {
        return {
          ...currentState,
          ...persistedState,
          downloadedModels: new Set(persistedState?.downloadedModels || []),
          // Merge settings with defaults
          settings: {
            ...currentState.settings,
            ...persistedState?.settings,
          },
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