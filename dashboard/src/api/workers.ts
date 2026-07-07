import { get } from './client';
import type { WorkerDetail, ServerStatus } from '../types';

export function getWorkers() {
  return get<WorkerDetail[]>('/api/workers');
}

export function getStatus() {
  return get<ServerStatus>('/api/status');
}
