export interface WorkerState {
  status: 'idle' | 'working' | 'blocked' | 'error' | 'complete';
  engine: string | null;
  currentTask: string | null;
  subWorkers?: { id: string; status: string; scope: string; }[];
}

export interface WorkerDef {
  id: string;
  name: string;
  displayName: string;
  role: string;
  model: string;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  section: string;
  phase: string;
}

export interface ConfigState {
  env: string;
  opencode: string;
}

export interface RuntimeGate {
  type: string;
  owner: string;
  target: string;
  status: string;
  startedAt: number;
  metadata: any;
}

export interface PhaseBarrier {
  active: boolean;
  workers: string[];
  completed: Record<string, string>;
  startedAt: number;
  timeout: number;
}

export interface PmReview {
  phase: string;
  verdicts: Record<string, string>;
  feedback: Record<string, string>;
  completedAt: number;
}

export interface ReworkState {
  active: boolean;
  failedWorkers: string[];
  passedWorkers: string[];
  attempt: number;
}

export interface ProjectInfo {
  path: string;
  name: string;
  workspace: string;
}

export interface DashboardState {
  connected: boolean;
  workers: Record<string, WorkerState>;
  currentTask: { id: string, title: string, type: string } | null;
  currentPhase: string | null;
  runtimeGate: RuntimeGate | null;
  phaseBarrier: PhaseBarrier | null;
  pmReview: PmReview | null;
  rework: ReworkState | null;
  startedAt: number;
  project?: ProjectInfo;
}

export type DashboardAction =
  | { type: 'SET_STATE'; payload: DashboardState }
  | { type: 'SET_ERROR'; payload: string };
