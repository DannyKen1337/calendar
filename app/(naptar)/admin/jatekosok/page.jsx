"use client";
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import PlayerBaseAdmin from '@/components/PlayerBaseAdmin';

// Játékos bázis játékonként (a jelentkezésekből). Csak a kezelt játékok listája látszik.
export default function PlayersPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading name={app.userDisplayName} />;
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Játékosok">
      {app.contextHolder}
      <PlayerBaseAdmin />
    </AdminPage>
  );
}
