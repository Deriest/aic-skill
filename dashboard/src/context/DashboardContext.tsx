import { createContext, useContext, useReducer, ReactNode } from 'react';
import type { DashboardState, DashboardAction } from '../types';

export const initialState: DashboardState = {
  connected: false,
  workers: {},
  currentTask: null,
  currentPhase: null,
  startedAt: Date.now()
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...action.payload, connected: true };
    case 'SET_ERROR':
      return { ...state, connected: false };
    default:
      return state;
  }
}

const DashboardContext = createContext<{
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
} | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}