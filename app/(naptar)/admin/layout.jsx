// Az admin felület web appként is telepíthető (iPhone: Safari → Megosztás → Főképernyőhöz adás):
// saját név, ikon és manifest, sötét állapotsor, és a kijelző teljes felülete (a lekerekített sarkok és a
// kezdőképernyő-csík alatti sávot a tulajdonosi nézet a safe-area értékekkel hagyja szabadon).
export const metadata = {
  title: 'Tavern Admin',
  manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'Tavern Admin', statusBarStyle: 'black' },
  icons: { apple: '/admin-icon-180.png' },
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#121212',
};

export default function AdminLayout({ children }) {
  return children;
}
