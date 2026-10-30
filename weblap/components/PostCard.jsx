import { SOURCE_NAMES, postHeading, postExcerpt, postHref, postDate } from '@/weblap/lib/posts';
import { withBase } from '@/weblap/lib/basePath';

// Egy hír csempéje (főoldal és a Hírek oldal): fölül a kép, alatta hozzátapadó címkecsík, mint egy fotó a cédulájával.
// A behúzott posztok az eredeti posztra visznek, a kirakott hírek a saját oldalukra. Kép nélküli hírnél a csík a kép helyén nagyobb.
// s: a CSS-modul (post, postPicture, postStrip, postMeta, postSource, postTitle, postText, postPinned, postTextOnly)
export default function PostCard({ post: p, s }) {
  const external = p.source !== 'manual';
  const heading = postHeading(p) || `${SOURCE_NAMES[p.source]}-poszt`;
  const excerpt = p.image ? null : postExcerpt(p, 180);
  return (
    <article className={`${s.post} ${p.image ? '' : s.postTextOnly}`} data-tile>
      {p.image && (
        <span className={s.postPicture} data-tile-picture>
          {/* Külső képek (Facebook, Instagram, ImgBB): méretük ismeretlen, ezért sima img, levágva */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        </span>
      )}
      <div className={s.postStrip}>
        <p className={s.postMeta}>
          <span className={s.postSource}>{SOURCE_NAMES[p.source]}{p.pinned && <span className={s.postPinned}> · Kiemelt</span>}</span>
          <time dateTime={p.date}>{postDate(p.date)}</time>
        </p>
        {/* A cím linkje az egész csempét lefedi (CSS: ::after) */}
        <h3 className={s.postTitle}>
          <a href={withBase(postHref(p))} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{heading}</a>
        </h3>
        {excerpt && <p className={s.postText}>{excerpt}</p>}
      </div>
    </article>
  );
}
