"use client";
import SystemDashboard from '@/components/SystemDashboard';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';
import { useLoaderGate } from '@/lib/loaderGate';
import { redirect } from 'next/navigation';

export default function SystemPage() {
  const app = useCalendar();
  // a betöltő megvárja a már elkezdett kockadobás végét (lib/loaderGate.js)
  const waiting = useLoaderGate(app.loading);
  if (waiting) return <AdminLoading name={app.userDisplayName} />;
  // Csak a tulajdonos
  if (app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Rendszer és napló" width="wide">
      <SystemDashboard />
    </AdminPage>
  );
}
