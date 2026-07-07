import type { DashboardAction, DashboardState, AgentStatus } from '../types';
import { MAX_LOG_ENTRIES } from '../utils/constants';

export const initialState: DashboardState = {
  connected: false,
  currentTask: null,
  phases: [],
  workers: {},
  logs: [],
  taskStartTimestamp: null,
  error: null,
  taskQueue: [],
  tokens: { input: 0, output: 0 },
  cost: 0,
  workflow: { current: 'Idle', history: [] },
};

function isTaskEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.title === b.title && a.type === b.type;
}

function isPhasesEqual(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].status !== b[i].status) return false;
  }
  return true;
}

function isWorkflowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.current !== b.current) return false;
  if (!a.history || !b.history || a.history.length !== b.history.length) return false;
  for (let i = 0; i < a.history.length; i++) {
    if (a.history[i] !== b.history[i]) return false;
  }
  return true;
}

function isAgentsEqual(a: Record<string, AgentStatus>, b: Record<string, AgentStatus>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!b[key]) return false;
    if (a[key].status !== b[key].status || a[key].engine !== b[key].engine) return false;
  }
  return true;
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'UPDATE_STATUS':
      return {
        ...state,
        workers: action.payload.workers ?? state.workers,
        phases: action.payload.phases ?? state.phases,
        currentTask: action.payload.currentTask !== undefined ? action.payload.currentTask : state.currentTask,
        workflow: action.payload.workflow ?? state.workflow,
        error: null,
      };

    case 'MERGE_STATUS': {
      const incoming = action.payload.workers;
      const allKeys = new Set([...Object.keys(state.workers), ...Object.keys(incoming)]);
      const merged: Record<string, AgentStatus> = {};
      for (const key of allKeys) {
        merged[key] = incoming[key] ?? { status: 'idle' };
      }

      const nextPhases = action.payload.phases ?? state.phases;
      const nextCurrentTask = action.payload.currentTask !== undefined ? action.payload.currentTask : state.currentTask;
      const nextWorkflow = action.payload.workflow ?? state.workflow;

      const workersChanged = !isAgentsEqual(state.workers, merged);
      const phasesChanged = !isPhasesEqual(state.phases, nextPhases);
      const taskChanged = !isTaskEqual(state.currentTask, nextCurrentTask);
      const workflowChanged = !isWorkflowEqual(state.workflow, nextWorkflow);

      if (!workersChanged && !phasesChanged && !taskChanged && !workflowChanged) {
        return state;
      }

      return {
        ...state,
        workers: workersChanged ? merged : state.workers,
        phases: phasesChanged ? nextPhases : state.phases,
        currentTask: taskChanged ? nextCurrentTask : state.currentTask,
        workflow: workflowChanged ? nextWorkflow : state.workflow,
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
      // Anti-spam loop
      if (state.logs.length > 0 && state.logs[state.logs.length - 1].message === action.payload.message) return state;
      const newEntries = [action.payload, ...state.logs];
      return {
        ...state,
        logs: newEntries.length > MAX_LOG_ENTRIES ? newEntries.slice(0, MAX_LOG_ENTRIES) : newEntries,
      };
    }

    case 'SET_LOGS': {
      const entries = action.payload.length > MAX_LOG_ENTRIES ? action.payload.slice(0, MAX_LOG_ENTRIES) : action.payload;
      return {
        ...state,
        logs: entries,
      };
    }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_TASK_QUEUE':
      return {
        ...state,
        taskQueue: action.payload,
      };

    case 'UPDATE_COST':
      return {
        ...state,
        tokens: action.payload.tokens,
        cost: action.payload.cost,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
