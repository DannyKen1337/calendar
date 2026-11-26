import { isMaintenanceOn } from '@/lib/events';
import { getOpenPreorderProducts } from '@/lib/preorderData';
import PreorderPage from '@/components/PreorderPage';
import { formatPrice, availableInStore, storeLabel, PREORDER_STORES } from '@/lib/preorders';
import { categoryFromSlug } from '@/lib/leagues';

const DEFAULT_META = {
  title: 'Előrendelés – Tavern',
  description: 'Iratkozz fel a Tavern előrendeléseire: válaszd ki a terméket, és add meg az elérhetőségeidet.',
};

// Termék-linknél a megosztási előnézet (cím, leírás) a termék nevét és árát mutatja
export async function generateMetadata({ searchParams }) {
  const { termek } = await searchParams;
  if (typeof termek !== 'string') return DEFAULT_META;
  const products = await getOpenPreorderProducts().catch(() => null);
  const p = products?.find(x => x.id === termek);
  if (!p) return DEFAULT_META;
  const details = [p.price !== null ? formatPrice(p.price) : null, p.releaseDate ? `Megjelenés: ${p.releaseDate}` : null, p.category].filter(Boolean).join(' · ');
  const title = `Előrendelés: ${p.name}${p.price !== null ? ` – ${formatPrice(p.price)}` : ''}`;
  const description = `${details}. Iratkozz fel a Tavernnél!`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary', title, description } };
}

// Nyilvános előrendelő oldal. ?termek=<azonosító>: csak az a termék látszik; ?jatek=<játék>: csak annak a játéknak az
// előrendelései; ?bolt=<bolt>: csak annak a boltnak az előrendelései (a minden boltban átvehetőkkel együtt), a helyi
// közösségnek megosztható; a kettő együtt is megadható. Paraméter nélkül minden játék és minden bolt (összesítő).
// A searchParams használata miatt minden kérésnél frissen töltődik (dinamikus oldal).
export default async function Page({ searchParams }) {
  const { termek, jatek, bolt, embed: embedParam } = await searchParams;
  // ?embed=1: a weboldal ablakában, beépítve (kompakt, nagy fejléc nélkül)
  const embed = embedParam === '1';
  if (await isMaintenanceOn().catch(() => false)) return <PreorderPage maintenance embed={embed} />;
  const products = await getOpenPreorderProducts().catch((err) => { console.error('preorder page error:', err); return null; });
  if (!products) return <PreorderPage loadError embed={embed} />;
  const focusId = typeof termek === 'string' ? termek : null;
  const focused = focusId ? products.find(p => p.id === focusId) : null;
  // Termék-linknél csak az az egy termék kerül le a böngészőbe
  if (focused) return <PreorderPage products={[focused]} focusId={focusId} embed={embed} />;
  // Bolt-link: csak annak a boltnak a termékei (ismeretlen boltnál az összes). Ha a boltnak nincs nyitott előrendelése,
  // azt írja ki (nem az összes bolt termékeit, hogy a helyi közösség ne rendeljen elő máshol átvehetőt).
  const store = !focusId && typeof bolt === 'string' && PREORDER_STORES.includes(bolt) ? bolt : null;
  const inStore = store ? products.filter(p => availableInStore(p, store)) : products;
  // Játék-linknél csak annak a játéknak a termékei (ha ismeretlen a játék, vagy most nincs nyitott terméke: az összes)
  const game = !focusId && typeof jatek === 'string' ? categoryFromSlug(jatek) : null;
  const ofGame = game ? inStore.filter(p => p.category === game) : [];
  const storeName = store ? storeLabel(store) : null;
  if (ofGame.length) return <PreorderPage products={ofGame} game={game} store={store} storeName={storeName} embed={embed} />;
  return <PreorderPage products={inStore} focusId={focusId} store={store} storeName={storeName} embed={embed} />;
}
