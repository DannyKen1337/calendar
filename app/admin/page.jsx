"use client";
import { useCalendar } from '@/app/useCalendar';
import { AdminEvents } from '@/app/components';
import { LogoutOutlined } from '@ant-design/icons';

export default function AdminPage() {
  const app = useCalendar(); 

  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* FELSŐ SÁV (Kijelentkezés a jobb szélen, vonallal elválasztva) */}
        <div className="flex justify-between items-center border-b border-[#4A2E33] pb-4">
          <h1 className="text-3xl font-bold text-[#E5B15D] font-serif m-0">
            Admin Vezérlőpult
          </h1>
          <div className="flex items-center gap-4">
            {/* Elválasztó vonal */}
            <div className="h-6 w-px bg-[#4A2E33]"></div>
            
            {/* Kijelentkezés gomb */}
            <button 
              onClick={() => { app.handleLogout(); window.location.href = '/'; }}
              className="text-[#ff4d4f] hover:text-red-400 flex items-center gap-2 font-bold transition text-lg cursor-pointer bg-transparent border-none"
            >
              <LogoutOutlined /> Kijelentkezés
            </button>
          </div>
        </div>

        {/* Események, Szervezők és Táblázatok */}
        <div className="bg-[#2B1A1C] p-6 rounded-2xl border border-[#4A2E33]">
          <AdminEvents app={app} />
        </div>

      </div>
    </main>
  );
}