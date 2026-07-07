import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { DashboardAction, DashboardState } from '../types';
import { dashboardReducer, initialState } from './dashboardReducer';
import { getHealth, getWorkers, getCost, getQueue } from '../api/dashboard';

interface DashboardContextValue {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // Poll health every 5s
  useEffect(() => {
    const poll = () => {
      getHealth()
        .then((data) => {
          dispatch({ type: 'SET_CONNECTED', payload: !!data?.ok });
        })
        .catch(() => {
          dispatch({ type: 'SET_CONNECTED', payload: false });
        });
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // Poll workers every 5s
  useEffect(() => {
    const poll = () => {
      getWorkers()
        .then((workers) => {
          const agents: Record<string, import('../types').AgentStatus> = {};
          for (const w of workers) {
            agents[w.id] = { status: w.status as import('../types').WorkerState };
          }
          dispatch({ type: 'MERGE_STATUS', payload: { agents, phases: [], currentTask: null } });
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // Poll cost every 10s
  useEffect(() => {
    const poll = () => {
      getCost()
        .then((data) => {
          dispatch({ type: 'UPDATE_COST', payload: { tokens: data.totalTokens, cost: data.totalCost } });
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  // Poll queue every 5s
  useEffect(() => {
    const poll = () => {
      getQueue()
        .then((queue) => {
          dispatch({ type: 'SET_TASK_QUEUE', payload: queue });
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
