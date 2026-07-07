import { postSSE } from './client';

export function sendMessage(message: string, conversationId?: string, signal?: AbortSignal) {
  return postSSE('/api/chat', { message, conversation_id: conversationId ?? null }, signal);
}

export function cancelStream(reader: ReadableStreamDefaultReader) {
  return reader.cancel();
}
