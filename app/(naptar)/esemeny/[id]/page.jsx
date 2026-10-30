import { notFound } from 'next/navigation';
import { getPublicEvent, isMaintenanceOn, formatEventDateHu } from '@/lib/events';
import EventPageClient from '@/components/EventPageClient';

const STORE_NAMES = { debrecen: 'Tavern Debrecen', miskolc: 'Tavern Miskolc', jatekceh: 'JátékCéh' };

// Megosztható eseményoldal. A Facebook/Discord előnézet a címet, a leírást és az opengraph-image.jsx képét használja.
export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getPublicEvent(id).catch(() => null);
  if (!event) return { title: 'Esemény nem található – Tavern Calendar' };

  const store = STORE_NAMES[event.store || 'debrecen'] || 'Tavern';
  const when = formatEventDateHu(event.date);
  const description = [when, store, event.category, event.description].filter(Boolean).join(' · ').slice(0, 200);
  return {
    title: `${event.name} – ${store}`,
    description,
    openGraph: { title: event.name, description, type: 'website', locale: 'hu_HU', siteName: 'Tavern Calendar' },
    twitter: { card: 'summary_large_image', title: event.name, description },
  };
}

export default async function EventPage({ params }) {
  const { id } = await params;
  if (await isMaintenanceOn().catch(() => false)) {
    // Karbantartás alatt a bejelentkezett szervezők a kliens oldalon látják az eseményt, a látogatók a karbantartás üzenetet
    return <EventPageClient eventId={id} initialEvent={null} maintenance />;
  }
  const event = await getPublicEvent(id).catch(() => null);
  if (!event) notFound();
  return <EventPageClient eventId={id} initialEvent={event} />;
}
