import { create } from "zustand";
import { persist } from "zustand/middleware";

const useChatStore = create(
  persist(
    (set, get) => ({
      // Chat sessions state
      chatSessions: {},
      activeChatSessionId: null,
      currentChatMessages: [],

      // Chat session actions
      setChatSessions: (sessions) => set({ chatSessions: sessions }),
      setActiveChatSessionId: (sessionId) =>
        set({ activeChatSessionId: sessionId }),
      setCurrentChatMessages: (messages) =>
        set({ currentChatMessages: Array.isArray(messages) ? messages : [] }),
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
        };
      },
    }
  )
);

export default useChatStore;
