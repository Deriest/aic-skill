import { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';

export function TerminalChat() {
  const { state, sendMessage } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() && !state.isLoading) {
      sendMessage(e.currentTarget.value.trim());
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white p-4 font-mono w-full max-w-6xl mx-auto border border-[#333] shadow-2xl relative" style={{ fontFamily: '"Fira Code", monospace' }}>
      
      {/* HEADER ASCII ART */}
      <div className="flex flex-col items-center mb-6 pt-2 border-b border-[#333] pb-4">
        <div className="text-[#a4e217] font-bold tracking-widest mb-4">CHAT</div>
        <pre className="text-center font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#ffb000] to-[#b95000] leading-tight text-xs sm:text-sm">
{` _  _ ___ ___ __  __ ___ ___ 
| || | __| _ \\  \\/  | __/ __|
| __ | _||   / |\\/| | _|\\__ \\
|_||_|___|_|_\\_|  |_|___|___/`}
        </pre>
        <div className="text-[#ffb000] text-sm mt-2">Nous Research - Messenger of the Digital Gods</div>
      </div>

      {/* TERMINAL CONTENT */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto mb-4 px-2 custom-scrollbar"
      >
        <div className="text-[#ffb000] mb-4">
          Hermes Agent v0.16.0 (2024.6.5)<br/>
          Session: AIC-Dispatcher<br/>
          <br/>
          Available Tools:<br/>
          <span className="text-[#a8b8b8]">
          browser: browser_back, browser_click...<br/>
          file: patch, read_file, search_files...<br/>
          delegation: delegate_task<br/>
          code_execution: execute_code<br/>
          </span>
          <br/>
          Type your command below.
        </div>

        {state.messages.map((msg, idx) => (
          <div key={idx} className="mb-4">
            {msg.role === 'user' ? (
              <div className="flex items-start gap-3">
                <span className="text-[#a4e217] shrink-0 mt-1">➜</span>
                <span className="text-white text-sm">{msg.content}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[#ffb000] text-xs font-bold">HERMES</span>
                <div className="text-[#e0e0e0] text-sm whitespace-pre-wrap pl-6">{msg.content}</div>
              </div>
            )}
          </div>
        ))}
        {state.isLoading && (
          <div className="flex items-center gap-2 pl-6 animate-pulse">
            <span className="w-2 h-4 bg-[#ffb000]"></span>
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="border-t border-[#333] pt-3 flex flex-col gap-2">
        <div className="flex items-center gap-4 text-[#a8b8b8] text-xs mb-1">
          <span className="text-[#a4e217]">● ready</span>
          <span>| Opus 4.7</span>
          <span>| {state.messages.length}/200</span>
          <span className="text-[#a4e217]">(aic-dispatcher)</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[#a4e217] text-lg">&gt;</span>
          <input 
            ref={inputRef}
            type="text" 
            disabled={state.isLoading}
            onKeyDown={handleKeyDown}
            placeholder='try "build a REST API"'
            className="flex-1 bg-transparent border-none outline-none text-[#e0e0e0] font-mono text-sm placeholder-[#555]"
            autoFocus
          />
        </div>
      </div>
      
    </div>
  );
}