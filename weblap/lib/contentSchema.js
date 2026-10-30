// A weboldal szerkeszthető tartalmának szerkezete. Ebből épül fel a szerkesztőfelület (admin) űrlapja, és ez
// alapján ellenőrzi a szerver a mentett adatot (sanitizeField). Az alapértékek a weboldal eredeti tartalma
// (weblap/lib/content.js); ami nincs elmentve, az onnan jön.
//
// Mezőtípusok: text (egysoros), textarea, url, bool, image ({ src, alt, position }), src (csak kép-cím),
// hours (heti nyitvatartás), strings (rövid szövegek listája), object (mezők csoportja), list (ismétlődő elemek).

const text = (label, o = {}) => ({ type: 'text', label, max: 200, ...o });
const area = (label, o = {}) => ({ type: 'textarea', label, max: 2000, rows: 4, ...o });
const url = (label, o = {}) => ({ type: 'url', label, ...o });
const image = (label, o = {}) => ({ type: 'image', label, ...o });
const hours = (label, o = {}) => ({ type: 'hours', label, ...o });
const strings = (label, o = {}) => ({ type: 'strings', label, max: 6, itemMax: 40, ...o });
const object = (label, fields, o = {}) => ({ type: 'object', label, fields, ...o });
const list = (label, item, o = {}) => ({ type: 'list', label, item, max: 12, ...o });

// A boltok azonosítója a naptárban (az események "store" mezője); a weboldalon ebben a sorrendben jelennek meg
export const STORE_IDS = ['debrecen', 'jatekceh', 'miskolc'];
const STORE_LABELS = { debrecen: 'Tavern Debrecen', jatekceh: 'JátékCéh', miskolc: 'Tavern Miskolc' };

const storeFields = (id) => object(STORE_LABELS[id], {
  name: text('Név', { max: 60 }),
  address: text('Cím', { help: 'A nyitóképen a város és az irányítószám nélkül látszik.' }),
  where: text('Merre van (a cím alatt)'),
  maps: url('Útvonaltervezés linkje', { help: 'Google Térkép link.' }),
  hours: hours('Nyitvatartás', { help: 'Ez csak a weboldalon látszik. A naptár eseményeinél ellenőrzött nyitvatartás külön van.' }),
  photo: image('Fotó'),
  caption: text('Képaláírás (nem kötelező)'),
}, { collapsible: true });

export const CONTENT_TABS = [
  {
    key: 'general', label: 'Általános',
    intro: 'A böngészőfül címe, a Google-leírás, a cégér, a közösségi oldalak és a fejléc gombjai.',
    schema: object(null, {
      title: text('Az oldal címe (böngészőfül, Google)', { max: 120 }),
      description: area('Rövid leírás (a Google-találat alatt)', { max: 300, rows: 3 }),
      logo: image('Cégér (a fejlécben, a nyitóképen és a láblécben)', { noPosition: true }),
      facebook: url('Facebook-oldal'),
      instagram: url('Instagram-fiók'),
      webshop: url('Webshop', { help: 'Ha meg van adva, a fejlécben megjelenik a „Webshop ↗” gomb.' }),
      nav: object('A fejléc gyorsgombjai', {
        kinalat: text('Kínálat', { max: 30 }),
        program: text('Program', { max: 30 }),
        boltok: text('Boltok', { max: 30 }),
        hirek: text('Hírek', { max: 30 }),
        kapcsolat: text('Kapcsolat', { max: 30 }),
      }),
      cta: object('A fejléc kiemelt gombja (jobbra fent)', {
        label: text('Felirat', { max: 30 }),
        href: url('Link'),
      }),
    }),
  },
  {
    key: 'hero', label: 'Nyitókép',
    intro: 'Az oldal teteje: a háttérkép és a cégér alatti kártya szövegei. A boltok listája a Boltok fülről jön.',
    schema: object(null, {
      picture: image('Háttérkép', { help: 'Kattints a képre: oda kerül a kép közepe.' }),
      words: strings('Szavak a cégér alatt', { max: 4, itemMax: 20 }),
      intro: text('Bevezető sor (a boltok listája előtt)'),
      tagline: text('Zárómondat'),
      credit: text('Képaláírás (bal alsó sarok)'),
      button: text('Gomb felirata (a heti programhoz ugrik)', { max: 40 }),
      calendarLink: text('Naptár link felirata (jobb alsó sarok)', { max: 40, help: 'A link a fejléc kiemelt gombjáéval egyezik (Általános fül).' }),
    }),
  },
  {
    key: 'menu', label: 'Kínálat',
    intro: 'Az „étlap”: csoportok és tételek, mindegyikhez egy fotó, ami rámutatáskor nagyban látszik.',
    schema: object(null, {
      title: text('Cím', { max: 60 }),
      groups: list('Csoportok', object(null, {
        name: text('A csoport neve', { max: 40 }),
        items: list('Tételek', object(null, {
          name: text('Név', { max: 40 }),
          value: text('Jobb oldali érték', { max: 40, help: 'A {heti} helyére a heti versenyek száma kerül („12 a héten”, vagy „Minden héten”).' }),
          text: area('Leírás', { max: 300, rows: 2 }),
          href: url('Link', { help: '#boltok, #program, #hirek, #kapcsolat: ugrás az oldalon belül; vagy egy teljes cím.' }),
          picture: image('Fotó'),
        }), { itemLabel: 'tétel', titleKey: 'name', max: 8, collapsible: true }),
      }), { itemLabel: 'csoport', titleKey: 'name', max: 4 }),
    }),
  },
  {
    key: 'program', label: 'Program',
    intro: 'A heti program címe és gombja. Az eseményeket és a játékok képeit a naptárból veszi.',
    schema: object(null, {
      soft: text('A cím halvány eleje', { max: 40 }),
      title: text('A cím folytatása', { max: 60 }),
      button: text('Gomb felirata', { max: 40 }),
      buttonHref: url('Gomb linkje'),
    }),
  },
  {
    key: 'stores', label: 'Boltok',
    intro: 'A három bolt adatai: ezek látszanak a nyitóképen, a boltok névjegyén, a programban és a láblécben.',
    schema: object(null, {
      ...Object.fromEntries(STORE_IDS.map(id => [id, storeFields(id)])),
      nextTitle: text('„Következő események” cím', { max: 40 }),
      noEvents: text('Szöveg, ha nincs esemény'),
      routeButton: text('Útvonaltervezés gomb felirata', { max: 40 }),
    }),
  },
  {
    key: 'news', label: 'Hírek rész',
    intro: 'A hírek szakasz szövegei a főoldalon és a Hírek oldalon. Magukat a híreket a Hírek fülön írod.',
    schema: object(null, {
      title: text('Cím a főoldalon', { max: 60 }),
      allLink: text('„Összes hír” link felirata', { max: 40 }),
      emptyText: area('Szöveg, amíg nincs hír', { max: 500, rows: 3 }),
      emptyPicture: image('Kép, amíg nincs hír'),
      pageTitle: text('A Hírek oldal címe', { max: 60 }),
      pageLead: area('A Hírek oldal bevezetője', { max: 400, rows: 2 }),
      pageEmpty: area('A Hírek oldal szövege, amíg nincs hír', { max: 400, rows: 2 }),
    }),
  },
  {
    key: 'contact', label: 'Lábléc',
    intro: 'Az oldal alja (Kapcsolat): üzenet, gomb, linkek és az apró betűs sor.',
    schema: object(null, {
      stamp: image('Bélyegkép'),
      title: text('Cím', { max: 60 }),
      text: area('Szöveg', { max: 600, rows: 3 }),
      button: object('Gomb', { label: text('Felirat', { max: 40 }), href: url('Link', { help: 'Pl. Messenger: https://m.me/…' }) }),
      links: list('Linkek', object(null, { label: text('Felirat', { max: 40 }), href: url('Link') }), { itemLabel: 'link', titleKey: 'label', max: 12, inline: true }),
      imprint: area('Apró betűs sor (a „Szerkesztés” link elé)', { max: 400, rows: 2 }),
    }),
  },
];

export const TAB_KEYS = CONTENT_TABS.map(t => t.key);
export const tabByKey = (key) => CONTENT_TABS.find(t => t.key === key);

// Egy új (üres) érték a mező típusához (új listaelemhez)
export function emptyValue(f) {
  switch (f.type) {
    case 'image': return { src: '', alt: '', position: '50% 50%' };
    case 'hours': return { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    case 'strings': case 'list': return [];
    case 'bool': return false;
    case 'object': return Object.fromEntries(Object.entries(f.fields).map(([k, sub]) => [k, emptyValue(sub)]));
    default: return '';
  }
}

// --- Ellenőrzés (szerveroldalon mentéskor és betöltéskor) ---

const LINK_RE = /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:\+?[\d\s()-]+|#[\w-]*|\/[^\s<>"]*)$/i;
const IMAGE_RE = /^(https?:\/\/[^\s<>"]+|\/[\w./-]+)$/i;
const POSITION_RE = /^(\d{1,3})% (\d{1,3})%$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const multiLine = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const newId = () => Math.random().toString(36).slice(2, 10);

// value: a beküldött vagy elmentett érték; fallback: az alapérték (hiányzó vagy hibás adatnál ez marad);
// errors: ha meg van adva, ide kerülnek a hibák (mentéskor), path: a mező neve a hibaüzenethez
export function sanitizeField(f, value, fallback, errors, path = f.label || '') {
  const fail = (msg) => { errors?.push(`${path}: ${msg}`); return fallback; };
  switch (f.type) {
    case 'text': return value == null ? fallback : oneLine(value, f.max);
    case 'textarea': return value == null ? fallback : multiLine(value, f.max);
    case 'bool': return value == null ? fallback : !!value;
    case 'url': {
      if (value == null) return fallback;
      const v = String(value).trim();
      if (!v) return '';
      if (v.length > 500 || !LINK_RE.test(v) || /^\s*javascript:/i.test(v)) return fail('hibás link (https://…, #rész, /útvonal, mailto: vagy tel:)');
      return v;
    }
    case 'src': {
      if (value == null) return fallback;
      const v = String(value).trim();
      if (!v) return fallback;
      if (v.length > 500 || !IMAGE_RE.test(v) || v.includes('..')) return fail('hibás kép-cím');
      return v;
    }
    case 'image': {
      if (!value || typeof value !== 'object') return fallback;
      const srcValue = String(value.src ?? '').trim();
      if (!srcValue) return fail('nincs kép megadva');
      if (srcValue.length > 500 || !IMAGE_RE.test(srcValue) || srcValue.includes('..')) return fail('hibás kép-cím');
      const m = String(value.position ?? '').match(POSITION_RE);
      const position = m && +m[1] <= 100 && +m[2] <= 100 ? `${+m[1]}% ${+m[2]}%` : (fallback?.position || '50% 50%');
      return { src: srcValue, alt: oneLine(value.alt, 300), position };
    }
    case 'hours': {
      if (!value || typeof value !== 'object') return fallback;
      const out = {};
      for (let d = 0; d <= 6; d++) {
        const h = value[d];
        if (!Array.isArray(h)) { out[d] = null; continue; }
        const [o, c] = h.map(x => String(x || ''));
        if (!TIME_RE.test(o) || !TIME_RE.test(c) || o >= c) { errors?.push(`${path}: hibás nyitvatartás (${['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'][d]})`); out[d] = fallback?.[d] ?? null; continue; }
        out[d] = [o, c];
      }
      return out;
    }
    case 'strings': {
      if (!Array.isArray(value)) return fallback;
      return value.map(v => oneLine(v, f.itemMax)).filter(Boolean).slice(0, f.max);
    }
    case 'object': {
      const src = value && typeof value === 'object' ? value : {};
      const base = fallback && typeof fallback === 'object' ? fallback : {};
      const out = {};
      for (const [k, sub] of Object.entries(f.fields)) {
        const subPath = [path, sub.label].filter(Boolean).join(' › ');
        out[k] = sanitizeField(sub, src[k], base[k] ?? emptyValue(sub), errors, subPath);
      }
      if (typeof src.id === 'string' && /^[\w-]{1,40}$/.test(src.id)) out.id = src.id;
      return out;
    }
    case 'list': {
      if (!Array.isArray(value)) return fallback;
      if (value.length > f.max) errors?.push(`${path}: legfeljebb ${f.max} ${f.itemLabel} lehet`);
      return value.slice(0, f.max).map((item, i) => {
        // Az új elemek az üres értékből indulnak (nem a lista első alapelemétől örökölnek)
        const out = sanitizeField(f.item, item, emptyValue(f.item), errors, `${path} ${i + 1}.`);
        if (!out.id) out.id = newId();
        return out;
      });
    }
    default: return fallback;
  }
}
