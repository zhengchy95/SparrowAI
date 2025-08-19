export const createChatSlice = (set, get) => ({
  // Chat sessions state
  chatSessions: {},
  activeChatSessionId: null,
  currentChatMessages: [],
  temporarySession: null,
  
  // Chat session actions
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setActiveChatSessionId: (sessionId) => set({ activeChatSessionId: sessionId }),
  setCurrentChatMessages: (messages) =>
    set({ currentChatMessages: Array.isArray(messages) ? messages : [] }),
  setTemporarySession: (session) => set({ temporarySession: session }),
  
  addChatSession: (session) =>
    set((state) => ({
      chatSessions: { ...state.chatSessions, [session.id]: session },
    })),
    
  updateChatSession: (sessionId, updates) =>
    set((state) => ({
      chatSessions: {
        ...state.chatSessions,
        [sessionId]: { ...state.chatSessions[sessionId], ...updates },
      },
    })),
    
  removeChatSession: (sessionId) =>
    set((state) => {
      const newSessions = { ...state.chatSessions };
      delete newSessions[sessionId];
      return {
        chatSessions: newSessions,
        activeChatSessionId:
          state.activeChatSessionId === sessionId
            ? null
            : state.activeChatSessionId,
      };
    }),
    
  addMessageToCurrentChat: (message) =>
    set((state) => ({
      currentChatMessages: [...(state.currentChatMessages || []), message],
    })),
    
  clearCurrentChatMessages: () => set({ currentChatMessages: [] }),
  clearTemporarySession: () => set({ temporarySession: null }),
  
  // Helper selectors
  getActiveSession: () => {
    const state = get();
    return state.temporarySession || state.chatSessions[state.activeChatSessionId];
  },
  
  getChatSessionsArray: () => {
    const state = get();
    return Object.values(state.chatSessions);
  },
  
  getRecentChatSessions: (limit = 10) => {
    const state = get();
    return Object.values(state.chatSessions)
      .filter((session) => session.messages && session.messages.length > 0)
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, limit);
  },
});