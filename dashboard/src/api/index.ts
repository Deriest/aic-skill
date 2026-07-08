import { DashboardState, ConfigState } from '../types';

const API_BASE = '/api'; // Handled by Vite proxy or relative path

interface MetricsResponse {
  metrics: any[];
  summary: {
    totalRequests: number;
    totalInput: number;
    totalOutput: number;
    totalCache: number;
    cacheHitRate: number;
    byWorker: Record<string, any>;
    byDay: Record<string, any>;
  };
}

export const api = {
  getStatus: async (): Promise<DashboardState> => {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },
  
  getConfig: async (): Promise<ConfigState> => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  saveConfig: async (config: Partial<ConfigState>): Promise<void> => {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save config');
  },

  getMetrics: async (params?: string): Promise<MetricsResponse> => {
    const url = params ? `${API_BASE}/metrics?${params}` : `${API_BASE}/metrics`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  }
};