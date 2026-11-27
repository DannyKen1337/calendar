"use client";
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import { useLoaderGate } from '@/lib/loaderGate';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import MessagesAdmin from '@/components/MessagesAdmin';

// Üzenetek: a jelentkezőkkel és előrendelőkkel folytatott beszélgetések (a sajátjaim; a tulajdonosnak mind)
export default function MessagesPage() {
  const app = useCalendar();
  // a betöltő megvárja a már elkezdett kockadobás végét (lib/loaderGate.js)
  const waiting = useLoaderGate(app.loading);
  if (waiting) return <AdminLoading name={app.userDisplayName} />;
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Üzenetek">
      {app.contextHolder}
      <Suspense fallback={null}><MessagesAdmin /></Suspense>
    </AdminPage>
  );
}
