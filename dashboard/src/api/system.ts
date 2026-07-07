import { get, post } from './client';
import type { SystemHealth, CostData } from '../types';

export function getHealth() {
  return get<SystemHealth>('/health');
}

export function getCost() {
  return get<CostData>('/api/cost');
}

export function resetState() {
  return post('/api/reset');
}
