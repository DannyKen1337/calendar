# Tavern weboldal – tesztváltozat (/weblapteszt)

A Tavern közös weboldala a naptár alkalmazásán belül fut: taverncalendar.vercel.app/weblapteszt. A forrás a `tavern-web` repó, ide másolva. Az eltérések itt vannak leírva.

## Felépítés

- `app/(naptar)/`: a naptár oldalai a saját gyökér-layoutjukkal (Tailwind, Geist). A címek nem változtak.
- `app/(weblap)/`: a weboldal gyökér-layoutja (saját alapstílus: `weblap/globals.css`). Alatta a `weblapteszt/` mappában a főoldal, a `hirek` és az `admin` van.
- `weblap/components`, `weblap/lib`, `weblap/fooldal.module.css`: a weboldal kódja.

## A főoldal (bemutató változat a tulajoknak)

- **Felépítés (2026-11-17):** a Tavern cégére az egész első képernyőn (beúszik, görgetésre kiúszik), közvetlenül alatta az Előrendelés sáv, utána fentről lefelé: a naptár (heti program, a blokk jobb felső sarkában az arany „A teljes naptár” gomb, `data-teljes-naptar`), Ligák (`#liga`), Asztalfoglalás (`#asztalfoglalas`), Hírek (a kirakott hírek, alattuk a Facebook / Instagram posztok a közösségi oldalak formájában: `components/SocialPost.jsx`, szöveg 6 sor után levágva, 1–4 kép, több képnél „+N”; a több képes posztok minden képét a `lib/social.js` hozza: `attachments` / `children`; amíg nincs behúzott poszt, csak a három bolt Facebook-oldalának linkje; a minta posztok 2026-11-27-én kikerültek), Galéria (három fotó, bal alsó sarokban a nagy „Az összes album” gomb animált átlépéssel: `components/AlbumsLink.jsx`), Itt találsz minket (nyitvatartás és cím: a boltok sorai fotó nélkül, `#boltok`), Írj nekünk (`#kapcsolat`), lábléc.
- **Töltőképernyő:** a régi nagy mondatok (hangulatszövegek) rövidítve a töltőképernyőkre kerültek (`lib/moods.js`). A főoldal első betöltésekor munkamenetenként egyszer 1,6 mp-ig látszik a cégér és egy hangulatszöveg, utána elhalványul (kattintásra / billentyűre rögtön eltűnik; a döntést az `app/(weblap)/layout.js` kis szkriptje hozza még a kirajzolás előtt: `html[data-tolto]`, sessionStorage `tavern-tolto`; JavaScript nélkül nincs). A naptár- és az asztalfoglaló ablak töltése közben is hangulatszöveg látszik, legalább 1,2 mp-ig (`MIN_LOADING_MS`). Az e2e tesztek alapból kihagyják (`page(..., { intro: true })` mutatja). Színek: korom, papírfehér, cégérarany; betűk: Cinzel (címek) és Manrope (szöveg), ugyanazok, mint a naptárban. A terv a `tavern-web` repó taste skilljével készült.
- **Heti program:** a következő hét nap eseményei a naptár nyilvános adataiból (`getUpcomingEvents`), boltonként, játékválasztóval (`components/WeekProgram.jsx`). A listában mindig a játék logója látszik.
- **Naptárablak** (`components/Overlays.jsx`): minden `data-cal` linkre (esemény, a teljes naptár, az előrendelés, a fejléc Naptár gombja) a kattintás helyéről kinyíló aranykörben, ugyanezen az oldalon nyílik meg a naptár. A naptárban magában nincs link a weboldalra.
- **Asztalfoglaló ablak** (ugyanott): az Asztalfoglalás rész gombjainak és a lábléc Asztalfoglalás linkjének (`data-table`) a kattintás helyéről egy arany „FOGLALT” asztali tábla billen fel (`components/TableTent.jsx`), és abból nyílik ki a beépített asztalfoglalás (`/asztalfoglalas?embed=1`, boltonként `?bolt=`).
- **Térképablak** (ugyanott): a boltok soraira (`data-map`) arany útvonal, gombostű, kihajtódó Google-térkép (kulcs nélküli beágyazás, a bolt „Keresés a beágyazott térképen” mezőjével) és útvonaltervezés gomb.
- **Ligák** (`components/LeagueCards.jsx`): a Ligák részben a publikált liga-ranglisták (2–4 liga, `lib/leagueData.js`): liganként játéklogó, név, az első öt (telefonon három) helyezett, és a teljes ranglista linkje (naptárablakban). Liga nélkül egy „A ligák ranglistái” gomb.
- **Előrendelés** (`components/PreorderCards.jsx`): a cégér alatti sávban (finoman beúszik, a helye előre foglalt) az élő (nyitott) előrendelések kis kártyái (legfeljebb 3, telefonon 2, `lib/preorderData.js`), fölöttük lüktető „Élő előrendelés” jelzés, a kártyán ár, megjelenés, kevés darabnál „Utolsó darabok!”; fölöttük mindig „Összes előrendelés” gomb; nyitott előrendelés nélkül egyetlen „Előrendelés” link. Kattintásra a kártya felpattan, holografikus fény söpör végig rajta, a kattintás helyéről aranyszikrák és körhullám indul, utána ugyanonnan nyílik a naptárablak az adott termék előrendelésével (csökkentett mozgásnál rögtön). A főoldal 5 percenként frissül, így egy új liga-kirakás vagy előrendelés legkésőbb ennyi idő múlva látszik.
- **Mozgás** (`components/Motion.jsx`): a `data-reveal` elemek görgetésre beúsznak (csak a betöltéskor képernyőn kívüliek), a cégér kiúszik. Csökkentett mozgásnál semmi nem mozog.
- `public/weblapteszt/`: a weboldal képei.

A két rész között átlépve a böngésző az egész oldalt újratölti, mert két külön gyökér-layoutról van szó.

## Hivatkozások

Minden belső hivatkozás a `withBase()` függvényen megy át (`weblap/lib/basePath.js`). Ez kell a `next/link`-hez, az `<a>`-hoz, a `redirect()`-hez és a képekhez is. A képekhez a `weblap/components/Image.jsx`-et használd: átalakítás nélkül adja ki a képet, és a címe elé teszi a `/weblapteszt`-et.

Mentés után a teljes weboldal a `revalidatePath('/(weblap)/weblapteszt', 'layout')` hívással frissül. A route group is része a cache-címkének, ezért nem elég a `'/weblapteszt'`.

## Szerkeszthető tartalom

A szerkesztőfelület szándékosan egyszerű, három füle van: **Hírek** (saját hírek, a Facebook- és Instagram-posztok elrejtése, kiemelése), **Galéria** (a külön Galéria oldal: eseményenként egy album; egy egész mappa is feltölthető, mappánként egy album, a névből dátummal és játékkal), **Főoldali fotók** (a főoldal Galéria részének 3 fotója; képaláírás nincs). A belső kulcsok: `albums`, `gallery` (a Képfal, `slideshow`, megszűnt). Telefonon a fülek alul vannak.

Az oldal többi tartalma (szövegek, boltok adatai, nyitvatartás, lábléc) a sémában megvan, de a felületen nem szerkeszthető, és a szerver sem menti (`EDITABLE_TABS` a `contentSchema.js`-ben). Ha valamelyiket újra elérhetővé kellene tenni, elég oda felvenni a kulcsát.

- **Felépítés:** a mezőket a `weblap/lib/contentSchema.js` írja le. Ebből rajzolódik ki az űrlap, és a szerver is ez alapján ellenőrzi a mentett adatot.
- **Alapértékek:** az eredeti tartalom a `weblap/lib/content.js`-ben van. Az adatbázisban csak a módosított fülek vannak (`website_content` gyűjtemény, `site` dokumentum).
- **Új mező:** a sémába és az alapértékek közé kell felvenni, és az oldalon is meg kell jeleníteni.
- **Visszaállítás:** minden fül alján van egy „Visszaállítás az eredetire” gomb.

## Előnézet és kirakás

A szerkesztőfelületen semmi nem megy ki azonnal az éles oldalra. Minden mentés (az oldal szövegei és képei, a hírek, a hírek törlése, a Facebook- és Instagram-posztok elrejtése vagy kiemelése) előbb csak az **előnézetben** látszik: `/weblapteszt/elonezet` (és alatta a Hírek oldalak). Ezt csak belépett szerkesztő nyithatja meg, a keresők nem indexelik, és alul egy arany sáv jelzi, hogy még nem az éles oldal.

- **Mi vár kirakásra:** a szerkesztőfelület tetején mindig látszik, emberi nyelven („Nyitókép módosítva”, „Új hír: …”), a módosított fülek mellett pötty.
- **Kirakás:** az előnézet alján lévő sávban, a „Kirakás az éles oldalra” gombbal; bármelyik szerkesztő megteheti, és egy gombbal minden függő módosítás kimegy. Ugyanott az „Elvetés” (az előnézet visszaáll az élesre). A gombok szándékosan csak az előnézetben vannak, hogy kirakás előtt mindenki lássa, mi megy ki. Mindkettő a naplóba kerül. (A korábbi „Weblap jóváhagyó” jog megszűnt; a csoportját és a felhasználóknál maradt kulcsát a `seedDefaultGroups` egyszer törli.)
- **Tárolás:** tartalom: `website_content` „draft” (szerkesztett) és „site” (éles) dokumentum; hírek: `website_posts` és `website_post_flags` a munkapéldány, `website_posts_live` és `website_post_flags_live` az éles másolat (`weblap/lib/staging.js`). Az első induláskor az addigi hírek automatikusan átkerülnek az éles másolatba.

## Belépés és jog

- **Belépés:** a szerkesztőfelület (`/weblapteszt/admin`) a naptár belépését használja, ugyanazt a `tavern_session` sütit. Külön belépés nincs, és a Kilépés a naptárból is kiléptet.
- **Ki szerkeszthet és rakhat ki:** a tulajdonos és a **Weblap mester** jogú szervezők (jogkulcs: `website`; Felhasználók és csoportok). Más weblapjog nincs.
- **„Weboldal” gomb:** csak nekik jelenik meg a naptár admin oldalsávjában.
- **Napló:** a módosítások a naptár naplójába kerülnek, „WEBLAP” művelettel.

## Környezeti változók (a naptár Vercel-projektjében)

A `MONGODB_URI`, a `JWT_SECRET` és az `IMGBB_API_KEY` közös a naptárral. Ezek nem kötelezők:
- `WEBSHOP_URL`: a Freewebstore-webshop címe;
- `META_PAGES`: a három bolt Facebook-oldala, mindegyik a saját oldal-tokenjével (`pages_read_engagement` jog), JSON-ben: `[{"store":"debrecen","id":"…","token":"…"},{"store":"jatekceh",…},{"store":"miskolc",…}]`. A posztok a bolt nevével jelennek meg, boltonként szűrhetők;
- `META_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`: a régi, egyoldalas beállítás (ilyenkor az oldal a debreceni bolté), az Instagramhoz továbbra is ez kell;
- `CALENDAR_URL`: alapból `https://taverncalendar.vercel.app`, innen jön a program.
