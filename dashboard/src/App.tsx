import { DashboardProvider } from './context/DashboardContext';
import { useStatusPolling } from './hooks/useStatusPolling';
import { CRTOverlay } from './components/layout/CRTOverlay';
import { Header } from './components/layout/Header';
import { DashboardLayout } from './components/layout/DashboardLayout';

function DashboardApp() {
  useStatusPolling();

  return (
    <div className="min-h-screen">
      <CRTOverlay />
      <Header />
      <DashboardLayout />
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
