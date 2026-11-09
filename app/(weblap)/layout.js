import '@/weblap/globals.css';

// A Tavern weboldal saját gyökér-layoutja (a naptárétól külön: más betűk, más alapstílus). A naptár oldalai az
// app/(naptar) alatt vannak; a kettő között átlépve a böngésző az egész oldalt újratölti.
export const metadata = {
  title: 'Tavern – kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon',
  description: 'Tavern Debrecen, JátékCéh és Tavern Miskolc: versenyek minden héten, ligák, előrendelés és hírek a boltokból.',
  // Tesztváltozat: a keresők ne vegyék fel
  robots: { index: false, follow: false },
};

export default function WebsiteLayout({ children }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
