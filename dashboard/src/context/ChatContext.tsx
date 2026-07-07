import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { sendMessageSSE, loadHistory, saveMessage, clearHistory } from '../api/chat';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

type ChatAction = 
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_LAST_MESSAGE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_LAST_MESSAGE': {
      const msgs = [...state.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1].content = action.payload;
      }
      return { ...state, messages: msgs };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface ChatContextValue {
  state: ChatState;
  sendMessage: (text: string) => Promise<void>;
  clear: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    loadHistory().then((data) => {
      // The API returns { success: true, count: N, messages: [...] }
      if (data && 'messages' in data && Array.isArray((data as any).messages)) {
        dispatch({ type: 'SET_MESSAGES', payload: (data as any).messages });
      }
    }).catch(console.error);
  }, []);

  const clear = useCallback(async () => {
    await clearHistory();
    dispatch({ type: 'SET_MESSAGES', payload: [] });
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      await saveMessage('user', text);
      
      const asstMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      dispatch({ type: 'ADD_MESSAGE', payload: asstMsg });

      let fullResponse = '';
      const reader = await sendMessageSSE(text);
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: fullResponse });
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
      
      await saveMessage('assistant', fullResponse);
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', payload: e.message });
      dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: `[SYSTEM ERROR: ${e.message}]` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  return (
    <ChatContext.Provider value={{ state, sendMessage: send, clear }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat out of provider');
  return ctx;
};
