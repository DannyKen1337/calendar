import '@/weblap/globals.css';

// A Tavern weboldal saját gyökér-layoutja (a naptárétól külön: más betűk, más alapstílus). A naptár oldalai az
// app/(naptar) alatt vannak; a kettő között átlépve a böngésző az egész oldalt újratölti.
export const metadata = {
  title: 'Tavern Debrecen – kártya-, társas-, szerep- és terepasztalos játékklub és bolt',
  description: 'Játékklub és bolt Debrecenben, a Kossuth utca 7.-ben: Pokémon, One Piece, Riftbound, Magic és Warhammer versenyek minden héten, új kiadások a pulton.',
  // Tesztváltozat: a keresők ne vegyék fel
  robots: { index: false, follow: false },
};

// A főoldal nyitó mozgásához: az első kirajzolás előtt elrejti a nyitóképernyőt (html.motion-wait), a GSAP hozza be.
// Csökkentett mozgásnál nem rejt el semmit; ha a szkript 2,5 mp alatt sem fut le, a tartalom akkor is előjön.
const MOTION_WAIT = "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){var d=document.documentElement;d.classList.add('motion-wait');setTimeout(function(){d.classList.remove('motion-wait')},2500)}}catch(e){}";

export default function WebsiteLayout({ children }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: MOTION_WAIT }} /></head>
      <body>{children}</body>
    </html>
  );
}
