"use client";
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import OccupancyManager from '@/components/OccupancyManager';

// Napi telítettség és kézi helyfoglalás. A tulajdonos mindig eléri; a szervezők akkor, ha a modul be van kapcsolva.
export default function OccupancyPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading />;
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Napi telítettség" width="narrow">
      {app.contextHolder}
      <OccupancyManager app={app} />
    </AdminPage>
  );
}
