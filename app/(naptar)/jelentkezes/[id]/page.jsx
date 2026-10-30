import { notFound } from 'next/navigation';
import { getPublicEvent, isMaintenanceOn } from '@/lib/events';
import RegistrationPage from '@/components/RegistrationPage';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getPublicEvent(id).catch(() => null);
  return { title: event ? `Jelentkezés: ${event.name} – Tavern` : 'Jelentkezés – Tavern' };
}

// Külön, játékhoz tematikus jelentkezési oldal. ?embed=1: a webshopba ágyazott naptárból nyitva (iframe-en belül)
export default async function JoinPage({ params, searchParams }) {
  const { id } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === '1';

  if (await isMaintenanceOn().catch(() => false)) {
    return <RegistrationPage event={null} maintenance embed={isEmbed} />;
  }
  const event = await getPublicEvent(id).catch(() => null);
  if (!event) notFound();
  return <RegistrationPage event={event} embed={isEmbed} />;
}
