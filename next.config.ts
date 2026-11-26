import type { NextConfig } from "next";

// Az admin és a leiratkozás oldalt nem lehet idegen oldalba ágyazni (clickjacking ellen). A beágyazás szabályai
// (frame-ancestors) a Content-Security-Policy részeként a proxy.js-ben vannak (lib/csp.js); ez a régi böngészőknek szól.
const noFraming = [{ key: "X-Frame-Options", value: "DENY" }];

const nextConfig: NextConfig = {
  // A weboldal (app/(weblap)/weblapteszt) hírszerkesztőjében a feltöltött kép (legfeljebb 4 MB) az űrlappal megy fel
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
    // Az e2e tesztszerver (tests/e2e/server.mjs) lemezes Turbopack-gyorsítótár nélkül fut: egy félbehagyott vagy régi
    // gyorsítótárral a fejlesztői szerver minden oldalt újra és újra betölt, és a tesztek elakadnak
    turbopackFileSystemCacheForDev: process.env.E2E_NO_DEV_CACHE !== "1",
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
