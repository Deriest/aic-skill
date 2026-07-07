import { Outlet } from 'react-router-dom';

export function DashboardLayout() {
  return (
    <div className="flex-1 flex flex-col bg-[#0a0a1a] p-4 md:p-6">
      <Outlet />
    </div>
  );
}
