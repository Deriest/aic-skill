import { postSSE } from './client';

export function sendMessage(message: string, conversationId?: string, signal?: AbortSignal) {
  return postSSE('/api/chat', { messages: [{ role: 'user', content: message }], model: 'Opus' }, signal);
}

export function cancelStream(reader: ReadableStreamDefaultReader) {
  return reader.cancel();
}
