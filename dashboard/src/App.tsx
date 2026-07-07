import { DashboardProvider } from './context/DashboardContext';
import { useStatusPolling } from './hooks/useStatusPolling';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';

function DashboardApp() {
  useStatusPolling();

  return (
    <div className="min-h-screen flex flex-col">
      <ErrorBoundary>
        <OverviewPage />
      </ErrorBoundary>
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