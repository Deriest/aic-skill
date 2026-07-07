import type { ChatMessage } from '../../types';
import { ChatBubble } from './ChatBubble';
import { StreamingIndicator } from './StreamingIndicator';
import { useEffect, useRef } from 'react';

interface MessageStreamProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export function MessageStream({ messages, isStreaming }: MessageStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="font-pixel text-px-lg text-aic-accent mb-2">▸ AIC CHAT</div>
          <div className="font-pixel text-px-sm text-aic-text-dim">Send a message to start</div>
        </div>
      )}
      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === '' && (
        <StreamingIndicator />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
