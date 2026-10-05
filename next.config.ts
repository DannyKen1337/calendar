import type { NextConfig } from "next";

// Az admin és a leiratkozás oldalt nem lehet idegen oldalba ágyazni (clickjacking ellen).
// A nyilvános naptár (/ és /embed) szándékosan beágyazható, pl. a webshopba.
const noFraming = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
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
      { source: "/leiratkozas", headers: noFraming },
    ];
  },
};

export default nextConfig;
