import { get } from './client';

export function getHealth() {
  return get<{ ok: boolean; port: number; uptime: number }>('/health');
}

export function getWorkers() {
  return get<WorkerInfo[]>('/api/workers');
}

export function getCost() {
  return get<{ totalTokens: { input: number; output: number }; totalCost: number }>('/api/cost');
}

export function getQueue() {
  return get<QueueTask[]>('/api/queue');
}

interface WorkerInfo {
  id: string;
  name: string;
  status: string;
  currentTask: string | null;
  tokens: { input: number; output: number };
  cost: number;
  uptime: number;
  circuitBreaker: { state: string; failures: number };
  engine?: 'delegate' | 'opencode';
}

export interface QueueTask {
  id: string;
  title: string;
  type: string;
  priority: number;
  status: 'queued' | 'running' | 'complete' | 'error' | 'cancelled';
  enqueuedAt: string;
}
