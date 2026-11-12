import Link from 'next/link';
import Image from '@/weblap/components/Image';
import { bigShoulders, publicSans } from '@/weblap/lib/fonts';
import Motion from '@/weblap/components/Motion';
import SiteNav from '@/weblap/components/SiteNav';
import WeekProgram from '@/weblap/components/WeekProgram';
import NewsList from '@/weblap/components/NewsList';
import Mosaic from '@/weblap/components/Mosaic';
import LeagueCards from '@/weblap/components/LeagueCards';
import PreorderCards from '@/weblap/components/PreorderCards';
import { getOpenPreorderProducts } from '@/lib/preorderData';
import { getPublishedLeagues } from '@/lib/leagueData';
import Overlays from '@/weblap/components/Overlays';
import TableTent from '@/weblap/components/TableTent';
import StoreStatus from '@/weblap/components/StoreStatus';
import { weekHours } from '@/weblap/lib/stores';
import { visibleAlbums } from '@/weblap/lib/albums';
import { getHomeData } from '@/weblap/lib/home';
import { postHeading, postDate, postHref, SOURCE_NAMES } from '@/weblap/lib/posts';
import { CALENDAR_URL, PREORDER_URL, TABLE_BOOKING_URL, addDays, dayOf, timeOf, weekdayOf, gameShort, eventUrl } from '@/weblap/lib/calendar';
import { getGameConfig, DEFAULT_GAME_LOGO } from '@/lib/gameConfig';
import { navProps } from '@/weblap/lib/site';
import { withBase, BASE_PATH } from '@/weblap/lib/basePath';
import s from '@/weblap/fooldal.module.css';

const SHORT_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const FIELD_STYLES = [s.fSoot, s.fGold, s.fCellar, s.fDark];
// A boltok saját logója a programban (ha van)
const STORE_LOGOS = { jatekceh: '/photos/jatekceh-logo.png' };
const ARROW = <span className={s.round} aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1 5h7M5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></span>;

// A cím rövid formája: város és irányítószám nélkül ("Gambrinus köz", "Nagy Imre u. 17")
const streetOf = (address) => address.replace(/^(Debrecen|Miskolc), /, '').replace(/ - .*| ?, \d{4}$/, '');
// A naptár oldalai (esemény, teljes naptár, előrendelés) az oldalon belül, a naptárablakban nyílnak meg
const opensInCalendar = (href) => !!href && (href.startsWith(CALENDAR_URL) || (href.startsWith('/') && !href.startsWith(BASE_PATH)));
// Melyik ablakban nyílik a link: az asztalfoglalás a saját („Foglalt” tábla) ablakában, a többi naptároldal a naptárablakban
const overlayAttrs = (href, title) => {
  if (!opensInCalendar(href)) return {};
  return /\/asztalfoglalas(\?|$)/.test(href.replace(CALENDAR_URL, '')) ? { 'data-table': '', 'data-title': title } : { 'data-cal': '', 'data-title': title };
};

// Az oldal: a cégér az egész első képernyőn (beúszik, görgetésre kiúszik), a heti program a naptárból,
// a hírek a boltokból, a boltok sorai (kattintásra térképablak) az asztalfoglalással, nagy mondatok színes mezőkön,
// galéria, a képfal (Mosaic), Kapcsolat a boltok Facebook-oldalaival, lábléc. A naptár és a térkép ugyanezen az oldalon nyílik meg (Overlays).
// content: az oldal tartalma (éles vagy előnézet); feed: a hírek; previewBar: az előnézet sávja (élesben nincs);
// base: a hírek oldalainak eleje ('' élesben, '/elonezet' az előnézetben)
export default async function HomePage({ content, feed, previewBar = null, base = '' }) {
  const { general, hero, program, features, gallery, slideshow, news, contact } = content;
  const { stores, events, now } = await getHomeData(content);
  // A Ligák mezőben a publikált ranglisták (legfeljebb 4 liga); ha nincs, a mező a régi
  const leagues = (await getPublishedLeagues().catch(() => [])).filter(l => l.isPublished && l.rows.length > 0).slice(0, 4);
  // Az Előrendelés mezőben az élő (nyitott) előrendelések, a legújabb elöl (legfeljebb 4)
  const preorders = (await getOpenPreorderProducts().catch(() => [])).slice(0, 4).map(p => ({
    ...p, logo: getGameConfig(p.category)?.logo || DEFAULT_GAME_LOGO, href: `${PREORDER_URL}?termek=${encodeURIComponent(p.id)}`,
  }));

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
      };
    });
  const games = [...new Set(week.map(e => e.category))].map(c => ({ category: c, label: gameShort(c) }));

  // A hírek: a boltok Facebook-posztjai a bolt nevével, a kirakott hírek a saját oldalukra visznek
  const storeName = (id) => stores.find(st => st.id === id)?.name;
  const posts = feed.map(p => ({
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
    <div className={`${bigShoulders.variable} ${publicSans.variable} ${s.page} ${previewBar ? s.withPreview : ''}`}>
      {previewBar}
      <Motion />
      <SiteNav {...navProps(content, { base })} />

      <main>
        <section className={s.hero} aria-labelledby="fooldal-cim">
          <h1 id="fooldal-cim" className={s.sign} data-sign>
            <Image src={hero.sign.src} alt={hero.sign.alt || 'Tavern'} width={1499} height={403} priority sizes="100vw" />
            <span className={s.srOnly}> – {general.title}</span>
          </h1>
          <div className={s.heroFoot}>
            {hero.text && <p>{hero.text}</p>}
            {hero.button && <div className={s.heroActions}><a className={s.btn} href="#program">{hero.button}</a></div>}
          </div>
        </section>

        <section className={s.program} id="program" aria-labelledby="program-cim">
          <div className={s.programHead}>
            <h2 id="program-cim" className={s.disp} data-reveal>{program.title}</h2>
            {program.button && general.cta.href && <a className={s.btn} href={general.cta.href} data-cal data-title={general.cta.label || program.button}>{program.button}</a>}
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

        <section className={s.news} id="hirek" aria-labelledby="hirek-cim">
          <div className={s.newsHead}>
            <h2 id="hirek-cim" className={s.disp} data-reveal>{news.title}</h2>
          </div>
          {posts.length ? (
            <>
              <NewsList posts={posts} stores={postStores} allLabel={news.allStores} />
              <Link className={`${s.textlink} ${s.newsAll}`} href={withBase(`${base}/hirek`)}>{news.allLink}</Link>
            </>
          ) : (
            <>
              <p className={s.newsEmpty}>{news.emptyText}</p>
              <p className={s.newsLinks}>{facebookPages.map(st => <a key={st.id} className={s.textlink} href={st.facebook} target="_blank" rel="noopener noreferrer">{st.name} ↗</a>)}</p>
            </>
          )}
        </section>

        <section className={s.stores} id="boltok" aria-labelledby="boltok-cim">
          <h2 id="boltok-cim" className={s.disp} data-reveal>{content.stores.title}</h2>
          {stores.map(st => {
            const week = weekHours(st.hours, now.weekday);
            return (
              <a key={st.id} className={s.row} href={st.maps || '#boltok'} data-map={st.id}>
                <div className={s.rowMain}>
                  <h3>{st.name}</h3>
                  <small>{streetOf(st.address)}{st.where ? `, ${st.where[0].toLowerCase()}${st.where.slice(1)}` : ''}</small>
                </div>
                {week && (
                  <div className={s.hours} data-nyitvatartas>
                    <StoreStatus hours={st.hours} initial={st.status} className={s.hoursNow} />
                    <dl>
                      {week.map(w => <div key={w.day} data-ma={w.today || undefined}><dt>{w.day}{w.today && <em>{content.stores.todayLabel}</em>}</dt><dd>{w.text}</dd></div>)}
                    </dl>
                  </div>
                )}
                {st.photo?.src && <Image src={st.photo.src} alt={st.photo.alt} width={140} height={140} style={{ objectFit: 'cover', objectPosition: st.photo.position }} />}
              </a>
            );
          })}
          <div className={s.booking} id="asztalfoglalas" data-asztalfoglalas>
            <div className={s.bookingSay}>
              <h3 className={s.disp} data-reveal>{content.stores.bookingTitle}</h3>
              {content.stores.bookingText && <p>{content.stores.bookingText}</p>}
              <a className={s.btn} href={TABLE_BOOKING_URL} data-table data-title={content.stores.bookingTitle}>{content.stores.bookingButton}</a>
              <p className={s.bookingOr}>vagy rögtön a bolttal:</p>
              <ul className={s.bookingStores}>
                {stores.map(st => (
                  <li key={st.id}>
                    <a href={`${TABLE_BOOKING_URL}?bolt=${st.id}`} data-table data-title={`${content.stores.bookingTitle} · ${st.name}`}>{st.name}{ARROW}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.bookingScene}><TableTent /></div>
          </div>
        </section>

        {features.items.map((f, i) => {
          const withButton = f.button && f.href;
          return (
            <section key={f.id || i} id={i === 0 ? 'kinalat' : undefined} className={`${s.field} ${FIELD_STYLES[i % FIELD_STYLES.length]} ${i % 2 ? s.mirror : ''} ${withButton ? s.withButton : ''}`} aria-labelledby={`mezo-${i}`}>
              <div className={s.say} data-reveal>
                {f.text && <p>{f.text}</p>}
                {withButton && <a className={s.btn} href={f.href} {...overlayAttrs(f.href, f.button)}>{f.button}</a>}
              </div>
              <h2 id={`mezo-${i}`} className={s.disp} data-reveal>{f.title}</h2>
              {f.id === 'liga' && leagues.length > 0 && <LeagueCards leagues={leagues} />}
              {f.id === 'elorendeles' && preorders.length > 0 && <PreorderCards products={preorders} />}
            </section>
          );
        })}

        {gallery.pictures.length > 0 && (
          <section className={s.prints} id="galeria" aria-labelledby="galeria-cim">
            <h2 id="galeria-cim" className={s.disp} data-reveal>{gallery.title}</h2>
            {gallery.pictures.slice(0, 3).map((g, i) => (
              <figure key={g.id || i} className={s.print} data-reveal>
                <Image src={g.picture.src} alt={g.picture.alt} width={600} height={800} sizes="20vw" style={{ objectPosition: g.picture.position }} />
              </figure>
            ))}
            {gallery.note && <p className={s.printsNote}>{gallery.note}</p>}
            {visibleAlbums(content.albums?.albums).length > 0 && <a className={`${s.textlink} ${s.printsMore}`} href={withBase(`${base}/galeria`)}>Még több kép a Galériában →</a>}
          </section>
        )}

        {slideshow.pictures.length > 0 && <Mosaic title={slideshow.title} pictures={slideshow.pictures} />}

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
            <span>{contact.imprint}{contact.imprint && ' · '}<Link href={withBase('/admin')}>Szerkesztés</Link></span>
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
