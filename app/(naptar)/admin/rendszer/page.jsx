"use client";
import SystemDashboard from '@/components/SystemDashboard';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';
import { redirect } from 'next/navigation';

export default function SystemPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading />;
  // Csak a tulajdonos
  if (app.userRole !== 'owner') redirect('/admin');

  return (
    <AdminPage title="Rendszer és napló" width="wide">
      <SystemDashboard />
    </AdminPage>
  );
}
