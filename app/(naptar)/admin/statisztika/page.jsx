"use client";
import StatsDashboard from '@/components/StatsDashboard';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';
import { useLoaderGate } from '@/lib/loaderGate';
import { redirect } from 'next/navigation';

export default function StatsPage() {
  const app = useCalendar();
  // a betöltő megvárja a már elkezdett kockadobás végét (lib/loaderGate.js)
  const waiting = useLoaderGate(app.loading);
  if (waiting) return <AdminLoading name={app.userDisplayName} />;
  // Csak bejelentkezett szervezőknek
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');
  // Korlátozott szervezőnek: mely játékok adatai látszanak
  const limitedNote = (what) => (Array.isArray(app.allowedCategories) && app.userRole !== 'owner'
    ? `Csak az általad kezelt játékok ${what} látszanak: ${app.allowedCategories.join(', ') || 'nincs kezelt játék'}.`
    : null);

  return (
    <AdminPage title="Statisztika" sub={limitedNote('adatai')} width="wide">
      <StatsDashboard />
    </AdminPage>
  );
}
