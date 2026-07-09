import { useState } from 'react';
import { DashboardProvider } from './context/DashboardContext';
import { useStatusPolling } from './hooks/useStatusPolling';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';
import { ConfigPage } from './pages/ConfigPage';
import { CostsPage } from './pages/CostsPage';
import { HistoryPage } from './pages/HistoryPage';
import { CRTOverlay } from './components/layout/CRTOverlay';
import { useDashboardContext } from './context/DashboardContext';

function DashboardApp() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'costs' | 'config'>('overview');
  useStatusPolling();
  
  const { state } = useDashboardContext();

  return (
    <div className="flex flex-col min-h-screen bg-aic-bg-dark text-aic-text-bright font-body overflow-hidden">
      <CRTOverlay />
      
      {/* Top Header Navigation */}
      <header className="flex justify-between items-center bg-aic-bg-panel border-b-4 border-aic-border px-6 py-4 z-10 relative shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-aic-accent text-px-lg font-pixel drop-shadow-[0_0_5px_rgba(0,255,255,0.5)] shrink-0 inline-block -translate-y-[2px]">▶</span>
          <h1 className="text-px-lg font-pixel text-aic-accent tracking-widest uppercase text-shadow-cyan whitespace-nowrap">
            AI ENGINEERING COMPANY
          </h1>
        </div>
        
        {/* Tabs - Centered */}
        <div className="flex items-center justify-center flex-1">
          <div className="flex gap-12">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`font-pixel text-px-base uppercase transition-colors pb-1 ${
                activeTab === 'overview' 
                  ? 'text-aic-accent border-b-2 border-aic-accent drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' 
                  : 'text-aic-text-muted hover:text-white'
              }`}
            >
              OVERVIEW (1)
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`font-pixel text-px-base uppercase transition-colors pb-1 ${
                activeTab === 'history' 
                  ? 'text-aic-accent border-b-2 border-aic-accent drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' 
                  : 'text-aic-text-muted hover:text-white'
              }`}
            >
              HISTORY (2)
            </button>
            <button 
              onClick={() => setActiveTab('costs')}
              className={`font-pixel text-px-base uppercase transition-colors pb-1 ${
                activeTab === 'costs' 
                  ? 'text-aic-accent border-b-2 border-aic-accent drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' 
                  : 'text-aic-text-muted hover:text-white'
              }`}
            >
              COSTS (3)
            </button>
            <button 
              onClick={() => setActiveTab('config')}
              className={`font-pixel text-px-base uppercase transition-colors pb-1 ${
                activeTab === 'config' 
                  ? 'text-aic-accent border-b-2 border-aic-accent drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' 
                  : 'text-aic-text-muted hover:text-white'
              }`}
            >
              CONFIG (4)
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-end gap-2 flex-1">
          <div className={`w-3 h-3 rounded-full ${state.connected ? 'bg-aic-green shadow-[0_0_8px_rgba(0,255,0,0.8)] animate-pulse' : 'bg-red-500'}`}></div>
          <span className={`text-px-sm font-pixel tracking-widest uppercase ${state.connected ? 'text-aic-green' : 'text-red-500'}`}>
            {state.connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden z-10 relative">
        <ErrorBoundary>
          {activeTab === 'overview' && <OverviewPage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'costs' && <CostsPage />}
          {activeTab === 'config' && <ConfigPage />}
        </ErrorBoundary>
      </div>

      {/* CRT Scanline Overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]" 
           style={{ background: 'repeating-linear-gradient(0deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 1) 1px, transparent 1px, transparent 2px)' }}>
      </div>
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.2]" 
           style={{ background: 'radial-gradient(circle at center, transparent 50%, rgba(0, 0, 0, 0.6) 100%)' }}>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <DashboardApp />
    </DashboardProvider>
  );
}