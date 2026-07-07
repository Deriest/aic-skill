import type { DashboardAction, DashboardState, AgentStatus } from '../types';
import { MAX_LOG_ENTRIES } from '../utils/constants';

export const initialState: DashboardState = {
  connected: false,
  currentTask: null,
  phases: [],
  agents: {},
  logEntries: [],
  taskStartTimestamp: null,
  error: null,
};

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'UPDATE_STATUS':
      return {
        ...state,
        agents: action.payload.agents ?? state.agents,
        phases: action.payload.phases ?? state.phases,
        currentTask: action.payload.currentTask !== undefined ? action.payload.currentTask : state.currentTask,
        error: null,
      };

    case 'MERGE_STATUS': {
      const incoming = action.payload.agents;
      const allKeys = new Set([...Object.keys(state.agents), ...Object.keys(incoming)]);
      const merged: Record<string, AgentStatus> = {};
      for (const key of allKeys) {
        merged[key] = incoming[key] ?? { status: 'idle' };
      }
      return {
        ...state,
        agents: merged,
        phases: action.payload.phases ?? state.phases,
        currentTask: action.payload.currentTask !== undefined ? action.payload.currentTask : state.currentTask,
        error: null,
      };
    }

    case 'SET_CONNECTED':
      return {
        ...state,
        connected: action.payload,
        error: action.payload ? null : state.error,
      };

    case 'SET_TASK_START':
      return {
        ...state,
        taskStartTimestamp: action.payload,
      };

    case 'APPEND_LOG': {
      const newEntries = [action.payload, ...state.logEntries];
      return {
        ...state,
        logEntries: newEntries.length > MAX_LOG_ENTRIES ? newEntries.slice(0, MAX_LOG_ENTRIES) : newEntries,
      };
    }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
