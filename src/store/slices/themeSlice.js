export const createThemeSlice = (set, get) => ({
  // Theme state
  themeMode: "dark",
  themeColor: "orange",
  
  // Theme actions
  setThemeMode: (mode) => set({ themeMode: mode }),
  setThemeColor: (color) => set({ themeColor: color }),
  toggleThemeMode: () => set((state) => ({ 
    themeMode: state.themeMode === "dark" ? "light" : "dark" 
  })),
});