# Tavern weboldal – tesztváltozat (/weblapteszt)

A Tavern közös weboldala a naptár alkalmazásán belül fut: taverncalendar.vercel.app/weblapteszt. A forrás a `tavern-web` repó, ide másolva. Az eltérések itt vannak leírva.

## Felépítés

- `app/(naptar)/`: a naptár oldalai a saját gyökér-layoutjukkal (Tailwind, Geist). A címek nem változtak.
- `app/(weblap)/`: a weboldal gyökér-layoutja (saját alapstílus: `weblap/globals.css`). Alatta a `weblapteszt/` mappában a főoldal, a `hirek` és az `admin` van.
- `weblap/components`, `weblap/lib`, `weblap/fooldal.module.css`: a weboldal kódja.

## A főoldal (bemutató változat a tulajoknak)

- **Felépítés:** a Tavern cégére az egész első képernyőn (beúszik, görgetésre kiúszik), utána a heti program a naptárból, a hírek a boltokból, nagy mondatok színes mezőkön, galéria, a boltok sorai, Kapcsolat a boltok Facebook-oldalaival, lábléc. Színek: korom, papírfehér, cégérarany; betűk: Big Shoulders (címek) és Public Sans (szöveg). A terv a `tavern-web` repó taste skilljével készült.
- **Heti program:** a következő hét nap eseményei a naptár nyilvános adataiból (`getUpcomingEvents`), boltonként, játékválasztóval (`components/WeekProgram.jsx`). A listában mindig a játék logója látszik.
- **Naptárablak** (`components/Overlays.jsx`): minden `data-cal` linkre (esemény, a teljes naptár, az előrendelés, a fejléc Naptár gombja) a kattintás helyéről kinyíló aranykörben, ugyanezen az oldalon nyílik meg a naptár. A naptárban magában nincs link a weboldalra.
- **Térképablak** (ugyanott): a boltok soraira (`data-map`) arany útvonal, gombostű, kihajtódó Google-térkép (kulcs nélküli beágyazás, a bolt „Keresés a beágyazott térképen” mezőjével) és útvonaltervezés gomb.
- **Mozgás** (`components/Motion.jsx`): a `data-reveal` elemek görgetésre beúsznak (csak a betöltéskor képernyőn kívüliek), a cégér kiúszik. Csökkentett mozgásnál semmi nem mozog.
- `public/weblapteszt/`: a weboldal képei.

A két rész között átlépve a böngésző az egész oldalt újratölti, mert két külön gyökér-layoutról van szó.

## Hivatkozások

Minden belső hivatkozás a `withBase()` függvényen megy át (`weblap/lib/basePath.js`). Ez kell a `next/link`-hez, az `<a>`-hoz, a `redirect()`-hez és a képekhez is. A képekhez a `weblap/components/Image.jsx`-et használd: átalakítás nélkül adja ki a képet, és a címe elé teszi a `/weblapteszt`-et.

Mentés után a teljes weboldal a `revalidatePath('/(weblap)/weblapteszt', 'layout')` hívással frissül. A route group is része a cache-címkének, ezért nem elég a `'/weblapteszt'`.

## Szerkeszthető tartalom

A weboldal minden szövege, képe, linkje és a boltok adatai (név, cím, nyitvatartás, fotó, Facebook-oldal, térképkeresés) szerkeszthetők. Ezek a szerkesztőfelület fülein vannak: Általános, Nyitókép, Program, Mondatok, Galéria, Hírek rész, Boltok, Kapcsolat és lábléc.

- **Felépítés:** a mezőket a `weblap/lib/contentSchema.js` írja le. Ebből rajzolódik ki az űrlap, és a szerver is ez alapján ellenőrzi a mentett adatot.
- **Alapértékek:** az eredeti tartalom a `weblap/lib/content.js`-ben van. Az adatbázisban csak a módosított fülek vannak (`website_content` gyűjtemény, `site` dokumentum).
- **Új mező:** a sémába és az alapértékek közé kell felvenni, és az oldalon is meg kell jeleníteni.
- **Visszaállítás:** minden fül alján van egy „Visszaállítás az eredetire” gomb.

## Előnézet és jóváhagyás

A szerkesztőfelületen semmi nem megy ki azonnal az éles oldalra. Minden mentés (az oldal szövegei és képei, a hírek, a hírek törlése, a Facebook- és Instagram-posztok elrejtése vagy kiemelése) előbb csak az **előnézetben** látszik: `/weblapteszt/elonezet` (és alatta a Hírek oldalak). Ezt csak belépett szerkesztő nyithatja meg, a keresők nem indexelik, és alul egy arany sáv jelzi, hogy még nem az éles oldal.

- **Mi vár kirakásra:** a szerkesztőfelület tetején mindig látszik, emberi nyelven („Nyitókép módosítva”, „Új hír: …”), a módosított fülek mellett pötty.
- **Jóváhagyás és kirakás:** a tulajdonos és a „Weblap jóváhagyó” jogú szerkesztő (jogkulcs: `websitePublish`) teheti meg; egy gombbal minden függő módosítás kimegy. Ők vethetik el a módosításokat is (az előnézet visszaáll az élesre). Mindkettő a naplóba kerül.
- **Tárolás:** tartalom: `website_content` „draft” (szerkesztett) és „site” (éles) dokumentum; hírek: `website_posts` és `website_post_flags` a munkapéldány, `website_posts_live` és `website_post_flags_live` az éles másolat (`weblap/lib/staging.js`). Az első induláskor az addigi hírek automatikusan átkerülnek az éles másolatba.

## Belépés és jog

- **Belépés:** a szerkesztőfelület (`/weblapteszt/admin`) a naptár belépését használja, ugyanazt a `tavern_session` sütit. Külön belépés nincs, és a Kilépés a naptárból is kiléptet.
- **Ki szerkeszthet:** a tulajdonos és a **Weblap mester** jogú szervezők (jogkulcs: `website`; Felhasználók és csoportok).
- **„Weboldal” gomb:** csak nekik jelenik meg a naptár admin oldalsávjában.
- **Napló:** a módosítások a naptár naplójába kerülnek, „WEBLAP” művelettel.

## Környezeti változók (a naptár Vercel-projektjében)

A `MONGODB_URI`, a `JWT_SECRET` és az `IMGBB_API_KEY` közös a naptárral. Ezek nem kötelezők:
- `WEBSHOP_URL`: a Freewebstore-webshop címe;
- `META_PAGES`: a három bolt Facebook-oldala, mindegyik a saját oldal-tokenjével (`pages_read_engagement` jog), JSON-ben: `[{"store":"debrecen","id":"…","token":"…"},{"store":"jatekceh",…},{"store":"miskolc",…}]`. A posztok a bolt nevével jelennek meg, boltonként szűrhetők;
- `META_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`: a régi, egyoldalas beállítás (ilyenkor az oldal a debreceni bolté), az Instagramhoz továbbra is ez kell;
- `CALENDAR_URL`: alapból `https://taverncalendar.vercel.app`, innen jön a program.
