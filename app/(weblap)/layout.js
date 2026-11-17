import '@/weblap/globals.css';

// A Tavern weboldal saját gyökér-layoutja (a naptárétól külön: más betűk, más alapstílus). A naptár oldalai az
// app/(naptar) alatt vannak; a kettő között átlépve a böngésző az egész oldalt újratölti.
export const metadata = {
  title: 'Tavern – kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon',
  description: 'Tavern Debrecen, JátékCéh és Tavern Miskolc: versenyek minden héten, ligák, előrendelés és hírek a boltokból.',
  // Tesztváltozat: a keresők ne vegyék fel
  robots: { index: false, follow: false },
};

// A főoldal töltőképernyője (HomePage: [data-toltokep]) munkamenetenként egyszer, az első betöltéskor látszik: ez a kis
// szkript még a kirajzolás előtt eldönti (html[data-tolto="fut"]), és ~2,2 mp múlva, vagy kattintásra / billentyűre
// elrejti (html[data-tolto-kesz]). JavaScript nélkül nincs töltőképernyő.
const INTRO = `try{var d=document.documentElement,k='tavern-tolto';if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');d.dataset.tolto='fut';var done=function(){d.dataset.toltoKesz='1'};setTimeout(done,2200);addEventListener('pointerdown',done,{once:true});addEventListener('keydown',done,{once:true})}}catch(e){}`;

export default function WebsiteLayout({ children }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: INTRO }} /></head>
      <body>{children}</body>
    </html>
  );
}
