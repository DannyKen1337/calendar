import Link from 'next/link';
import Image from '@/weblap/components/Image';
import { cinzel, manrope } from '@/weblap/lib/fonts';
import HomeMotion from '@/weblap/components/HomeMotion';
import SiteNav from '@/weblap/components/SiteNav';
import FeatureMenu from '@/weblap/components/FeatureMenu';
import StoreStatus from '@/weblap/components/StoreStatus';
import DayProgram from '@/weblap/components/DayProgram';
import PostCard from '@/weblap/components/PostCard';
import { getHomeData } from '@/weblap/lib/home';
import { getFeed } from '@/weblap/lib/posts';
import { formatDay, dayOf, timeOf, weekdayOf, DAY_NAMES, eventUrl, CALENDAR_URL, LEAGUES_URL, PREORDER_URL } from '@/weblap/lib/calendar';
import { compactHours } from '@/weblap/lib/stores';
import { FB, IG, MESSENGER, WEBSHOP_URL, SECTIONS } from '@/weblap/lib/site';
import s from '@/weblap/home.module.css';
import { withBase } from '@/weblap/lib/basePath';

export const metadata = {
  title: 'Tavern – kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon',
  description: 'Tavern Debrecen, JátékCéh és Tavern Miskolc: versenyek minden héten, ligák, előrendelés, webshop és hírek a boltokból.',
};

// Sötét oldal: a böngésző sávja, görgetősávja és az oldal szélén túlgörgetés is a cégér feketéje
export const viewport = { themeColor: '#111111', colorScheme: 'dark' };

// A program, a nyitvatartás és a hírek 5 percenként frissülnek (a szerkesztőfelület mentéskor azonnal frissíti)
export const revalidate = 300;

// Az oldal egy kocsma nyomtatványkészlete: elöl a cégér egy kártyán a félhomályos szoba előtt, utána
// a kínálat étlapként, a hét műsora napfülekkel, a boltok névjegye a saját fotójukon, a hírek
// cédulás fotókként, a végén a kártya hátoldala. Mozgás: components/HomeMotion.jsx.
export default async function Home() {
  const [{ stores, week }, posts] = await Promise.all([getHomeData(), getFeed(8)]);
  const weekCount = week.reduce((n, d) => n + stores.reduce((m, st) => m + d.events[st.id].length, 0), 0);

  // A kínálat étlapként: két csoport, tételenként egy rövid érték és egy fotó
  const menu = [
    {
      name: 'A boltokban',
      items: [
        { id: 'boltok', name: 'Három bolt', value: 'Debrecen, Miskolc', href: '#boltok',
          text: 'Kettő Debrecen belvárosában, egy Miskolcon. Mindhárom klub is: asztal mindig akad.',
          picture: { src: '/photos/klub-asztal.png', alt: 'Két játékos egy kártyameccs közben a klub egyik asztalánál', position: '50% 45%' } },
        { id: 'versenyek', name: 'Versenyek', value: weekCount ? `${weekCount} a héten` : 'Minden héten', href: '#program',
          text: 'Pokémon, One Piece, Riftbound, Magic, Warhammer és még sok más. Pénteken 17:00-kor Nexus Night.',
          picture: { src: '/photos/nexus-night-plakat.png', alt: 'Nexus Night BO1+ plakát: péntek 17:00, Tavern', position: '22% 50%' } },
        { id: 'ligak', name: 'Ligák', value: 'Ranglista ↗', href: LEAGUES_URL, external: true,
          text: 'Pontok alkalomról alkalomra, ranglista szezononként.',
          picture: { src: '/photos/verseny.png', alt: 'Verseny a Tavern Debrecenben: teli asztalok, játékosok a kártyáik fölött', position: '50% 80%' } },
      ],
    },
    {
      name: 'Otthonról',
      items: [
        { id: 'elorendeles', name: 'Előrendelés', value: 'Foglalás ↗', href: PREORDER_URL, external: true,
          text: 'Foglald le az új kiadásokat a megjelenés előtt, és vedd át a boltban.',
          picture: { src: '/photos/pokemon-30.png', alt: 'Pokémon 30th Celebration dobozok és csomagok a pulton', position: '50% 55%' } },
        { id: 'webshop', name: 'Webshop', value: WEBSHOP_URL ? 'Megnyitom ↗' : 'Hamarosan', href: WEBSHOP_URL || '#kapcsolat', external: !!WEBSHOP_URL,
          text: 'Kártyák, társasok és kiegészítők online, ha épp nem tudsz beugrani.',
          picture: { src: '/rajz/webshop.jpg', alt: 'Rajz: nyitott csomag kártyacsomagokkal, mellette dobókockák', position: '50% 50%' } },
      ],
    },
  ];

  return (
    <HomeMotion className={`${cinzel.variable} ${manrope.variable} ${s.page}`}>
      <SiteNav s={s} links={SECTIONS} extra={WEBSHOP_URL ? [{ href: WEBSHOP_URL, label: 'Webshop ↗' }] : []} cta={{ href: CALENDAR_URL, label: 'Naptár' }} />

      {/* Nyitóképernyő: a cégér egy kártyán, mögötte egy régi kocsmai kártyázás félhomályban */}
      <section className={s.hero} aria-labelledby="fooldal-cim" data-hero>
        <div className={s.heroBg} data-hero-bg>
          <Image src="/images/teniers-card-players.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: '50% 40%' }} />
        </div>
        <div className={s.heroCard} data-hero-card>
          <h1 id="fooldal-cim" className={s.heroTitle}>
            <span className={s.heroSign} data-hero-sign>
              <Image src="/brand/tavern-sign.png" alt="Tavern" width={1100} height={296} priority sizes="(max-width: 900px) 90vw, 50vw" />
            </span>
            <span className={s.heroWords}>
              {['Kártya', 'Társas', 'Wargame'].map(w => <span key={w} className={s.heroWord}><span data-hero-word>{w}</span>{' '}</span>)}
            </span>
          </h1>
          <div className={s.heroFacts}>
            <p data-hero-rise>Klub és bolt Debrecenben és Miskolcon:</p>
            <ul data-hero-rise>
              {stores.map(st => <li key={st.id}><b>{st.name}</b> · {st.address.replace(/^(Debrecen|Miskolc), /, '').replace(/ - .*| ?, \d{4}$/, '')}</li>)}
            </ul>
            <p className={s.heroLine} data-hero-rise>Gyere, ülj le hozzánk egy körre.</p>
          </div>
          <div className={s.heroFoot} data-hero-rise>
            <span className={s.heroCredit}>Teniers: Kártyázók, 1646</span>
            <a className={s.btn} href="#program">A heti program</a>
            <a className={s.heroLink} href={CALENDAR_URL}>Naptár ↗</a>
          </div>
        </div>
      </section>

      <main>
        {/* A kínálat: kocsmai étlap, mellette a kiválasztott tétel fotója */}
        <section className={s.section} id="kinalat" aria-labelledby="lapok-cim">
          <FeatureMenu s={s} title="Amiért betérhetsz" groups={menu} />
        </section>

        {/* A hét műsora */}
        <section className={s.section} id="program" aria-labelledby="program-title">
          <div className={s.agendaHead}>
            <h2 id="program-title" className={s.h2} data-heading><span className={s.soft}>Ezen a héten</span> három bolt műsora</h2>
            <a className={s.btn} href={CALENDAR_URL}>Jelentkezés a naptárban</a>
          </div>
          <DayProgram week={week} stores={stores} s={s} />
        </section>

        {/* A boltok: mindegyik a saját fotóján, rajta a névjegye */}
        <div id="boltok" className={s.visits}>
          {stores.map((st, i) => (
            <section key={st.id} id={`bolt-${st.id}`} className={`${s.visit} ${i % 2 ? s.visitLeft : ''}`} aria-labelledby={`bolt-${st.id}-nev`} data-visit>
              <figure className={s.visitPicture} data-visit-picture>
                <Image src={st.photo.src} alt={st.photo.alt} fill sizes="100vw" style={{ objectFit: 'cover', objectPosition: st.photo.position }} />
                {st.photo.archive && <figcaption className={s.visitCaption}>A Kossuth utca egy régi fotón, a Piac utca felé nézve</figcaption>}
              </figure>
              <div className={s.visitCard} data-visit-card>
                <h2 id={`bolt-${st.id}-nev`} className={s.visitName}>{st.name}</h2>
                <p className={s.visitStatus} data-visit-rise><StoreStatus storeId={st.id} initial={st.status} dotOpen="#2f8a4f" dotClosed="#8a8079" /></p>
                <p className={s.visitAddress} data-visit-rise>{st.address}<span>{st.where}</span></p>
                {st.hours && (
                  <dl className={s.visitHours} data-visit-rise>
                    {compactHours(st.hours).map(([days, time]) => <div key={days}><dt>{days}</dt><dd>{time}</dd></div>)}
                  </dl>
                )}
                <div className={s.visitNext} data-visit-rise>
                  <h3>Következő események</h3>
                  <ul>
                    {st.upcoming.slice(0, 3).map(e => (
                      <li key={e._id}><span>{formatDay(dayOf(e.date))} {DAY_NAMES[weekdayOf(dayOf(e.date))].toLowerCase()} {timeOf(e.date)}</span><a href={eventUrl(e)}>{e.name}</a></li>
                    ))}
                    {!st.upcoming.length && <li><span>Most nincs meghirdetett esemény.</span></li>}
                  </ul>
                </div>
                <a className={s.visitButton} href={st.maps}>Útvonaltervezés</a>
              </div>
            </section>
          ))}
        </div>

        {/* Hírek: cédulás fotók */}
        <section className={s.section} id="hirek" aria-labelledby="news-title">
          <div className={s.newsHead}>
            <h2 id="news-title" className={s.h2} data-heading>Hírek a boltokból</h2>
            {posts.length > 0 && <Link className={s.textlink} href={withBase('/hirek')}>Összes hír</Link>}
          </div>
          {posts.length ? (
            <div className={s.posts} data-tiles>
              {posts.map(p => <PostCard key={p.key} post={p} s={s} />)}
            </div>
          ) : (
            <div className={s.newsEmpty} data-tiles>
              <figure className={s.newsEmptyPicture} data-tile data-tile-picture>
                <Image src="/photos/csapat.png" alt="A Tavern csapata egy rendezvényen" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'cover', objectPosition: '50% 35%' }} />
              </figure>
              <div className={s.newsEmptyText} data-tile>
                <p>Új kiadások, versenyeredmények, programok. Hamarosan itt is olvashatod őket, addig a Facebookon és az Instagramon posztoljuk.</p>
                <p className={s.newsLinks}><a className={s.textlink} href={FB}>Facebook ↗</a><a className={s.textlink} href={IG}>Instagram ↗</a></p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* A kártya hátoldala */}
      <footer className={s.footer} id="kapcsolat">
        <div className={s.back} data-back>
          <svg className={s.scallops} aria-hidden="true" focusable="false">
            <defs><pattern id="hullam" width="64" height="20" patternUnits="userSpaceOnUse"><circle cx="32" cy="20" r="20" /></pattern></defs>
            <rect width="100%" height="20" fill="url(#hullam)" />
          </svg>
          <figure className={s.stamp} data-stamp>
            <Image src="/photos/pakli-bontas.png" alt="Pakli-bontás a boltban" width={88} height={117} style={{ objectFit: 'cover' }} />
          </figure>
          <div className={s.backMessage}>
            <p className={s.backTitle}>Várunk egy körre.</p>
            <p>Írj nekünk Messengeren, ha kérdésed van egy versenyről, egy előrendelésről vagy egy termékről, vagy gyere be bármelyik boltba.</p>
            <a className={s.btnDark} href={MESSENGER}>Írj nekünk</a>
          </div>
          <div className={s.backAddress}>
            {stores.map(st => <a key={st.id} href={st.maps}><b>{st.name}</b>{st.address}</a>)}
            <p className={s.backLinks}>
              <a href={CALENDAR_URL}>Naptár</a><a href={LEAGUES_URL}>Ligák</a><a href={PREORDER_URL}>Előrendelés</a>
              {WEBSHOP_URL && <a href={WEBSHOP_URL}>Webshop</a>}<a href={FB}>Facebook</a><a href={IG}>Instagram</a>
            </p>
          </div>
          <p className={s.imprint}>
            © Tavern · Where games become legends · Festmény: David Teniers, Kártyázók (1646), CC0 · Kossuth utca: Fortepan / UVATERV, CC BY-SA 3.0 · <Link href={withBase('/admin')}>Szerkesztés</Link>
          </p>
        </div>
        <Image src="/brand/tavern-sign.png" alt="Tavern" width={1100} height={296} className={s.footSign} />
      </footer>
    </HomeMotion>
  );
}
