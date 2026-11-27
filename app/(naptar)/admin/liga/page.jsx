"use client";
import LeagueAdmin from '@/components/LeagueAdmin';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';
import { useLoaderGate } from '@/lib/loaderGate';
import { redirect } from 'next/navigation';

export default function LeagueAdminPage() {
  const app = useCalendar();
  // a betöltő megvárja a már elkezdett kockadobás végét (lib/loaderGate.js)
  const waiting = useLoaderGate(app.loading);
  if (waiting) return <AdminLoading name={app.userDisplayName} />;
  // Csak bejelentkezett szervezőknek, akiknek a tulajdonos engedélyezte ezt a modult
  if ((app.userRole !== 'admin' && app.userRole !== 'owner') || !app.hasFeature('leagues')) redirect('/admin');
  // Korlátozott szervezőnek: mely játékok adatai látszanak
  const limitedNote = (what) => (Array.isArray(app.allowedCategories) && app.userRole !== 'owner'
    ? `Csak az általad kezelt játékok ${what} látszanak: ${app.allowedCategories.join(', ') || 'nincs kezelt játék'}.`
    : null);

  return (
    <AdminPage title="Ligák" sub={limitedNote('ligái')}>
      <LeagueAdmin />
    </AdminPage>
  );
}
