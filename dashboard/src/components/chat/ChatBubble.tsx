import type { ChatMessage } from '../../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatTimestamp } from '../../utils/formatters';

interface ChatBubbleProps {
  message: ChatMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] font-pixel text-px-sm border-2 ${
          isSystem
            ? 'bg-aic-bg-panel-dark border-aic-yellow text-aic-yellow'
            : isUser
            ? 'bg-aic-bg-panel border-aic-accent text-aic-text'
            : 'bg-aic-bg-panel-dark border-aic-border text-aic-text'
        }`}
      >
        <div className="px-3 py-1 border-b border-aic-border flex justify-between items-center">
          <span className={`text-px-xs ${isUser ? 'text-aic-accent' : 'text-aic-green'}`}>
            {(message.role ?? 'user').toUpperCase()}
          </span>
          <span className="text-px-xs text-aic-text-muted">{formatTimestamp(message.timestamp)}</span>
        </div>
        <div className="px-3 py-2 prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-code:text-aic-accent prose-headings:text-aic-accent">
          {isUser || isSystem ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const text = String(children).replace(/\n$/, '');
                  if (match) {
                    return (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ background: '#0f0f1a', border: '1px solid #2a2a4a', fontSize: '10px' }}
                      >
                        {text}
                      </SyntaxHighlighter>
                    );
                  }
                  return <code className="text-aic-accent bg-aic-bg-dark px-1" {...props}>{children}</code>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
