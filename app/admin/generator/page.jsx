"use client";
import EventGenerator from '@/components/EventGenerator';
import { useCalendar } from '@/app/useCalendar';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';

export default function GeneratorPage() {
  const app = useCalendar();

  if (app.loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold">Betöltés...</div>;
  }

  // BIZTONSÁGI KAPU: Ha nincs bejelentkezve, visszadobjuk az admin gyökérkönyvtárába (a Login képernyőre)
  if (app.userRole !== 'admin' && app.userRole !== 'owner') {
    if (typeof window !== 'undefined') window.location.href = '/admin';
    return null;
  }

  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="border-b border-[#4A2E33] pb-4">
          <Link href="/admin" className="text-[#E5B15D] hover:text-[#E0D6C8] flex items-center gap-2 font-bold transition w-fit text-lg">
            <ArrowLeftOutlined /> Vissza az Admin Vezérlőpultba
          </Link>
        </div>

        <div className="flex justify-center mt-8">
          <EventGenerator />
        </div>

      </div>
    </main>
  );
}