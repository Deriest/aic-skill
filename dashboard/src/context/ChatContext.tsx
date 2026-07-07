import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import type { ChatMessage } from '../types';
import { sendMessage, cancelStream } from '../api/chat';
import { CHAT_MAX_MESSAGES } from '../utils/constants';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamError: string | null;
  conversationId: string | null;
}

type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'APPEND_STREAM_CHUNK'; payload: string }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_CONVERSATION' };

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  streamError: null,
  conversationId: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
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
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (message: string) => {
    // Abort any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    dispatch({ type: 'ADD_MESSAGE', payload: { id: crypto.randomUUID(), role: 'user', content: message, timestamp: new Date() } });
    dispatch({ type: 'SET_STREAMING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    // Create placeholder assistant message
    dispatch({ type: 'ADD_MESSAGE', payload: { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: new Date() } });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reader = await sendMessage(message, state.conversationId ?? undefined, controller.signal);
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

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
            // OpenAI-compatible SSE: {"choices":[{"delta":{"content":"..."}}]}
            if (parsed.choices?.[0]?.delta?.content) {
              dispatch({ type: 'APPEND_STREAM_CHUNK', payload: parsed.choices[0].delta.content });
            } else if (parsed.error) {
              dispatch({ type: 'SET_ERROR', payload: typeof parsed.error === 'string' ? parsed.error : parsed.error.message || JSON.stringify(parsed.error) });
            }
          } catch {
            // Not JSON — skip (raw SSE frame noise)
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Stream error' });
    } finally {
      dispatch({ type: 'SET_STREAMING', payload: false });
      readerRef.current = null;
      abortRef.current = null;
    }
  }, [state.conversationId]);

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    dispatch({ type: 'CLEAR_CONVERSATION' });
  }, []);

  return (
    <ChatContext.Provider value={{ state, send, clear }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
