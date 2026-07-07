import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { getConfig, saveConfig, runSelfTest } from '../api/config';

interface ConfigState {
  config: unknown;
  draft: string;
  dirty: boolean;
  parseError: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  selfTestResult: 'idle' | 'running' | 'pass' | 'fail';
  selfTestDetails: string;
}

type ConfigAction =
  | { type: 'SET_CONFIG'; payload: unknown }
  | { type: 'SET_DRAFT'; payload: string }
  | { type: 'SET_PARSE_ERROR'; payload: string | null }
  | { type: 'SET_SAVE_STATUS'; payload: ConfigState['saveStatus'] }
  | { type: 'SET_SELF_TEST'; payload: ConfigState['selfTestResult']; details?: string };

const initialState: ConfigState = {
  config: null,
  draft: '',
  dirty: false,
  parseError: null,
  saveStatus: 'idle',
  selfTestResult: 'idle',
  selfTestDetails: '',
};

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.payload, draft: JSON.stringify(action.payload, null, 2), dirty: false, parseError: null };
    case 'SET_DRAFT': {
      const dirty = action.payload !== JSON.stringify(state.config, null, 2);
      let parseError: string | null = null;
      try { JSON.parse(action.payload); } catch (e) { parseError = e instanceof Error ? e.message : 'Invalid JSON'; }
      return { ...state, draft: action.payload, dirty, parseError };
    }
    case 'SET_PARSE_ERROR':
      return { ...state, parseError: action.payload };
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.payload };
    case 'SET_SELF_TEST':
      return { ...state, selfTestResult: action.payload, selfTestDetails: action.details ?? '' };
    default:
      return state;
  }
}

interface ConfigContextValue {
  state: ConfigState;
  setDraft: (value: string) => void;
  save: () => Promise<void>;
  reset: () => void;
  selfTest: () => Promise<void>;
  load: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(configReducer, initialState);

  const load = useCallback(async () => {
    try {
      const data = await getConfig();
      dispatch({ type: 'SET_CONFIG', payload: data });
    } catch {
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setDraft = useCallback((value: string) => {
    dispatch({ type: 'SET_DRAFT', payload: value });
  }, []);

  const save = useCallback(async () => {
    if (state.parseError) return;
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
    try {
      const parsed = JSON.parse(state.draft);
      await saveConfig(parsed);
      dispatch({ type: 'SET_CONFIG', payload: parsed });
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
    } catch {
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
    }
  }, [state.draft, state.parseError]);

  const reset = useCallback(() => {
    dispatch({ type: 'SET_CONFIG', payload: state.config });
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' });
  }, [state.config]);

  const selfTest = useCallback(async () => {
    dispatch({ type: 'SET_SELF_TEST', payload: 'running' });
    try {
      const result = await runSelfTest();
      dispatch({ type: 'SET_SELF_TEST', payload: result.pass ? 'pass' : 'fail', details: result.details });
    } catch {
      dispatch({ type: 'SET_SELF_TEST', payload: 'fail', details: 'Request failed' });
    }
  }, []);

  return (
    <ConfigContext.Provider value={{ state, setDraft, save, reset, selfTest, load }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
