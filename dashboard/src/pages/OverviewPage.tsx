import { OfficeFloor } from '../components/office/OfficeFloor';
import { Sidebar } from '../components/sidebar/Sidebar';
import { ActivityLog } from '../components/sidebar/ActivityLog';
import { PageShell } from '../components/shared/PageShell';

export function OverviewPage() {
  return (
    <PageShell title="OVERVIEW">
      <div className="flex flex-col min-h-0">
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          <main className="flex-[3] min-w-0">
            <OfficeFloor />
          </main>
          <aside className="w-full lg:flex-[1] lg:shrink-0 flex flex-col min-w-[280px]">
            <Sidebar />
          </aside>
        </div>
        <div className="mt-4">
          <ActivityLog />
        </div>
      </div>
    </PageShell>
  );
}
