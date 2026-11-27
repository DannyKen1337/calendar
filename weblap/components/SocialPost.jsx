import { postDate } from '@/weblap/lib/posts';
import s from '@/weblap/fooldal.module.css';

// Egy Facebookról / Instagramról behúzott poszt a főoldal Hírek részében, a közösségi oldalak megszokott formájában:
// fejléc (bolt, forrás, dátum), a szöveg (hosszúnál 6 sor után levágva, „Tovább” az eredeti posztra), és a képek
// (1 kép nagyban; 2: két oszlop; 3: egy nagy és kettő; 4 vagy több: 2 × 2, az utolsón „+N”).
// post: { key, source, who, date, text, images, url, sample }
const ICONS = {
  facebook: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" /></svg>,
  instagram: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" /></svg>,
};
const NAMES = { facebook: 'Facebook', instagram: 'Instagram' };

export default function SocialPost({ post: p }) {
  const images = (p.images?.length ? p.images : p.image ? [p.image] : []).slice(0, 10);
  const shown = images.slice(0, 4);
  const more = images.length - shown.length;
  const long = p.text.length > 260 || p.text.split('\n').filter(Boolean).length > 4;
  const Wrap = p.url ? 'a' : 'div';
  const link = p.url ? { href: p.url, target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <article className={s.social} data-poszt={p.source} data-kepek={images.length}>
      <header className={s.socialHead}>
        <span className={s.socialAvatar} aria-hidden="true">{(p.who || 'T').replace(/^Tavern /, '')[0]}</span>
        <span className={s.socialWho}>
          <b>{p.who}</b>
          <small><span className={s.socialIcon}>{ICONS[p.source]}</span>{NAMES[p.source]} · <time dateTime={p.date}>{postDate(p.date)}</time></small>
        </span>
      </header>
      {p.text && <p className={`${s.socialText} ${long ? s.socialLong : ''}`}>{p.text}</p>}
      {long && <Wrap className={s.socialMore} {...link}>Tovább</Wrap>}
      {shown.length > 0 && (
        <div className={s.socialPics} data-db={shown.length}>
          {shown.map((src, i) => (
            <span key={i} className={s.socialPic}>
              {/* Külső képek (Facebook, Instagram): méretük ismeretlen, ezért sima img, levágva */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              {i === shown.length - 1 && more > 0 && <b className={s.socialPlus}>+{more}</b>}
            </span>
          ))}
        </div>
      )}
      <Wrap className={s.socialGo} {...link}>Megnézem: {NAMES[p.source]} ↗</Wrap>
    </article>
  );
}
