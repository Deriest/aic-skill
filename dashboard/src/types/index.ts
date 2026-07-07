// === Server API Types (exact server response shape) ===

export interface ServerStatus {
  connected: boolean;
  currentTask: {
    title: string;
    type: string;
    id: string;
  } | null;
  phases: ServerPhase[];
  agents: Record<string, ServerAgentStatus>;
  logs: Array<{
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>;
}

export interface ServerPhase {
  name: string;
  status: 'pending' | 'working' | 'complete';
}

export interface ServerAgentStatus {
  status: 'idle' | 'working' | 'complete' | 'error';
  engine?: 'delegate' | 'opencode';
}

// === Client State Types ===

export type WorkerState = 'idle' | 'working' | 'complete' | 'error';

export interface TaskInfo {
  title: string;
  type: string;
  id: string;
}

export interface Phase {
  name: string;
  status: 'pending' | 'working' | 'complete';
}

export interface AgentStatus {
  status: WorkerState;
  engine?: 'delegate' | 'opencode';
}

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export interface DashboardState {
  connected: boolean;
  currentTask: TaskInfo | null;
  phases: Phase[];
  agents: Record<string, AgentStatus>;
  logEntries: LogEntry[];
  taskStartTimestamp: number | null;
  error: string | null;
}

// === Worker Definition ===

export interface WorkerDef {
  id: string;
  name: string;
  role: string;
  model: string;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  section: string;
}

// === Reducer Actions ===

export type DashboardAction =
  | { type: 'UPDATE_STATUS'; payload: Partial<Pick<DashboardState, 'agents' | 'phases' | 'currentTask'>> }
  | { type: 'MERGE_STATUS'; payload: { agents: Record<string, AgentStatus>; phases?: Phase[]; currentTask?: TaskInfo | null } }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_TASK_START'; payload: number }
  | { type: 'APPEND_LOG'; payload: LogEntry }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };
