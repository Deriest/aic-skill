// === Server API Types (exact server response shape) ===

export interface ServerStatus {
  connected: boolean;
  currentTask: {
    title: string;
    type: string;
    id: string;
  } | null;
  phases: ServerPhase[];
  workers: Record<string, ServerAgentStatus>;
  logs: Array<{
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>;
  workflow?: {
    current: string;
    history: string[];
  };
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
  workers: Record<string, AgentStatus>;
  logs: LogEntry[];
  taskStartTimestamp: number | null;
  error: string | null;
  taskQueue: TaskQueueEntry[];
  tokens: { input: number; output: number };
  cost: number;
  workflow?: {
    current: string;
    history: string[];
  };
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

// === Chat Types ===

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  pinned?: boolean;
}

// === Config Types ===

export interface ConfigSnapshot {
  env: Record<string, string>;
  opencode: unknown;
}

// === Worker Detail (extended) ===

export interface WorkerDetail extends WorkerDef {
  status: WorkerState;
  engine?: 'delegate' | 'opencode';
  circuitBreaker: 'closed' | 'open' | 'half-open';
  taskCount: number;
  lastActive: string | null;
}

// === Audit Types ===

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  level: 'info' | 'warning' | 'error';
}

// === History Types ===

export interface HistoryEntry {
  id: string;
  title: string;
  type: string;
  status: 'complete' | 'error' | 'cancelled';
  startedAt: string;
  completedAt: string;
  duration: number;
  tokens: { input: number; output: number };
  cost: number;
}

export interface AnalyticsData {
  tasksByDay: Array<{ date: string; count: number; errors: number }>;
  tokensByDay: Array<{ date: string; input: number; output: number }>;
  costByDay: Array<{ date: string; cost: number }>;
}

// === System Types ===

export interface SystemHealth {
  ok: boolean;
  port: number;
  uptime: number;
  version: string;
}

export interface CostData {
  totalTokens: { input: number; output: number };
  totalCost: number;
}

// === Task Queue ===

export interface TaskQueueEntry {
  id: string;
  title: string;
  type: string;
  priority: number;
  status: 'queued' | 'running' | 'complete' | 'error' | 'cancelled';
}

// === Reducer Actions ===

export type DashboardAction =
  | { type: 'UPDATE_STATUS'; payload: Partial<Pick<DashboardState, 'workers' | 'phases' | 'currentTask' | 'workflow'>> }
  | { type: 'MERGE_STATUS'; payload: { workers: Record<string, AgentStatus>; phases?: Phase[]; currentTask?: TaskInfo | null; workflow?: { current: string; history: string[] } } }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_TASK_START'; payload: number }
  | { type: 'APPEND_LOG'; payload: LogEntry }
  | { type: 'SET_LOGS'; payload: LogEntry[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TASK_QUEUE'; payload: TaskQueueEntry[] }
  | { type: 'UPDATE_COST'; payload: { tokens: { input: number; output: number }; cost: number } }
  | { type: 'RESET' };
