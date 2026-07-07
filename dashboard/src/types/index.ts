export interface WorkerDef {
  id: string;
  name: string;
  role: string;
  spriteId?: string;
  section: string;
  capabilities?: string[];
  [key: string]: any;
}

export interface WorkerState {
  status: 'idle' | 'working' | 'blocked' | 'error';
  engine: string | null;
  currentTask: string | null;
}

export interface DashboardState {
  connected: boolean;
  workers: Record<string, WorkerState>;
  currentTask: {
    id: string;
    title: string;
    type: string;
  } | null;
  currentPhase: string | null;
  startedAt: number;
}

export interface ConfigState {
  env: string;
  opencode: string;
}