import type { NextConfig } from "next";

// Az admin és a leiratkozás oldalt nem lehet idegen oldalba ágyazni (clickjacking ellen).
// A nyilvános naptár (/ és /embed) szándékosan bárhová beágyazható, pl. a webshopba.
const noFraming = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

// Az űrlapos és tartalmi oldalakat (esemény, jelentkezés, előrendelés, asztalfoglalás, liga, weboldal) csak a saját
// oldalaink ágyazhatják be: a weboldal ablaka (tavern.hu), a webshop (WEBSHOP_URL) és a FRAME_ANCESTORS-ban felsoroltak
// (szóközzel elválasztott címek, pl. "https://pelda.hu https://*.pelda.hu"). Idegen oldal így nem rejtheti el őket
// (clickjacking), és a beágyazott asztalfoglalás jelzése (postMessage) sem juthat idegen oldalhoz.
const originOf = (url?: string) => { try { return url ? new URL(url).origin : null; } catch { return null; } };
const frameAllow = [
  "'self'", "https://tavern.hu", "https://*.tavern.hu",
  originOf(process.env.WEBSHOP_URL),
  ...(process.env.FRAME_ANCESTORS || "").split(/\s+/).filter(v => /^https:\/\/(\*\.)?[\w.-]+(:\d+)?$/.test(v)),
].filter(Boolean);
const ownFraming = [{ key: "Content-Security-Policy", value: `frame-ancestors ${[...new Set(frameAllow)].join(" ")}` }];
const OWN_FRAMED = ["/esemeny", "/jelentkezes", "/elorendeles", "/asztalfoglalas", "/liga", "/weblapteszt"];

const nextConfig: NextConfig = {
  // A weboldal (app/(weblap)/weblapteszt) hírszerkesztőjében a feltöltött kép (legfeljebb 4 MB) az űrlappal megy fel
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
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
      ...OWN_FRAMED.map(source => ({ source: `${source}/:path*`, headers: ownFraming })),
      { source: "/admin", headers: noFraming },
      { source: "/admin/:path*", headers: noFraming },
      { source: "/weblapteszt/admin", headers: noFraming },
      { source: "/leiratkozas", headers: noFraming },
    ];
  },
};

export default nextConfig;
