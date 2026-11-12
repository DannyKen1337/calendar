import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import SubPage from '@/weblap/components/SubPage';
import AlbumList from '@/weblap/components/AlbumList';
import AlbumPhotos from '@/weblap/components/Lightbox';
import { visibleAlbums, albumDate, albumSlugs } from '@/weblap/lib/albums';
import { ALBUM_GAMES, STORE_LABELS } from '@/weblap/lib/contentSchema';
import { withBase } from '@/weblap/lib/basePath';
import s from '@/weblap/fooldal.module.css';

// A Galéria oldal (eseményenként egy album) és egy album oldala, élesben és az előnézetben is (preview: { bar, base }).
// Az albumokat a szerkesztőfelület Galéria fülén töltik fel (content.albums).
const gameLabel = (g) => ALBUM_GAMES.find(x => x.value === g)?.label || '';
const meta = (a) => [albumDate(a.date), STORE_LABELS[a.store]].filter(Boolean).join(' · ');

// Egy album a linkje szerint (az esemény nevéből: /galeria/pokeween-2026). A régi, azonosítós linkeket (uj-…) is megtalálja:
// ilyenkor oldBy: true, és az oldal átirányít az új linkre. Visszaad: { album, slug, oldBy } vagy null
export function getAlbum(content, key) {
  const list = visibleAlbums(content.albums?.albums);
  const slugs = albumSlugs(list);
  const k = decodeURIComponent(String(key || ''));
  const bySlug = list.find(a => slugs.get(a.id) === k);
  if (bySlug) return { album: bySlug, slug: k, oldBy: false };
  const byId = list.find(a => a.id === k);
  return byId ? { album: byId, slug: slugs.get(byId.id), oldBy: true } : null;
}

export function GalleryIndex({ content, preview = null }) {
  const { albums: page } = content;
  const base = preview?.base || '';
  const shown = visibleAlbums(page.albums);
  const slugs = albumSlugs(shown);
  const list = shown.map(a => ({
    id: a.id,
    href: withBase(`${base}/galeria/${slugs.get(a.id)}`),
    title: a.title || 'Album',
    date: albumDate(a.date),
    store: STORE_LABELS[a.store] || '',
    game: a.game,
    gameLabel: gameLabel(a.game),
    count: a.pictures.filter(p => p.picture?.src).length,
    cover: withBase(a.pictures.find(p => p.picture?.src).picture.thumb || a.pictures.find(p => p.picture?.src).picture.src),
  }));
  return (
    <SubPage content={content} preview={preview} current="galeria">
      <section className={s.section} aria-labelledby="galeria-oldal-cim">
        <div className={s.sectionHead}>
          <h1 id="galeria-oldal-cim" className={s.h2}>{page.title}</h1>
          {page.lead && <p className={s.sectionLead}>{page.lead}</p>}
        </div>
        {list.length ? <AlbumList albums={list} /> : <p className={s.postsEmpty}>Hamarosan itt lesznek a képek az eseményeinkről.</p>}
      </section>
    </SubPage>
  );
}

export function GalleryAlbum({ id, content, preview = null }) {
  const found = getAlbum(content, id);
  if (!found) notFound();
  const base = preview?.base || '';
  if (found.oldBy) redirect(withBase(`${base}/galeria/${found.slug}`));
  const a = found.album;
  // a helyi képek (/photos/...) a /weblapteszt előtaggal, a külsők (ImgBB) változatlanul
  const pictures = a.pictures.filter(p => p.picture?.src).map(p => ({ id: p.id, src: withBase(p.picture.src), thumb: p.picture.thumb ? withBase(p.picture.thumb) : null, alt: p.picture.alt, caption: p.caption }));
  return (
    <SubPage content={content} preview={preview} current="galeria">
      <section className={s.section} aria-labelledby="album-cim">
        <div className={s.sectionHead}>
          <p className={s.postMeta}><Link href={withBase(`${base}/galeria`)}>← {content.albums.title}</Link><span>{meta(a)}</span></p>
          <h1 id="album-cim" className={s.h2}>{a.title || 'Album'}</h1>
          <p className={s.albumInfo}>{[gameLabel(a.game), `${pictures.length} kép`].filter(Boolean).join(' · ')}</p>
        </div>
        <AlbumPhotos pictures={pictures} title={a.title || 'Album'} />
      </section>
    </SubPage>
  );
}
