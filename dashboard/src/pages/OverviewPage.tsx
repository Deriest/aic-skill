import { OfficeFloor } from '../components/office/OfficeFloor';

export function OverviewPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-6">
      <main className="flex-1 min-w-0">
        <OfficeFloor />
      </main>
    </div>
  );
}
