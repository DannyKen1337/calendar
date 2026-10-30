"use client";
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import OccupancyManager from '@/components/OccupancyManager';

// Napi telítettség és kézi helyfoglalás. A tulajdonos mindig eléri; a szervezők akkor, ha a modul be van kapcsolva.
export default function OccupancyPage() {
  const app = useCalendar();
  if (app.loading) return <div className="min-h-screen bg-[#0f0b0c] flex items-center justify-center text-[#E5B15D] font-bold">Betöltés...</div>;
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <main className="min-h-screen bg-[#0f0b0c] text-white px-4 pt-3 pb-10" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
      {app.contextHolder}
      <div className="max-w-xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between h-11">
          <Link href="/admin" className="text-[#E0D6C8] font-bold no-underline">‹ Admin</Link>
          <b style={{ fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}>Napi telítettség</b>
          <span style={{ width: 56 }} />
        </div>
        <OccupancyManager app={app} />
      </div>
    </main>
  );
}
