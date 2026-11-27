"use client";
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { useCalendar } from '@/app/useCalendar';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import InboxAdmin from '@/components/InboxAdmin';

// Beérkezett levelek: a rendszer postafiókjába érkezett összes levél, csak olvasásra („Beérkezett levelek” jog)
export default function InboxPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading name={app.userDisplayName} />;
  if (app.userRole !== 'owner' && !(app.userRole === 'admin' && app.hasFeature('mailbox'))) redirect('/admin');

  return (
    <AdminPage title="Beérkezett levelek">
      {app.contextHolder}
      <Suspense fallback={null}><InboxAdmin /></Suspense>
    </AdminPage>
  );
}
