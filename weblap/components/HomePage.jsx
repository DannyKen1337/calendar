import Link from 'next/link';
import Image from '@/weblap/components/Image';
import { displayFont, textFont } from '@/weblap/lib/fonts';
import Motion from '@/weblap/components/Motion';
import SiteNav from '@/weblap/components/SiteNav';
import WeekProgram from '@/weblap/components/WeekProgram';
import NewsList from '@/weblap/components/NewsList';
import LeagueCards from '@/weblap/components/LeagueCards';
import PreorderCards from '@/weblap/components/PreorderCards';
import { getOpenPreorderProducts } from '@/lib/preorderData';
import { getPublishedLeagues } from '@/lib/leagueData';
import Overlays from '@/weblap/components/Overlays';
import BookingTent from '@/weblap/components/BookingTent';
import StoreStatus from '@/weblap/components/StoreStatus';
import { weekHours } from '@/weblap/lib/stores';
import { visibleAlbums } from '@/weblap/lib/albums';
import { getHomeData } from '@/weblap/lib/home';
import { postHeading, postDate, postHref, SOURCE_NAMES } from '@/weblap/lib/posts';
import { moodAt } from '@/weblap/lib/moods';
import { samplePosts } from '@/weblap/lib/samplePosts';
import SocialPost from '@/weblap/components/SocialPost';
import AlbumsLink from '@/weblap/components/AlbumsLink';
import { CALENDAR_URL, LEAGUES_URL, PREORDER_URL, TABLE_BOOKING_URL, addDays, dayOf, timeOf, weekdayOf, gameShort, eventUrl } from '@/weblap/lib/calendar';
import { getGameConfig, DEFAULT_GAME_LOGO } from '@/lib/gameConfig';
import { navProps } from '@/weblap/lib/site';
import { withBase, CALENDAR_PATHS } from '@/weblap/lib/basePath';
import s from '@/weblap/fooldal.module.css';

const SHORT_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
// A boltok saját logója a programban (ha van)
const STORE_LOGOS = { jatekceh: '/photos/jatekceh-logo.png' };
const ARROW = <span className={s.round} aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1 5h7M5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></span>;

// A cím rövid formája: város és irányítószám nélkül ("Gambrinus köz", "Nagy Imre u. 17")
const streetOf = (address) => address.replace(/^(Debrecen|Miskolc), /, '').replace(/ - .*| ?, \d{4}$/, '');
// A naptár oldalai (esemény, teljes naptár, előrendelés) az oldalon belül, a naptárablakban nyílnak meg
const opensInCalendar = (href) => !!href && (href.startsWith(CALENDAR_URL) || CALENDAR_PATHS.test(href));
// Melyik ablakban nyílik a link: az asztalfoglalás a saját („Foglalt” tábla) ablakában, a többi naptároldal a naptárablakban
const overlayAttrs = (href, title) => {
  if (!opensInCalendar(href)) return {};
  return /\/asztalfoglalas(\?|$)/.test(href.replace(CALENDAR_URL, '')) ? { 'data-table': '', 'data-title': title } : { 'data-cal': '', 'data-title': title };
};

// Az oldal fentről lefelé: cégér az egész első képernyőn (alatta az Előrendelés sáv), a naptár (heti program, nagy
// „teljes naptár” gombbal), Ligák, Asztalfoglalás, Hírek, Galéria (három fotó, link a Galéria oldalra), Itt találsz minket (nyitvatartás és cím: a boltok
// sorai, kattintásra térképablak), Írj nekünk, lábléc. A naptár, a foglalás és a térkép ugyanezen az oldalon nyílik meg
// (Overlays). Az első betöltéskor egy töltőképernyő mutat egy hangulatszöveget (weblap/lib/moods.js, app/(weblap)/layout.js).
// content: az oldal tartalma (éles vagy előnézet); feed: a hírek; previewBar: az előnézet sávja (élesben nincs);
// base: a hírek oldalainak eleje ('' élesben, '/elonezet' az előnézetben)
export default async function HomePage({ content, feed, previewBar = null, base = '' }) {
  const { general, hero, program, gallery, news, contact } = content;
  const { stores, events, now } = await getHomeData(content);
  // A Ligák részben a publikált ligák (legfeljebb 6; egy játéknak boltonként több is lehet); eredmény nélkül „Hamarosan indul”
  const leagues = (await getPublishedLeagues().catch(() => [])).filter(l => l.isPublished).slice(0, 6);
  // Az Előrendelés sávban az élő (nyitott) előrendelések, a legújabb elöl (legfeljebb 3)
  const preorders = (await getOpenPreorderProducts().catch(() => [])).slice(0, 3).map(p => ({
    ...p, logo: getGameConfig(p.category)?.logo || DEFAULT_GAME_LOGO, href: `${PREORDER_URL}?termek=${encodeURIComponent(p.id)}`,
  }));
  const mood = moodAt();

  // A következő hét nap eseményei a programhoz
  const until = addDays(now.day, 7);
  const week = events
    .filter(e => dayOf(e.date) < until)
    .map(e => {
      const day = dayOf(e.date);
      const diff = day === now.day ? 0 : day === addDays(now.day, 1) ? 1 : 2;
      return {
        id: String(e._id || e.id),
        store: e.store || 'debrecen',
        name: e.name.trim(),
        category: e.category || '',
        game: gameShort(e.category),
        // A listában mindig a játék logója (az esemény saját képe lehet külső, nem mindig elérhető kép)
        logo: getGameConfig(e.category).logo || DEFAULT_GAME_LOGO,
        href: eventUrl(e),
        date: e.date,
        day: diff === 0 ? 'ma' : diff === 1 ? 'holnap' : SHORT_DAYS[weekdayOf(day)],
        time: timeOf(e.date),
        full: !e.isOpenAttendance && e.max_players > 0 && (e.current_players || 0) >= e.max_players,
        // a telítettség-sávhoz (csak a létszámos, jelentkezős eseményeknél)
        seats: !e.isOpenAttendance && !e.external_url && e.eventType !== 'community' && e.max_players > 0 ? { taken: Math.min(e.current_players || 0, e.max_players), max: e.max_players } : null,
      };
    });
  const games = [...new Set(week.map(e => e.category))].map(c => ({ category: c, label: gameShort(c) }));

  // A hírek: a kirakott hírek (a saját oldalukra visznek) a listában; a Facebookról / Instagramról behúzott posztok
  // alatta, a közösségi oldalak formájában (SocialPost). Amíg nincs behúzott poszt, minta posztok mutatják, hogy fognak kinézni.
  const storeName = (id) => stores.find(st => st.id === id)?.name;
  const storeOf = (id) => stores.find(st => st.id === id);
  const socialFeed = feed.filter(p => p.source === 'facebook' || p.source === 'instagram');
  const social = (socialFeed.length ? socialFeed : samplePosts().map(p => ({ ...p, sample: true, images: p.images.map(withBase), url: p.source === 'instagram' ? general.instagram : storeOf(p.store)?.facebook })))
    .map(p => ({ key: p.key, source: p.source, who: storeName(p.store) || storeName('debrecen'), date: p.date, text: p.text || '', images: p.images || (p.image ? [p.image] : []), url: p.url || null, sample: !!p.sample }));
  const posts = feed.filter(p => p.source === 'manual').map(p => ({
    key: p.key,
    store: p.store || null,
    who: storeName(p.store) || SOURCE_NAMES[p.source],
    date: postDate(p.date),
    image: p.image,
    heading: postHeading(p) || `${SOURCE_NAMES[p.source]}-poszt`,
    href: p.source === 'manual' ? withBase(`${base}${postHref(p)}`) : p.url,
    external: p.source !== 'manual',
    go: p.source === 'facebook' ? 'Facebookon ↗' : p.source === 'instagram' ? 'Instagramon ↗' : 'Elolvasom →',
  }));
  const postStores = stores.filter(st => posts.some(p => p.store === st.id)).map(st => ({ id: st.id, name: st.name }));
  const facebookPages = stores.filter(st => st.facebook);

  return (
    <div className={`${displayFont.variable} ${textFont.variable} ${s.page} ${previewBar ? s.withPreview : ''}`}>
      {/* Töltőképernyő: csak az első betöltéskor (html[data-tolto="fut"]), 1,6 mp után elhalványul */}
      <div className={s.intro} data-toltokep aria-hidden="true">
        <img src={withBase(hero.sign.src)} alt="" width={1499} height={403} />
        <p className={s.introTitle}>{mood.title}</p>
        <p className={s.introText}>{mood.text}</p>
      </div>
      {previewBar}
      <Motion />
      <SiteNav {...navProps(content, { base })} />

      <main>
        <section className={s.hero} aria-labelledby="fooldal-cim">
          <h1 id="fooldal-cim" className={s.sign} data-sign>
            <Image src={hero.sign.src} alt={hero.sign.alt || 'Tavern'} width={1499} height={403} priority sizes="100vw" />
            <span className={s.srOnly}> – {general.title}</span>
          </h1>
          <PreorderCards products={preorders} allHref={PREORDER_URL} />
          <div className={s.heroFoot}>
            {hero.text && <p>{hero.text}</p>}
            {hero.button && <div className={s.heroActions}><a className={s.btnGhost} href="#program">{hero.button}</a></div>}
          </div>
        </section>

        <section className={s.program} id="program" aria-labelledby="program-cim">
          <div className={s.programHead}>
            <h2 id="program-cim" className={s.disp} data-reveal>{program.title}</h2>
            {program.button && general.cta.href && (
              <a className={s.calCta} href={general.cta.href} data-cal data-title={general.cta.label || program.button} data-teljes-naptar aria-haspopup="dialog">
                <svg className={s.calCtaIcon} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                <span className={s.calCtaText}><b>{program.button}</b><small>Minden esemény, mindhárom bolt</small></span>
                <span className={s.calCtaGo} aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1 5h7M5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></span>
              </a>
            )}
          </div>
          {week.length ? (
            <WeekProgram
              stores={stores.map(st => ({ id: st.id, name: st.name, street: streetOf(st.address), logo: STORE_LOGOS[st.id] ? withBase(STORE_LOGOS[st.id]) : null }))}
              events={week}
              games={games}
              allLabel={program.allGames}
            />
          ) : (
            <p className={s.programEmpty}>{program.empty}</p>
          )}
        </section>

        <section className={s.liga} id="liga" aria-labelledby="liga-cim">
          <div className={s.ligaHead}>
            <div className={s.ligaTitle}>
              <h2 id="liga-cim" className={s.disp} data-reveal>Ligák</h2>
              <p>Pontok alkalomról alkalomra, nyilvános ranglistával.</p>
            </div>
            {/* Az összes liga: ugyanolyan nagy arany gomb, mint „A teljes naptár”; az oldalon belül, a naptárablakban nyílik */}
            <a className={s.calCta} href={LEAGUES_URL} data-cal data-title="Ligák" data-osszes-liga aria-haspopup="dialog">
              <svg className={s.calCtaIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" /></svg>
              <span className={s.calCtaText}><b>Az összes liga</b><small>Ranglisták, korábbi szezonok</small></span>
              <span className={s.calCtaGo} aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1 5h7M5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></span>
            </a>
          </div>
          {leagues.length > 0 && <LeagueCards leagues={leagues} />}
        </section>

        <section className={s.booking} id="asztalfoglalas" aria-labelledby="asztalfoglalas-cim" data-asztalfoglalas>
          <div className={s.bookingSay}>
            <h2 id="asztalfoglalas-cim" className={s.disp} data-reveal>{content.stores.bookingTitle}</h2>
            {content.stores.bookingText && <p>{content.stores.bookingText}</p>}
            <a className={s.btn} href={TABLE_BOOKING_URL} data-table data-title={content.stores.bookingTitle} aria-haspopup="dialog">{content.stores.bookingButton}</a>
            <p className={s.bookingOr}>vagy rögtön a bolttal:</p>
            <ul className={s.bookingStores}>
              {stores.map(st => (
                <li key={st.id}>
                  <a href={`${TABLE_BOOKING_URL}?bolt=${st.id}`} data-table data-title={`${content.stores.bookingTitle} · ${st.name}`} aria-haspopup="dialog" aria-label={`Asztalfoglalás: ${st.name}`}>{st.name}{ARROW}</a>
                </li>
              ))}
            </ul>
          </div>
          <BookingTent />
        </section>

        <section className={s.news} id="hirek" aria-labelledby="hirek-cim">
          <div className={s.newsHead}>
            <h2 id="hirek-cim" className={s.disp} data-reveal>{news.title}</h2>
          </div>
          {posts.length > 0 && (
            <>
              <NewsList posts={posts} stores={postStores} allLabel={news.allStores} />
              <Link className={`${s.textlink} ${s.newsAll}`} href={withBase(`${base}/hirek`)}>{news.allLink}</Link>
            </>
          )}
          <div className={s.socialBlock} data-kozossegi>
            <h3 className={s.socialTitle}>{social.some(p => p.sample) ? 'Minta: így jelennek meg a Facebook- és Instagram-posztok' : 'A boltok oldalairól'}</h3>
            <div className={s.socialGrid}>
              {social.map(p => <SocialPost key={p.key} post={p} />)}
            </div>
            <p className={s.newsLinks}>{facebookPages.map(st => <a key={st.id} className={s.textlink} href={st.facebook} target="_blank" rel="noopener noreferrer">{st.name} ↗</a>)}</p>
          </div>
        </section>

        {gallery.pictures.length > 0 && (
          <section className={s.prints} id="galeria" aria-labelledby="galeria-cim">
            <h2 id="galeria-cim" className={s.disp} data-reveal>Galéria</h2>
            {gallery.pictures.slice(0, 3).map((g, i) => (
              <figure key={g.id || i} className={s.print} data-reveal data-nyomat>
                <Image src={g.picture.src} alt={g.picture.alt} width={600} height={800} sizes="20vw" style={{ objectPosition: g.picture.position }} />
              </figure>
            ))}
            {visibleAlbums(content.albums?.albums).length > 0 && <AlbumsLink href={withBase(`${base}/galeria`)} count={visibleAlbums(content.albums?.albums).length} />}
          </section>
        )}

        <section className={s.stores} id="boltok" aria-labelledby="boltok-cim">
          <h2 id="boltok-cim" className={s.disp} data-reveal>{content.stores.title}</h2>
          {stores.map(st => {
            const days = weekHours(st.hours, now.weekday);
            return (
              <a key={st.id} className={s.row} href={st.maps || '#boltok'} data-map={st.id}>
                <div className={s.rowMain}>
                  <h3>{st.name}</h3>
                  <small>{streetOf(st.address)}{st.where ? `, ${st.where[0].toLowerCase()}${st.where.slice(1)}` : ''}</small>
                  <span className={s.rowMap}>Térkép és útvonal ›</span>
                </div>
                {days && (
                  <div className={s.hours} data-nyitvatartas>
                    <StoreStatus hours={st.hours} initial={st.status} className={s.hoursNow} />
                    <dl>
                      {days.map(w => <div key={w.day} data-ma={w.today || undefined}><dt>{w.day}{w.today && <em>{content.stores.todayLabel}</em>}</dt><dd>{w.text}</dd></div>)}
                    </dl>
                  </div>
                )}
              </a>
            );
          })}
        </section>

        <section className={s.contact} id="kapcsolat" aria-labelledby="kapcsolat-cim">
          <h2 id="kapcsolat-cim">{contact.title}</h2>
          {contact.text && <p>{contact.text}</p>}
          <div className={s.fb}>
            {facebookPages.map(st => (
              <a key={st.id} href={st.facebook} target="_blank" rel="noopener noreferrer">
                <b>{st.name}</b><span>{st.facebook.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>{ARROW}
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.blocks} aria-hidden="true">{'TAVERN'.split('').map((ch, i) => <span key={i}>{ch}</span>)}</div>
        <div className={s.foot}>
          <div className={s.footLinks}>
            {contact.links.filter(l => l.label && l.href).map(l => (
              <a key={l.id} href={l.href} {...overlayAttrs(l.href, l.label)}>{l.label}</a>
            ))}
            {facebookPages.map(st => <a key={st.id} href={st.facebook} target="_blank" rel="noopener noreferrer">Facebook · {st.name}</a>)}
          </div>
          <div className={s.footAddr}>
            {stores.map(st => <span key={st.id}>{st.name}: {st.address}</span>)}
          </div>
          <div className={s.footLast}>
            {/* a szerkesztőfelületre nem mutat nyilvános link (a szerkesztők a naptár adminjának „Weboldal” gombjával érik el) */}
            {contact.imprint && <span>{contact.imprint}</span>}
          </div>
        </div>
      </footer>

      <Overlays
        stores={stores.map(st => ({ id: st.id, name: st.name, address: st.address, mapQuery: st.mapQuery, hours: st.hours }))}
        sign={hero.sign.src}
        routeLabel={content.stores.routeButton}
      />
    </div>
  );
}
