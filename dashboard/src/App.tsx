import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';

function DashboardApp() {
  return (
    <div className="min-h-screen flex flex-col">
      <ErrorBoundary>
        <OverviewPage />
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  return <DashboardApp />;
}