"use client";
import { Suspense } from 'react';
import { useSearchParams, redirect } from 'next/navigation';
import CheckinView from '@/components/CheckinView';
import { useCalendar } from '@/app/useCalendar';

const Loading = () => <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold">Betöltés...</div>;

function CheckinContent() {
  const app = useCalendar();
  const eventId = useSearchParams().get('event');

  if (app.loading) return <Loading />;
  // Csak bejelentkezett szervezőknek
  if (app.userRole !== 'admin' && app.userRole !== 'owner') redirect('/admin');

  return (
    <main className="min-h-screen bg-[#121212] text-white px-4 py-4">
      {app.contextHolder}
      <div className="max-w-xl mx-auto">
        <CheckinView app={app} eventId={eventId} />
      </div>
    </main>
  );
}

// A useSearchParams miatt Suspense határ kell (lásd Next.js dokumentáció)
export default function CheckinPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CheckinContent />
    </Suspense>
  );
}
