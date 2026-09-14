"use client";
import EventGenerator from '@/components/EventGenerator';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';

export default function GeneratorPage() {
  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Vissza gomb sávja */}
        <div className="border-b border-[#4A2E33] pb-4">
          <Link href="/admin" className="text-[#E5B15D] hover:text-[#E0D6C8] flex items-center gap-2 font-bold transition w-fit text-lg">
            <ArrowLeftOutlined /> Vissza az Admin Vezérlőpultba
          </Link>
        </div>

        {/* Generátor Komponens */}
        <div className="flex justify-center mt-8">
          <EventGenerator />
        </div>

      </div>
    </main>
  );
}