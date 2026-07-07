import { Routes, Route } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import { useStatusPolling } from './hooks/useStatusPolling';
import { CRTOverlay } from './components/layout/CRTOverlay';
import { Header } from './components/layout/Header';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { TaskManagerPage } from './pages/TaskManagerPage';
import { HistoryPage } from './pages/HistoryPage';
import { SystemPage } from './pages/SystemPage';

function DashboardApp() {
  useStatusPolling();

  return (
    <div className="min-h-screen flex flex-col">
      <CRTOverlay />
      <Header />
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<ErrorBoundary><OverviewPage /></ErrorBoundary>} />
          <Route path="config" element={<ErrorBoundary><ConfigEditorPage /></ErrorBoundary>} />
          <Route path="tasks" element={<ErrorBoundary><TaskManagerPage /></ErrorBoundary>} />
          <Route path="history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
          <Route path="system" element={<ErrorBoundary><SystemPage /></ErrorBoundary>} />
        </Route>
      </Routes>
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
