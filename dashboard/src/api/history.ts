import { get } from './client';

// ponytail: API shapes don't match frontend types, using `any` until types are synced
export function getHistory() {
  return get<any[]>('/api/history');
}

export function getAnalytics() {
  return get<any>('/api/analytics');
}
