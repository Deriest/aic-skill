import React, { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { PageShell } from '../shared/PageShell';

export function TerminalChatUI() {
  const { state, sendMessage, clear } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() && !state.isLoading) {
      sendMessage(e.currentTarget.value.trim());
      e.currentTarget.value = '';
    }
  };

  return (
    <PageShell title="AIC ORCHESTRATOR">
      <div className="flex flex-col h-full bg-aic-surface border-2 border-aic-accent p-1 shadow-[0_0_15px_rgba(0,212,255,0.15)] relative">
        
        {/* Header Bar */}
        <div className="bg-aic-accent text-aic-bg-dark px-3 py-1 flex justify-between items-center font-pixel text-px-xs">
          <span>AIC TERMINAL v1.0</span>
          <button onClick={clear} className="hover:bg-aic-bg-dark hover:text-aic-accent px-2 py-0.5 transition-colors">
            [ CLEAR ]
          </button>
        </div>

        {/* ASCII Art Header */}
        <div className="p-4 font-mono text-aic-accent text-xs whitespace-pre select-none leading-tight border-b border-aic-border/30">
          {`
    ___  _______   ____  ____  _______ __  __   __    _ 
   / _ |/  _/ _ | / __ \\/ __ \\/ ___/ // / / /  / /   (_)
  / __ _/ // __ |/ /_/ / /_/ / /__/ _  / / /__/ /___/ / 
 /_/ |_/___/_/ |_\\____/\\____/\\___/_//_/ /____/_____/_/  
          `}
          <div className="text-aic-text-muted mt-2">AI Engineering Company - Dispatcher Console</div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed" onClick={() => inputRef.current?.focus()}>
          
          <div className="text-aic-text-dim mb-4">
            Available commands: build, fix, research, design, deploy, audit...
            <br />
            Type your task below and press Enter to dispatch.
          </div>

          {state.messages.map((msg, i) => (
            <div key={msg.id || i} className="mb-4 flex flex-col">
              {msg.role === 'user' ? (
                <div className="flex gap-2">
                  <span className="text-aic-green shrink-0">➜ tvd@aic:</span>
                  <span className="text-white">{msg.content}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-aic-accent shrink-0">■ ORCHESTRATOR:</span>
                  <span className="text-aic-text whitespace-pre-wrap ml-4 border-l-2 border-aic-accent/30 pl-3 py-1">{msg.content}</span>
                </div>
              )}
            </div>
          ))}

          {state.isLoading && (
            <div className="flex flex-col gap-1 mt-1 animate-pulse">
              <span className="text-aic-accent shrink-0">■ ORCHESTRATOR:</span>
              <span className="text-aic-text ml-4 border-l-2 border-aic-accent/30 pl-3 py-1 bg-aic-accent/10 w-2 h-4"></span>
            </div>
          )}
          
          {state.error && (
            <div className="text-aic-red mt-2 flex gap-2">
              <span className="shrink-0">[!]</span>
              <span>{state.error}</span>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>

        {/* Status Line */}
        <div className="px-4 py-1.5 border-t border-aic-accent/30 flex justify-between items-center text-xs font-mono text-aic-text-muted">
          <div className="flex gap-4">
            <span className={state.isLoading ? 'text-aic-yellow' : 'text-aic-green'}>
              {state.isLoading ? '● running' : '● ready'}
            </span>
            <span className="text-aic-text-dim hidden sm:inline">| dispatcher</span>
            <span className="text-aic-text-dim">| {state.messages.length} msgs</span>
          </div>
          <div className="text-aic-accent">MAIN</div>
        </div>

        {/* Input Line */}
        <div className="px-4 py-3 bg-aic-bg-dark border-t border-aic-accent/50 flex items-center gap-3">
          <span className="text-aic-accent font-mono shrink-0">&gt;</span>
          <input 
            ref={inputRef}
            type="text" 
            disabled={state.isLoading}
            onKeyDown={handleKeyDown}
            placeholder={state.isLoading ? "Waiting for Orchestrator..." : "try 'build a REST API with JWT auth'"}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder-aic-text-dim/50"
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />
        </div>

      </div>
    </PageShell>
  );
}