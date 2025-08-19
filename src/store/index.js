import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { createThemeSlice } from "./slices/themeSlice";
import { createUiSlice } from "./slices/uiSlice";
import { createModelsSlice } from "./slices/modelsSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createChatSlice } from "./slices/chatSlice";

// Main store combining all slices
export const useAppStore = create(
  persist(
    (set, get) => ({
      ...createThemeSlice(set, get),
      ...createUiSlice(set, get),
      ...createModelsSlice(set, get),
      ...createSettingsSlice(set, get),
    }),
    {
      name: "sparrow-app-state",
      partialize: (state) => ({
        // Persist theme settings
        themeMode: state.themeMode,
        themeColor: state.themeColor,
        
        // Persist UI settings
        sidebarCollapsed: state.sidebarCollapsed,
        
        // Persist settings
        settings: state.settings,
        
        // Persist downloaded models
        downloadedModels: Array.from(state.downloadedModels),
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
          isOvmsRunning: false,
          loadedModel: null,
        };
      },
    }
  )
);

// Separate chat store for session management
export const useChatStore = create(
  persist(
    (set, get) => ({
      ...createChatSlice(set, get),
    }),
    {
      name: "sparrow-chat-state",
      partialize: (state) => ({
        // Don't persist any chat state - always start fresh
      }),
      merge: (persistedState, currentState) => {
        return {
          ...currentState,
          // Always reset chat session state on app restart
          chatSessions: {},
          activeChatSessionId: null,
          currentChatMessages: [],
          temporarySession: null,
        };
      },
    }
  )
);

// Store selectors for easier access - using individual selectors to prevent infinite loops
export const useTheme = () => {
  const themeMode = useAppStore((state) => state.themeMode);
  const themeColor = useAppStore((state) => state.themeColor);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const setThemeColor = useAppStore((state) => state.setThemeColor);
  const toggleThemeMode = useAppStore((state) => state.toggleThemeMode);
  
  return { themeMode, themeColor, setThemeMode, setThemeColor, toggleThemeMode };
};

export const useUI = () => {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const settingsDialogOpen = useAppStore((state) => state.settingsDialogOpen);
  const currentPage = useAppStore((state) => state.currentPage);
  const notification = useAppStore((state) => state.notification);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setSettingsDialogOpen = useAppStore((state) => state.setSettingsDialogOpen);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const showNotification = useAppStore((state) => state.showNotification);
  const clearNotification = useAppStore((state) => state.clearNotification);
  
  return {
    sidebarCollapsed,
    settingsDialogOpen,
    currentPage,
    notification,
    setSidebarCollapsed,
    toggleSidebar,
    setSettingsDialogOpen,
    setCurrentPage,
    showNotification,
    clearNotification,
  };
};

export const useModels = () => {
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchResults = useAppStore((state) => state.searchResults);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const isSearching = useAppStore((state) => state.isSearching);
  const downloadingModels = useAppStore((state) => state.downloadingModels);
  const downloadProgress = useAppStore((state) => state.downloadProgress);
  const downloadedModels = useAppStore((state) => state.downloadedModels);
  const isOvmsRunning = useAppStore((state) => state.isOvmsRunning);
  const loadedModel = useAppStore((state) => state.loadedModel);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setSearchResults = useAppStore((state) => state.setSearchResults);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const setIsSearching = useAppStore((state) => state.setIsSearching);
  const clearSearch = useAppStore((state) => state.clearSearch);
  const setModelDownloading = useAppStore((state) => state.setModelDownloading);
  const isModelDownloading = useAppStore((state) => state.isModelDownloading);
  const isModelDownloaded = useAppStore((state) => state.isModelDownloaded);
  const setDownloadProgress = useAppStore((state) => state.setDownloadProgress);
  const getDownloadProgress = useAppStore((state) => state.getDownloadProgress);
  const addDownloadedModel = useAppStore((state) => state.addDownloadedModel);
  const removeDownloadedModel = useAppStore((state) => state.removeDownloadedModel);
  const setDownloadedModels = useAppStore((state) => state.setDownloadedModels);
  const setIsOvmsRunning = useAppStore((state) => state.setIsOvmsRunning);
  const setLoadedModel = useAppStore((state) => state.setLoadedModel);
  
  return {
    searchQuery,
    searchResults,
    selectedModel,
    isSearching,
    downloadingModels,
    downloadProgress,
    downloadedModels,
    isOvmsRunning,
    loadedModel,
    setSearchQuery,
    setSearchResults,
    setSelectedModel,
    setIsSearching,
    clearSearch,
    setModelDownloading,
    isModelDownloading,
    isModelDownloaded,
    setDownloadProgress,
    getDownloadProgress,
    addDownloadedModel,
    removeDownloadedModel,
    setDownloadedModels,
    setIsOvmsRunning,
    setLoadedModel,
  };
};

export const useSettings = () => {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const resetSettings = useAppStore((state) => state.resetSettings);
  const updateSetting = useAppStore((state) => state.updateSetting);
  
  return { settings, updateSettings, resetSettings, updateSetting };
};

export const useChat = () => {
  const chatSessions = useChatStore((state) => state.chatSessions);
  const activeChatSessionId = useChatStore((state) => state.activeChatSessionId);
  const currentChatMessages = useChatStore((state) => state.currentChatMessages);
  const temporarySession = useChatStore((state) => state.temporarySession);
  const setChatSessions = useChatStore((state) => state.setChatSessions);
  const setActiveChatSessionId = useChatStore((state) => state.setActiveChatSessionId);
  const setCurrentChatMessages = useChatStore((state) => state.setCurrentChatMessages);
  const setTemporarySession = useChatStore((state) => state.setTemporarySession);
  const addChatSession = useChatStore((state) => state.addChatSession);
  const updateChatSession = useChatStore((state) => state.updateChatSession);
  const removeChatSession = useChatStore((state) => state.removeChatSession);
  const addMessageToCurrentChat = useChatStore((state) => state.addMessageToCurrentChat);
  const clearCurrentChatMessages = useChatStore((state) => state.clearCurrentChatMessages);
  const clearTemporarySession = useChatStore((state) => state.clearTemporarySession);
  const getActiveSession = useChatStore((state) => state.getActiveSession);
  const getChatSessionsArray = useChatStore((state) => state.getChatSessionsArray);
  const getRecentChatSessions = useChatStore((state) => state.getRecentChatSessions);
  
  return {
    chatSessions,
    activeChatSessionId,
    currentChatMessages,
    temporarySession,
    setChatSessions,
    setActiveChatSessionId,
    setCurrentChatMessages,
    setTemporarySession,
    addChatSession,
    updateChatSession,
    removeChatSession,
    addMessageToCurrentChat,
    clearCurrentChatMessages,
    clearTemporarySession,
    getActiveSession,
    getChatSessionsArray,
    getRecentChatSessions,
  };
};

// Legacy exports for backward compatibility
export default useAppStore;