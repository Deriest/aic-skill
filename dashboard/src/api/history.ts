import { get } from './client';
import type { HistoryEntry, AnalyticsData } from '../types';

export function getHistory() {
  return get<HistoryEntry[]>('/api/history');
}

export function getAnalytics() {
  return get<AnalyticsData>('/api/analytics');
}
