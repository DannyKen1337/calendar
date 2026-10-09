"use client";
import StatsDashboard from '@/components/StatsDashboard';
import { useCalendar } from '@/app/useCalendar';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default function StatsPage() {
  const app = useCalendar();

  if (app.loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold">Betöltés...</div>;
  }

  // Csak bejelentkezett szervezőknek
  if (app.userRole !== 'admin' && app.userRole !== 'owner') {
    redirect('/admin');
  }

  return (
    <main className="min-h-screen bg-[#121212] text-white px-4 py-4 md:px-6 2xl:px-10">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#4A2E33] pb-4">
          <h1 className="text-3xl font-bold text-[#E5B15D] font-serif m-0">Statisztika</h1>
          <Link href="/admin" className="text-[#E5B15D] hover:text-[#E0D6C8] flex items-center gap-2 font-bold transition w-fit">
            <ArrowLeftOutlined /> Vissza az Admin Vezérlőpultba
          </Link>
        </div>
        {Array.isArray(app.allowedCategories) && app.userRole !== 'owner' && (
          <p className="text-[#9a8a8c] m-0">Csak az általad kezelt játékok adatai látszanak: {app.allowedCategories.join(', ') || 'nincs kezelt játék'}.</p>
        )}
        <StatsDashboard />
      </div>
    </main>
  );
}
