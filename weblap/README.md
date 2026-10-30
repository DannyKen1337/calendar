# Tavern weboldal – tesztváltozat (/weblapteszt)

A Tavern közös weboldala a naptár alkalmazásán belül fut: taverncalendar.vercel.app/weblapteszt. A forrás a `tavern-web` repó, ide másolva. Az eltérések itt vannak leírva.

## Felépítés

- `app/(naptar)/`: a naptár oldalai a saját gyökér-layoutjukkal (Tailwind, Geist). A címek nem változtak.
- `app/(weblap)/`: a weboldal gyökér-layoutja (saját alapstílus: `weblap/globals.css`). Alatta a `weblapteszt/` mappában a főoldal, a `hirek` és az `admin` van.
- `weblap/components`, `weblap/lib`, `weblap/home.module.css`: a weboldal kódja.
- `public/weblapteszt/`: a weboldal képei.

A két rész között átlépve a böngésző az egész oldalt újratölti, mert két külön gyökér-layoutról van szó.

## Hivatkozások

Minden belső hivatkozás a `withBase()` függvényen megy át (`weblap/lib/basePath.js`). Ez kell a `next/link`-hez, az `<a>`-hoz, a `redirect()`-hez és a képekhez is. A képekhez a `weblap/components/Image.jsx`-et használd: átalakítás nélkül adja ki a képet, és a címe elé teszi a `/weblapteszt`-et.

Mentés után a teljes weboldal a `revalidatePath('/(weblap)/weblapteszt', 'layout')` hívással frissül. A route group is része a cache-címkének, ezért nem elég a `'/weblapteszt'`.

## Belépés és jog

- **Belépés:** a szerkesztőfelület (`/weblapteszt/admin`) a naptár belépését használja, ugyanazt a `tavern_session` sütit. Külön belépés nincs, és a Kilépés a naptárból is kiléptet.
- **Ki szerkeszthet:** a tulajdonos és a **Weblap mester** jogú szervezők (jogkulcs: `website`; Felhasználók és csoportok).
- **„Weboldal” gomb:** csak nekik jelenik meg a naptár admin oldalsávjában.
- **Napló:** a módosítások a naptár naplójába kerülnek, „WEBLAP” művelettel.

## Környezeti változók (a naptár Vercel-projektjében)

A `MONGODB_URI`, a `JWT_SECRET` és az `IMGBB_API_KEY` közös a naptárral. Ezek nem kötelezők:
- `WEBSHOP_URL`: a Freewebstore-webshop címe;
- `META_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`: a Facebook- és Instagram-posztok behúzása;
- `CALENDAR_URL`: alapból `https://taverncalendar.vercel.app`, innen jön a program.
