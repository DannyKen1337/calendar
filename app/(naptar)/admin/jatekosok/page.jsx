"use client";
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import { useLoaderGate } from '@/lib/loaderGate';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import PlayerBaseAdmin from '@/components/PlayerBaseAdmin';

// Játékos bázis játékonként (a jelentkezésekből). Csak a kezelt játékok listája látszik.
export default function PlayersPage() {
  const app = useCalendar();
  // a betöltő megvárja a már elkezdett kockadobás végét (lib/loaderGate.js)
  const waiting = useLoaderGate(app.loading);
  if (waiting) return <AdminLoading name={app.userDisplayName} />;
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Játékosok">
      {app.contextHolder}
      <PlayerBaseAdmin />
    </AdminPage>
  );
}
