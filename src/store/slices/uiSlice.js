export const createUiSlice = (set, get) => ({
  // UI state
  sidebarCollapsed: false,
  settingsDialogOpen: false,
  currentPage: "chat",
  
  // Notification state
  notification: null,
  
  // UI actions
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
  setCurrentPage: (page) => set({ currentPage: page }),
  
  // Notification actions
  showNotification: (message, type = "info", timeout = null) =>
    set({
      notification: { message, type, timestamp: Date.now(), timeout },
    }),
  clearNotification: () => set({ notification: null }),
});