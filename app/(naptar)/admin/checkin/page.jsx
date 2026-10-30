"use client";
import { Suspense } from 'react';
import { useSearchParams, redirect } from 'next/navigation';
import CheckinView from '@/components/CheckinView';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';

function CheckinContent() {
  const app = useCalendar();
  const eventId = useSearchParams().get('event');

  if (app.loading) return <AdminLoading />;
  // Csak bejelentkezett szervezőknek
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Check-in" width="narrow" back={eventId ? '/admin/checkin' : '/admin'} backLabel={eventId ? 'Események' : 'Admin'}>
      {app.contextHolder}
      <CheckinView app={app} eventId={eventId} />
    </AdminPage>
  );
}

// A useSearchParams miatt Suspense határ kell (lásd Next.js dokumentáció)
export default function CheckinPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <CheckinContent />
    </Suspense>
  );
}
