"use client";
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import MessagesAdmin from '@/components/MessagesAdmin';

// Üzenetek: a jelentkezőkkel és előrendelőkkel folytatott beszélgetések (a sajátjaim; a tulajdonosnak mind)
export default function MessagesPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading />;
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Üzenetek">
      {app.contextHolder}
      <Suspense fallback={null}><MessagesAdmin /></Suspense>
    </AdminPage>
  );
}
