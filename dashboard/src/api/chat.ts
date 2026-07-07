import { get, post } from './client';

export function sendMessage(message: string, signal?: AbortSignal) {
  return post('/api/chat', { messages: [{ role: 'user', content: message }], model: 'Opus' }) as unknown as Promise<ReadableStreamDefaultReader<Uint8Array>>;
}

// ponytail: sendMessage returns raw Response body reader, not parsed JSON
// The post() helper does res.json() which breaks SSE. Need a raw fetch instead.
export async function sendMessageSSE(message: string, signal?: AbortSignal): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: message }], model: 'Opus' }),
    signal,
  });
  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  if (!res.body) throw new Error('No response body');
  return res.body.getReader();
}

interface HistoryMsg {
  role: string;
  content: string;
  timestamp?: string;
}

export function loadHistory() {
  return get<HistoryMsg[]>('/api/chat/history');
}

export function saveMessage(role: string, content: string) {
  return post('/api/chat/history', { role, content });
}

export function clearHistory() {
  return fetch('/api/chat/history', { method: 'DELETE' }).then(r => r.json());
}

export function deleteMessage(id: string) {
  return fetch(`/api/chat/history/${id}`, { method: 'DELETE' }).then(r => r.json());
}

export function togglePin(id: string) {
  return post(`/api/chat/history/${id}/pin`, {});
}
