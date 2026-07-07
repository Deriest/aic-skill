import { get, post } from './client';
import type { ConfigSnapshot } from '../types';

export function getConfig() {
  return get<ConfigSnapshot>('/api/config');
}

export function saveConfig(config: unknown) {
  return post<{ success: boolean }>('/api/config', config);
}

export function runSelfTest() {
  return post<{ pass: boolean; details: string }>('/api/self-test');
}
