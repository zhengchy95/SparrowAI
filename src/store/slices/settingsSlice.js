const defaultSettings = {
  includeConversationHistory: true,
  systemPrompt: "You're an AI assistant that provides helpful responses.",
  temperature: 0.7,
  topP: 1.0,
  seed: null,
  maxTokens: null,
  maxCompletionTokens: null,
  useRAG: false,
};

export const createSettingsSlice = (set, get) => ({
  // Settings state
  settings: defaultSettings,
  
  // Settings actions
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
    
  resetSettings: () => set({ settings: defaultSettings }),
  
  updateSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),
});