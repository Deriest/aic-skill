import React from 'react';
import { ChatProvider } from '../context/ChatContext';
import { TerminalChatUI } from '../components/chat/TerminalChatUI';

export function ChatPage() {
  return (
    <ChatProvider>
      <TerminalChatUI />
    </ChatProvider>
  );
}