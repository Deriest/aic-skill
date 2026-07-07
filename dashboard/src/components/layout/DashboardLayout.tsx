import type { ReactNode } from 'react';
import { OfficeFloor } from '../office/OfficeFloor';
import { Sidebar } from '../sidebar/Sidebar';
import { ActivityLog } from '../sidebar/ActivityLog';

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout(_props: DashboardLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a1a]">
      {/* Top area: Virtual Office + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 md:p-6 max-w-[1800px] mx-auto w-full">
        {/* Virtual Office — takes most space */}
        <main className="flex-1 min-w-0">
          <OfficeFloor />
        </main>
        {/* Sidebar — task info + pipeline only */}
        <aside className="w-full lg:w-[320px] lg:shrink-0 lg:self-stretch">
          <Sidebar />
        </aside>
      </div>
      {/* Activity Log — full width below Virtual Office */}
      <div className="w-full px-4 md:px-6 pb-6 max-w-[1800px] mx-auto">
        <ActivityLog />
      </div>
    </div>
  );
}
