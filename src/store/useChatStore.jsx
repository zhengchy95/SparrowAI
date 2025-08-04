import { create } from "zustand";
import { persist } from "zustand/middleware";

const useChatStore = create(
  persist(
    (set, get) => ({
      // Chat sessions state
      chatSessions: {},
      activeChatSessionId: null,
      currentChatMessages: [],
      temporarySession: null, // For sessions not yet persisted

      // Chat session actions
      setChatSessions: (sessions) => set({ chatSessions: sessions }),
      setActiveChatSessionId: (sessionId) =>
        set({ activeChatSessionId: sessionId }),
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

export default useChatStore;
