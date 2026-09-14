import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; 

export async function GET(request) {
  // BIZTONSÁGI LEÁLLÍTÁS: A bot ideiglenesen ki van kapcsolva!
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  return NextResponse.json({ 
    success: false, 
    message: "⚠️ UVS Szinkronizáció biztonsági okokból LEÁLLÍTVA. Nem történt adatbázis módosítás." 
  }, { status: 200, headers: noCacheHeaders });
}
