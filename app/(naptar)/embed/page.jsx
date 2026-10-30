import PublicCalendar from '@/components/PublicCalendar';

export const metadata = { title: 'Tavern Calendar – beágyazott naptár' };

// Külső oldalba (pl. webshop) ágyazható nézet. Beágyazás: <script src="https://<domain>/embed.js" data-store="debrecen"></script>
export default async function EmbedPage({ searchParams }) {
  const { store } = await searchParams;
  return <PublicCalendar embed fixedStore={typeof store === 'string' ? store : null} />;
}
