export interface WorkerState {
  status: 'idle' | 'working' | 'blocked' | 'error' | 'complete';
  engine: string | null;
  currentTask: string | null;
}

export interface WorkerDef {
  id: string;
  name: string;
  displayName?: string;
  role: string;
  spriteId?: string;
  section: string;
  capabilities?: string[];
  [key: string]: any;
}

export interface ConfigState {
  env: string;
  opencode: string;
}

export interface DashboardState {
  connected: boolean;
  workers: Record<string, WorkerState>;
  currentTask: { id: string, title: string, type: string } | null;
  currentPhase: string | null;
  startedAt: number;
}

export type DashboardAction = 
  | { type: 'SET_STATE'; payload: DashboardState }
  | { type: 'SET_ERROR'; payload: string };