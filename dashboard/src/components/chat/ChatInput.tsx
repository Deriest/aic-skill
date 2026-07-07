import { useState, useRef, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    ref.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t-2 border-aic-border bg-aic-bg-panel p-3 flex gap-2 items-end">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Streaming...' : 'Type a message...'}
        rows={2}
        className="flex-1 bg-aic-bg-dark border-2 border-aic-border text-aic-text font-pixel text-px-sm p-2 resize-none focus:outline-none focus:border-aic-accent placeholder:text-aic-text-muted disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="font-pixel text-px-sm px-4 py-2 bg-aic-accent text-aic-bg-dark hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity self-end"
      >
        SEND
      </button>
    </div>
  );
}
