import { ChatProvider } from '../context/ChatContext';
import { ChatPageInner } from './ChatPageInner';

export function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageInner />
    </ChatProvider>
  );
}
