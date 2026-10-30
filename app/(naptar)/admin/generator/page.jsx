"use client";
import EventGenerator from '@/components/EventGenerator';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';
import { redirect } from 'next/navigation';

export default function GeneratorPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading />;
  // Csak bejelentkezett szervezőknek (különben vissza a belépéshez)
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Generátor" sub="Ismétlődő események egyszerre, hetente ugyanazon a napon és időpontban." width="narrow">
      <EventGenerator canManageGame={app.canManageGame} canManageStore={app.canManageStore} serverNow={app.serverNow} />
    </AdminPage>
  );
}
