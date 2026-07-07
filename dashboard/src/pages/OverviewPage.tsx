import { OfficeFloor } from '../components/office/OfficeFloor';
import { Sidebar } from '../components/sidebar/Sidebar';
import { ActivityLog } from '../components/sidebar/ActivityLog';
import { PageShell } from '../components/shared/PageShell';

export function OverviewPage() {
  return (
    <PageShell title="OVERVIEW">
      <div className="flex flex-col min-h-0">
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          <main className="flex-1 min-w-0">
            <OfficeFloor />
          </main>
          <aside className="w-full lg:w-[320px] lg:shrink-0">
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
