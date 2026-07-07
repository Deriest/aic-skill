import { useChat } from '../context/ChatContext';
import { MessageStream } from '../components/chat/MessageStream';
import { ChatInput } from '../components/chat/ChatInput';
import { ContextPanel } from '../components/chat/ContextPanel';

export function ChatPageInner() {
  const { state, send } = useChat();

  return (
    <div className="flex h-[calc(100vh-80px)]">
      <div className="flex-1 flex flex-col min-w-0">
        <MessageStream messages={state.messages} isStreaming={state.isStreaming} />
        {state.streamError && (
          <div className="px-4 py-1 font-pixel text-px-xs text-aic-red bg-aic-bg-panel-dark border-t border-aic-border">
            ERROR: {state.streamError}
          </div>
        )}
        <ChatInput onSend={send} disabled={state.isStreaming} />
      </div>
      <ContextPanel />
    </div>
  );
}
