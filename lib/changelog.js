// Újdonságok az admin felülethez. Nagyobb frissítésnél ide kell egy új bejegyzést tenni a lista ELEJÉRE:
// az adminok a következő belépéskor egy felugró ablakban látják (felhasználónként egyszer, az adatbázisban jegyezzük).
// id: egyedi, időrendben növekvő azonosító (dátum); ownerOnly: csak a tulajdonos (Admin2) látja az adott pontot.

export const CHANGELOG = [
  {
    id: '2026-10-09-3',
    date: '2026. október 9.',
    title: 'Nyitvatartás figyelése',
    items: [
      {
        icon: '🕒',
        title: 'Figyelmeztetés nyitvatartáson kívüli időpontra',
        text: 'Az esemény űrlap és a generátor szól, ha egy esemény nyitás előtt vagy a nyitás utáni fél órán belül kezdődne, illetve ha a bolt aznap zárva van vagy már bezárt. A mentés így is lehetséges, csak megerősítést kér. Egyelőre Debrecen és a JátékCéh nyitvatartását figyeli.',
      },
    ],
  },
  {
    id: '2026-10-09-2',
    date: '2026. október 9.',
    title: 'Statisztika, mobilos check-in és kényelmi funkciók',
    items: [
      {
        icon: '📊',
        title: 'Statisztika oldal',
        text: 'Az oldalsáv „Statisztika” gombjával megnézhetitek a check-in adatokat: a megjelenési arányt, a havi részvételt, a játékonkénti bontást és a legaktívabb játékosokat. Mindenki csak az általa kezelt játékok adatait látja.',
      },
      {
        icon: '📱',
        title: 'Mobilos check-in',
        text: 'Az oldalsáv „Check-in” gombjával vagy az eseménykártya telefon ikonjával telefonra szabott nézet nyílik: nagy gombok, névkeresés és szűrés a még nem jelölt játékosokra. A helyszínen jelentkezőket is fel lehet itt venni.',
      },
      {
        icon: '🧙',
        title: 'Általam tartott események',
        text: 'Az oldalsáv „Általam tartott” gombjával csak azokat az eseményeket látjátok, amelyeknél ti vagytok a szervezők. A kereső a szervezők nevére is talál.',
      },
      {
        icon: '⚠️',
        title: 'Ütközés figyelmeztetés',
        text: 'Ha egy szervező ugyanabban az időben két eseményt is tartana, az űrlap jelzi, és mentés előtt rákérdez.',
      },
      {
        icon: '📋',
        title: 'Esemény másolása',
        text: 'Az eseménykártya másolás gombjával ugyanazokkal az adatokkal hozhattok létre új eseményt, csak az időpontot kell megadni.',
      },
    ],
  },
  {
    id: '2026-10-09',
    date: '2026. október 9.',
    title: 'Ki tartja az eseményt?',
    items: [
      {
        icon: '🧙',
        title: 'Szervezők az eseményeknél',
        text: 'Az esemény létrehozásakor és szerkesztésekor megadhatjátok, ki tartja az eseményt, akár több szervezőt is. Azok közül lehet választani, akik az adott játékot kezelhetik. A mező nem kötelező, és csak az admin felületen látszik, a látogatók nem látják.',
      },
    ],
  },
  {
    id: '2026-10-08',
    date: '2026. október 8.',
    title: 'Szett megjelenések és különleges események',
    items: [
      {
        icon: '🚀',
        title: 'Új eseménytípusok',
        text: 'Az esemény űrlapon kiválaszthatjátok az esemény típusát: Verseny, Szett megjelenés, Expo vagy Különleges esemény. A nem verseny típusú események színes, fénylő megjelenést kapnak a naptárban, és mindig elöl jelennek meg, így zsúfolt napokon sem sikkadnak el.',
      },
      {
        icon: '🔗',
        title: 'Megosztás az admin felületen',
        text: 'Az eseménykártyákon a megosztás ikonra kattintva az esemény linkje azonnal a vágólapra kerül.',
      },
      {
        icon: '📅',
        title: 'Hónaponkénti lapozás',
        text: 'Az admin felület egyszerre egy hónap eseményeit mutatja. Az év- és hónapválasztóval 2026-tól bármelyik hónapra ugorhattok, a „Saját játékaim” gombbal pedig egy kattintással a saját játékaitokra szűrhettek.',
      },
    ],
  },
  {
    id: '2026-10-07-2',
    date: '2026. október 7.',
    title: 'Versenyzők felvétele',
    items: [
      {
        icon: '➕',
        title: 'Versenyző hozzáadása',
        text: 'A „Jelentkezők” ablak tetején közvetlenül felvehettek versenyzőt, pl. ha a helyszínen vagy telefonon jelentkezik. Az e-mail cím nem kötelező, és lezárt jelentkezésnél is működik. Ha az esemény betelt, várólistára kerül, vagy bejelölhetitek, hogy létszámon felül is aktív legyen. A „Megjelent” jelölővel a check-in is azonnal megtörténik.',
      },
      {
        icon: '👀',
        title: 'Jelentkezési oldal megtekintése',
        text: 'Az eseménykártyákon és a „Jelentkezők” ablakban egy gombbal megnyithatjátok a jelentkezési oldalt úgy, ahogy a játékosok látják.',
      },
    ],
  },
  {
    id: '2026-10-07',
    date: '2026. október 7.',
    title: 'Nagy frissítés',
    items: [
      {
        icon: '🖥️',
        title: 'Új admin felület',
        text: 'A vezérlőpult most kitölti a teljes képernyőt. Bal oldalon a műveletek, a szűrők és egy rövid statisztika, jobbra az események napokra csoportosítva. A múltbeli események alapból rejtve vannak, a „Múltbeli események mutatása” kapcsolóval jeleníthetők meg.',
      },
      {
        icon: '📝',
        title: 'Új jelentkezési oldal',
        text: 'A jelentkezés külön, a játékhoz illő oldalon történik. A játékosok felhasználónevet, teljes nevet és e-mail címet adnak meg. Nyilvánosan csak a felhasználónév látszik, a teljes nevet és az e-mail címet csak ti látjátok a „Jelentkezők” ablakban.',
      },
      {
        icon: '✅',
        title: 'Check-in a helyszínen',
        text: 'A „Jelentkezők” ablakban ✓ / ✗ gombbal jelölhetitek, ki jelent meg. Minden név alatt látszik, hányszor nem jött el az illető eddig (pl. „Nem jött el: 3 / 10 alkalom”).',
      },
      {
        icon: '⏫',
        title: 'Automatikus várólista',
        text: 'Ha valaki leiratkozik, ti töröltök egy jelentkezőt, vagy megemelitek a létszámot, a várólista első embere automatikusan aktív lesz. Ez bekerül a tevékenységnaplóba is.',
      },
      {
        icon: '🔗',
        title: 'Megosztható eseménylink',
        text: 'Minden eseménynek saját oldala van. A „Megosztás” gombbal a link Facebookon vagy Discordon előnézeti képpel jelenik meg.',
      },
      {
        icon: '🛒',
        title: 'Naptár a webshopban',
        text: 'A naptár beágyazható a webshopba, a jelentkezés is ott, a webshop oldalán belül működik.',
      },
      {
        icon: '🔒',
        title: 'Biztonság',
        text: 'A műveletek csak akkor írnak ki sikert, ha tényleg elmentődtek. Ha valakinek megváltozik vagy megszűnik a jogosultsága, az azonnal érvényes, nem csak a következő belépéskor.',
      },
      {
        icon: '🎮',
        title: 'Játékonkénti jogosultság',
        text: 'A „Szervezők” ablakban beállíthatod, melyik szervező milyen játékok eseményeit kezelheti. A többi eseményt ők is látják, de „Csak megtekintés” módban, és a jelentkezőiket sem látják.',
        ownerOnly: true,
      },
      {
        icon: '💾',
        title: 'Mentések és tiltás',
        text: 'A „Teljes adatbázis mentés” most tényleg mindent lement, a szűrt export külön gomb. A „Jelentkezők” ablakból egy kattintással feketelistára tehetsz valakit, az indoklás automatikusan kitöltődik.',
        ownerOnly: true,
      },
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id || null;
export const isValidChangelogId = (id) => CHANGELOG.some(r => r.id === id);

// Azok a kiadások, amiket a felhasználó még nem látott (a legújabb elöl).
// Aki még semmit nem jelölt meg (pl. új szervező), annak csak a legutóbbi jelenik meg, nem a teljes előzmény.
export function unseenReleases(lastSeenId) {
  if (!lastSeenId) return CHANGELOG.slice(0, 1);
  return CHANGELOG.filter(r => r.id > lastSeenId);
}
