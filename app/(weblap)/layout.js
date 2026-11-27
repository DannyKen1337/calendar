import { headers } from 'next/headers';
import '@/weblap/globals.css';
import TestBadge from '@/components/TestBadge';

// A Tavern weboldal saját gyökér-layoutja (a naptárétól külön: más betűk, más alapstílus). A naptár oldalai az
// app/(naptar) alatt vannak; a kettő között átlépve a böngésző az egész oldalt újratölti.
export const metadata = {
  title: 'Tavern – kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon',
  description: 'Tavern Debrecen, JátékCéh és Tavern Miskolc: versenyek minden héten, ligák, előrendelés és hírek a boltokból.',
  // Élesben a tavern.hu főoldala (a szerkesztő és az előnézet nem kerül a keresőkbe: proxy.js, X-Robots-Tag)
  robots: { index: true, follow: true },
};

// A főoldal töltőképernyője (HomePage: [data-toltokep]) munkamenetenként egyszer, az első betöltéskor látszik: ez a kis
// szkript még a kirajzolás előtt eldönti (html[data-tolto="fut"]), és ~2,2 mp múlva, vagy kattintásra / billentyűre
// elrejti (html[data-tolto-kesz]). JavaScript nélkül nincs töltőképernyő.
const INTRO = `try{var d=document.documentElement,k='tavern-tolto';if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');d.dataset.tolto='fut';var done=function(){d.dataset.toltoKesz='1'};setTimeout(done,2200);addEventListener('pointerdown',done,{once:true});addEventListener('keydown',done,{once:true})}}catch(e){}`;

// A CSP (proxy.js) csak a kéréshez kapott nonce-szal megjelölt scriptet engedi: a töltőképernyő szkriptje is ezt kapja.
// A headers() miatt az oldalak kérésenként renderelődnek (a nonce minden kérésnél új).
export default async function WebsiteLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  return (
    <html lang="hu" suppressHydrationWarning>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: INTRO }} /></head>
      <body>{children}<TestBadge /></body>
    </html>
  );
}
