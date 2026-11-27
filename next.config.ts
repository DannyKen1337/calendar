import type { NextConfig } from "next";

// Az admin és a leiratkozás oldalt nem lehet idegen oldalba ágyazni (clickjacking ellen). A beágyazás szabályai
// (frame-ancestors) a Content-Security-Policy részeként a proxy.js-ben vannak (lib/csp.js); ez a régi böngészőknek szól.
const noFraming = [{ key: "X-Frame-Options", value: "DENY" }];

const nextConfig: NextConfig = {
  // ne árulja el a válasz fejléce, milyen keretrendszer fut
  poweredByHeader: false,
  // a helyi tesztkörnyezet (scripts/teszt-inditas.sh) külön build-mappát használ, hogy a tesztek szerverével ne akadjon össze
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // A weboldal (app/(weblap)) hírszerkesztőjében a feltöltött kép (legfeljebb 4 MB) az űrlappal megy fel
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
    // Az e2e tesztszerver (tests/e2e/server.mjs) lemezes Turbopack-gyorsítótár nélkül fut: egy félbehagyott vagy régi
    // gyorsítótárral a fejlesztői szerver minden oldalt újra és újra betölt, és a tesztek elakadnak
    turbopackFileSystemCacheForDev: process.env.E2E_NO_DEV_CACHE !== "1",
  },
  // 2026-11-27 óta a weboldal a gyökérben (a tavern.hu főoldala), a naptár a /naptar címen: a régi címek átirányítanak
  // (a weboldal szerkesztője és előnézete marad a /weblapteszt/admin, /weblapteszt/elonezet címen)
  redirects() {
    return [
      { source: "/weblapteszt", destination: "/", permanent: true },
      { source: "/weblapteszt/hirek", destination: "/hirek", permanent: true },
      { source: "/weblapteszt/hirek/:path*", destination: "/hirek/:path*", permanent: true },
      { source: "/weblapteszt/galeria", destination: "/galeria", permanent: true },
      { source: "/weblapteszt/galeria/:path*", destination: "/galeria/:path*", permanent: true },
    ];
  },
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      { source: "/admin", headers: noFraming },
      { source: "/admin/:path*", headers: noFraming },
      { source: "/weblapteszt/admin", headers: noFraming },
      { source: "/leiratkozas", headers: noFraming },
    ];
  },
};

export default nextConfig;
