"use client";
import UserAdmin from '@/components/UserAdmin';
import AdminPage, { AdminLoading } from '@/components/AdminPage';
import { useCalendar } from '@/app/useCalendar';
import { redirect } from 'next/navigation';

export default function UsersAdminPage() {
  const app = useCalendar();
  if (app.loading) return <AdminLoading />;
  // A tulajdonos, illetve akinek a csoportja a felhasználókezelést megengedi
  if (app.userRole !== 'owner' && !(app.userRole === 'admin' && app.hasFeature('users'))) redirect('/admin');

  return (
    <AdminPage title="Felhasználók és csoportok">
      <UserAdmin currentUserId={app.userId} />
    </AdminPage>
  );
}
