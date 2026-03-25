import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ChatMessage, ChatSession } from '../types';
import { useApp } from './AppContext';
import { saveToDB, loadFromDB, deleteFromDB } from '../services/db';

interface ChatContextType {
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, newContent: string) => void;
  deleteChatMessage: (id: string) => void;
  rateChatMessage: (id: string, rating: 'up' | 'down' | number | null) => void;
  addFeedbackComment: (id: string, comment: string) => void;
  clearHistory: () => void;
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createNewSession: (title?: string) => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;
  deleteAllSessions: () => void;
  isSuccessfullyLoaded: boolean;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

const makeSession = (title = 'Chat'): ChatSession => ({
  id: 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
  title,
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [chatHistory,    setChatHistory]    = useState<ChatMessage[]>([]);
  const [sessions,       setSessions]       = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoaded,       setIsLoaded]       = useState(false);
  const [isSuccessfullyLoaded, setIsSuccessfullyLoaded] = useState(false);

  const { autoSaveChat, autoSaveChatInterval } = useApp();

  // ── Load from IndexedDB on mount ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // Primary format: individually stored sessions
        const sessionIds = await loadFromDB('indigo_chat_data_session_ids');
        if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
          const loaded: ChatSession[] = [];
          for (const id of sessionIds) {
            const raw = await loadFromDB(`indigo_chat_data_session_${id}`);
            if (raw) loaded.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
          }
          if (loaded.length > 0) {
            const activeId = await loadFromDB('indigo_chat_data_active_session') || loaded[0].id;
            setSessions(loaded);
            setActiveSessionId(activeId);
            const active = loaded.find(s => s.id === activeId);
            if (active?.messages?.length) setChatHistory(active.messages);
            setIsSuccessfullyLoaded(true);
            setIsLoaded(true);
            return;
          }
        }

        // Fallback: chunked stringified
        const numChunks = await loadFromDB('indigo_chat_data_stringified_chunks');
        if (numChunks) {
          let str = '';
          for (let i = 0; i < numChunks; i++) {
            const chunk = await loadFromDB(`indigo_chat_data_stringified_chunk_${i}`);
            if (chunk) str += chunk;
          }
          const data = JSON.parse(str);
          if (data?.sessions?.length) {
            const activeId = data.activeSessionId || data.sessions[0].id;
            setSessions(data.sessions);
            setActiveSessionId(activeId);
            const active = data.sessions.find((s: ChatSession) => s.id === activeId);
            if (active?.messages?.length) setChatHistory(active.messages);
          }
          setIsSuccessfullyLoaded(true);
          setIsLoaded(true);
          return;
        }

        // Fallback: single key
        const single = await loadFromDB('indigo_chat_data_stringified');
        if (single) {
          const data = JSON.parse(single);
          if (data?.sessions?.length) {
            const activeId = data.activeSessionId || data.sessions[0].id;
            setSessions(data.sessions);
            setActiveSessionId(activeId);
            const active = data.sessions.find((s: ChatSession) => s.id === activeId);
            if (active?.messages?.length) setChatHistory(active.messages);
          }
          setIsSuccessfullyLoaded(true);
          setIsLoaded(true);
          return;
        }

        // Legacy single-key format
        const legacy = await loadFromDB('indigo_chat_data');
        if (legacy && (legacy as any)?.sessions?.length) {
          const data = legacy as any;
          const activeId = data.activeSessionId || data.sessions[0].id;
          setSessions(data.sessions);
          setActiveSessionId(activeId);
          const active = data.sessions.find((s: ChatSession) => s.id === activeId);
          if (active?.messages?.length) setChatHistory(active.messages);
        }

      } catch (e) {
        console.error("ChatContext: failed to load:", e);
      } finally {
        setIsSuccessfullyLoaded(true);
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  // ── Save to IndexedDB ────────────────────────────────────────────────
  // Always persist — the autoSaveChat toggle only controls the timed interval,
  // not whether we save at all. Chat must survive a reload regardless.
  const saveData = React.useCallback(async () => {
    if (!isSuccessfullyLoaded) return;
    try {
      await saveToDB('indigo_chat_data_active_session', activeSessionId);
      const sessionIds = sessions.map(s => s.id);
      await saveToDB('indigo_chat_data_session_ids', sessionIds);
      for (const session of sessions) {
        await saveToDB(`indigo_chat_data_session_${session.id}`, JSON.stringify(session));
      }
      // Clean up deleted sessions
      const stored: string[] = await loadFromDB('indigo_chat_data_session_ids') || [];
      for (const id of stored) {
        if (!sessionIds.includes(id)) await deleteFromDB(`indigo_chat_data_session_${id}`);
      }
    } catch (e) {
      // Fallback to single key
      try {
        await saveToDB('indigo_chat_data', JSON.stringify({ sessions, activeSessionId }));
      } catch (e2) {
        console.error("ChatContext: save failed:", e2);
      }
    }
  }, [sessions, activeSessionId, isSuccessfullyLoaded]);

  // Save whenever sessions or activeSessionId change
  useEffect(() => {
    saveData();
  }, [saveData]);

  // Timed backup (only when user has auto-save enabled)
  useEffect(() => {
    if (!isSuccessfullyLoaded || !autoSaveChat || autoSaveChatInterval <= 0) return;
    const id = setInterval(saveData, autoSaveChatInterval * 1000);
    return () => clearInterval(id);
  }, [autoSaveChat, autoSaveChatInterval, saveData, isSuccessfullyLoaded]);

  // ── Ensure a session always exists before adding messages ────────────
  const ensureSession = React.useCallback((): string => {
    if (activeSessionId) return activeSessionId;
    // No session yet — create a default one
    const session = makeSession('Chat');
    setSessions([session]);
    setActiveSessionId(session.id);
    return session.id;
  }, [activeSessionId]);

  // ── Message operations ───────────────────────────────────────────────
  const addChatMessage = React.useCallback((message: ChatMessage) => {
    const sessionId = ensureSession();
    setChatHistory(prev => [...prev, message]);
    setSessions(prev => {
      const exists = prev.find(s => s.id === sessionId);
      if (exists) {
        return prev.map(s => s.id === sessionId
          ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
          : s
        );
      }
      // Session was just created via ensureSession but state hasn't updated yet
      return [{
        id: sessionId,
        title: 'Chat',
        messages: [message],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }];
    });
  }, [ensureSession]);

  const updateChatMessage = React.useCallback((id: string, newContent: string) => {
    setChatHistory(prev => prev.map(m => m.id === id ? { ...m, content: newContent } : m));
    setSessions(prev => prev.map(s => s.id === activeSessionId
      ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, content: newContent } : m), updatedAt: Date.now() }
      : s
    ));
  }, [activeSessionId]);

  const deleteChatMessage = React.useCallback((id: string) => {
    setChatHistory(prev => prev.filter(m => m.id !== id));
    setSessions(prev => prev.map(s => s.id === activeSessionId
      ? { ...s, messages: s.messages.filter(m => m.id !== id), updatedAt: Date.now() }
      : s
    ));
  }, [activeSessionId]);

  const rateChatMessage = React.useCallback((id: string, rating: 'up' | 'down' | number | null) => {
    setChatHistory(prev => prev.map(m => m.id === id ? { ...m, rating } : m));
    setSessions(prev => prev.map(s => s.id === activeSessionId
      ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, rating } : m) }
      : s
    ));
  }, [activeSessionId]);

  const addFeedbackComment = React.useCallback((id: string, comment: string) => {
    setChatHistory(prev => prev.map(m => m.id === id ? { ...m, feedbackComment: comment } : m));
    setSessions(prev => prev.map(s => s.id === activeSessionId
      ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, feedbackComment: comment } : m) }
      : s
    ));
  }, [activeSessionId]);

  const clearHistory = React.useCallback(() => {
    setChatHistory([]);
    setSessions(prev => prev.map(s => s.id === activeSessionId
      ? { ...s, messages: [], updatedAt: Date.now() }
      : s
    ));
  }, [activeSessionId]);

  // ── Session management ───────────────────────────────────────────────
  const createNewSession = (title = 'New Chat') => {
    const session = makeSession(title);
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(session.id);
    setChatHistory([]);
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setChatHistory(session.messages);
    }
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        const fallback = next[0];
        if (fallback) {
          setActiveSessionId(fallback.id);
          setChatHistory(fallback.messages);
        } else {
          setActiveSessionId(null);
          setChatHistory([]);
        }
      }
      return next;
    });
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
  };

  const deleteAllSessions = () => {
    setSessions([]);
    setActiveSessionId(null);
    setChatHistory([]);
  };

  return (
    <ChatContext.Provider value={{
      chatHistory, setChatHistory,
      addChatMessage, updateChatMessage, deleteChatMessage, rateChatMessage, addFeedbackComment, clearHistory,
      sessions, setSessions, activeSessionId, setActiveSessionId,
      createNewSession, switchSession, deleteSession, renameSession, deleteAllSessions,
      isSuccessfullyLoaded,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
