import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { sendMessageSSE, loadHistory, saveMessage, clearHistory, deleteMessage, togglePin } from '../api/chat';
import { CHAT_MAX_MESSAGES } from '../utils/constants';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamError: string | null;
}

type ChatAction =
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'APPEND_STREAM_CHUNK'; payload: string }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'TOGGLE_PIN'; payload: string }
  | { type: 'CLEAR_CONVERSATION' };

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  streamError: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE': {
      const msgs = [...state.messages, action.payload];
      return { ...state, messages: msgs.length > CHAT_MAX_MESSAGES ? msgs.slice(-CHAT_MAX_MESSAGES) : msgs };
    }
    case 'APPEND_STREAM_CHUNK': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.payload };
      }
      return { ...state, messages: msgs };
    }
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'SET_ERROR':
      return { ...state, streamError: action.payload };
    case 'DELETE_MESSAGE':
      return { ...state, messages: state.messages.filter(m => m.id !== action.payload) };
    case 'TOGGLE_PIN':
      return { ...state, messages: state.messages.map(m => m.id === action.payload ? { ...m, pinned: !m.pinned } : m) };
    case 'CLEAR_CONVERSATION':
      return { ...initialState };
    default:
      return state;
  }
}

interface ChatContextValue {
  state: ChatState;
  send: (message: string) => Promise<void>;
  clear: () => void;
  remove: (id: string) => void;
  pin: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history on mount
  useEffect(() => {
    loadHistory()
      .then((msgs) => {
        if (msgs.length > 0) {
          const mapped: ChatMessage[] = msgs.map((m: { role: string; content: string; timestamp?: string; pinned?: boolean; id?: string }, i: number) => ({
            id: m.id || `hist-${i}`,
            role: m.role as ChatMessage['role'],
            content: m.content,
            timestamp: new Date(m.timestamp || Date.now()),
            pinned: m.pinned || false,
          }));
          dispatch({ type: 'SET_MESSAGES', payload: mapped });
        }
      })
      .catch(() => {});
  }, []);

  const send = useCallback(async (message: string) => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, timestamp: new Date() };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
    dispatch({ type: 'SET_STREAMING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    saveMessage('user', message).catch(() => {});

    const assistantId = crypto.randomUUID();
    dispatch({ type: 'ADD_MESSAGE', payload: { id: assistantId, role: 'assistant', content: '', timestamp: new Date() } });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reader = await sendMessageSSE(message, controller.signal);
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              const chunk = parsed.choices[0].delta.content;
              fullContent += chunk;
              dispatch({ type: 'APPEND_STREAM_CHUNK', payload: chunk });
            } else if (parsed.error) {
              dispatch({ type: 'SET_ERROR', payload: typeof parsed.error === 'string' ? parsed.error : parsed.error.message || JSON.stringify(parsed.error) });
            }
          } catch {}
        }
      }

      if (fullContent) saveMessage('assistant', fullContent).catch(() => {});
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Stream error' });
    } finally {
      dispatch({ type: 'SET_STREAMING', payload: false });
      readerRef.current = null;
      abortRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    clearHistory().catch(() => {});
    dispatch({ type: 'CLEAR_CONVERSATION' });
  }, []);

  const remove = useCallback((id: string) => {
    deleteMessage(id).catch(() => {});
    dispatch({ type: 'DELETE_MESSAGE', payload: id });
  }, []);

  const pin = useCallback((id: string) => {
    togglePin(id).catch(() => {});
    dispatch({ type: 'TOGGLE_PIN', payload: id });
  }, []);

  return (
    <ChatContext.Provider value={{ state, send, clear, remove, pin }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
