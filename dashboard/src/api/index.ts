import { DashboardState, ConfigState } from '../types';

const API_BASE = '/api'; // Handled by Vite proxy or relative path

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
  }
};