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
  taskQueue: TaskQueueEntry[];
  tokens: { input: number; output: number };
  cost: number;
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
  tokens: { input: number; output: number };
  cost: number;
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
  | { type: 'UPDATE_STATUS'; payload: Partial<Pick<DashboardState, 'agents' | 'phases' | 'currentTask'>> }
  | { type: 'MERGE_STATUS'; payload: { agents: Record<string, AgentStatus>; phases?: Phase[]; currentTask?: TaskInfo | null } }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_TASK_START'; payload: number }
  | { type: 'APPEND_LOG'; payload: LogEntry }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TASK_QUEUE'; payload: TaskQueueEntry[] }
  | { type: 'UPDATE_COST'; payload: { tokens: { input: number; output: number }; cost: number } }
  | { type: 'RESET' };
