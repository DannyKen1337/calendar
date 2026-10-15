// Újdonságok az admin felülethez. Nagyobb frissítésnél ide kell egy új bejegyzést tenni a lista ELEJÉRE:
// az adminok a következő belépéskor egy felugró ablakban látják (felhasználónként egyszer, az adatbázisban jegyezzük).
// id: egyedi, időrendben növekvő azonosító (dátum); ownerOnly: csak a tulajdonos (Admin2) látja az adott pontot.

export const CHANGELOG = [
  {
    id: '2026-10-15',
    date: '2026. október 15.',
    title: 'Átadás és élő frissítés',
    items: [
      {
        icon: '🤝',
        title: 'Előrendelés átadása',
        text: 'A jelentkezők listájában az „Átadás” gombbal jelölhetitek, ki vette már át a terméket. Az átadott jelentkezések halványan, a lista aljára kerülnek, és visszavonhatók. Az Excelben a jelentkezők név szerinti sorrendben maradnak, az átadás ideje és az átadó neve külön oszlopban látszik.',
      },
      {
        icon: '🔄',
        title: 'Élő frissítés',
        text: 'Az új jelentkezések és előrendelések oldalfrissítés nélkül, néhány másodpercen belül megjelennek a naptárban, az admin felületen, a check-innél és az előrendeléseknél.',
      },
    ],
  },
  {
    id: '2026-10-14-6',
    date: '2026. október 14.',
    title: 'Ár az előrendelésnél',
    items: [
      {
        icon: '💰',
        title: 'Termékár',
        text: 'Az előrendelhető termékeknél megadhatjátok a darabárat forintban (nem kötelező). A vásárló a termék mellett, a kiválasztott darabszám szerint és a végösszegnél is látja, a megosztott termék-link előnézetében is megjelenik. Az admin kártyán és az Excelben a várható összeg is látszik.',
      },
    ],
  },
  {
    id: '2026-10-14-5',
    date: '2026. október 14.',
    title: 'Jogosultság boltonként',
    items: [
      {
        icon: '🏪',
        title: 'Bolt szerinti jogosultság',
        text: 'A tulajdonos szervezőnként beállíthatja, mely boltok eseményeit kezelheti (Szervezők, Jogosultságok). A többi bolt eseményei továbbra is látszanak a naptárban, de nem szerkeszthetők, és a jelentkezőik sem látszanak. A meglévő szervezők alapból minden boltot kezelhetnek, amíg a tulajdonos nem korlátozza őket.',
      },
    ],
  },
  {
    id: '2026-10-14-4',
    date: '2026. október 14.',
    title: 'Szezonok, részletesebb ranglista és kisebb fejlesztések',
    items: [
      {
        icon: '🏁',
        title: 'Liga szezonok',
        text: 'A liga „Szezon lezárása” gombjával a végeredmény archiválódik, és új néven, nulláról indul a következő szezon. A játékosok megtarthatók. A korábbi szezonok a „Korábbi szezonok” fülön és a nyilvános ligaoldalon is visszanézhetők.',
      },
      {
        icon: '📈',
        title: 'Részletesebb ranglista',
        text: 'A nyilvános ranglistán kis nyíl jelzi, ki hány helyet lépett előre vagy esett vissza az előző publikálás óta. Egy sorra koppintva látszanak a játékos alkalmai, győzelmei, döntetlenjei és vereségei. Megosztáskor (Facebook, Discord) az előnézeti képen az első öt helyezett látszik.',
      },
      {
        icon: '🃏',
        title: 'Decklist eseményenként',
        text: 'A decklist jelölés mostantól csak azoknál az eseményeknél jelenik meg, ahol az esemény űrlapján vagy a generátorban bekapcsoljátok. Ahol korábban már jelöltetek decklistet, ott továbbra is látszik.',
      },
      {
        icon: '🔗',
        title: 'Linkek a naptár alján',
        text: 'A nyilvános naptár alján megjelenik a „Ligák ranglistája” és az „Előrendelés” gomb, ha van publikált liga, illetve nyitott előrendelés.',
      },
      {
        icon: '🧹',
        title: 'Automatikus adattörlés',
        text: 'A lezárt előrendelési termékek a jelentkezőikkel együtt a lezárás után 6 hónappal törlődnek, a 12 hónapja nem aktív ligajátékosok adatai pedig automatikusan törlődnek. Előtte érdemes Excelbe menteni, ami kell.',
      },
    ],
  },
  {
    id: '2026-10-14-3',
    date: '2026. október 14.',
    title: 'Ligák és külön jogosultságok',
    items: [
      {
        icon: '🏆',
        title: 'Ligák',
        text: 'Az oldalsáv „Ligák” gombjával játékonként egy ligát hozhattok létre. Felvehettek játékosokat teljes névvel, becenévvel és e-mail címmel, és alkalmanként rögzíthetitek a megjelenést, a győzelmeket, döntetleneket, vereségeket és a bónuszpontokat. A pontokat a liga pontozása alapján a rendszer számolja.',
      },
      {
        icon: '👀',
        title: 'Előnézet és publikálás',
        text: 'A játékosok csak a nyilvános ranglistát látják (/liga), azon is csak a becenevet és a pontot. A ranglista csak az „Előnézet és publikálás” gombbal frissül; az előnézet pontosan azt mutatja, ami kikerül, a sor végén azzal, hogy ki hány pontot kapott az előző publikálás óta.',
      },
      {
        icon: '🔐',
        title: 'Külön jog az előrendeléshez és a ligához',
        text: 'Az Előrendelés és a Ligák modult csak az használhatja, akinek a tulajdonos engedélyt ad (Felhasználók, Jogosultságok). Ott is csak a saját játékait kezelheti. Az előrendeléseknél játékonként is letölthető Excel.',
      },
    ],
  },
  {
    id: '2026-10-14-2',
    date: '2026. október 14.',
    title: 'Előrendelés: mennyiség és limit',
    items: [
      {
        icon: '🔢',
        title: 'Elérhető mennyiség és személyenkénti limit',
        text: 'Termék felvételekor megadhatjátok, összesen hány darab rendelhető elő. Ez nem kötelező. Ha betelik, a termék „Elfogyott” jelzést kap. A személyenkénti limitet kötelező megadni, a 0 korlátlant jelent. A limitnél az azonos e-mail cím és az azonos telefonszám is egy vásárlónak számít. A korábban felvett termékeknél a limit szerkesztéssel állítható be, addig korlátlan.',
      },
    ],
  },
  {
    id: '2026-10-14',
    date: '2026. október 14.',
    title: 'Előrendelések',
    items: [
      {
        icon: '🛒',
        title: 'Előrendelési feliratkozás',
        text: 'Az oldalsáv „Előrendelések” gombjával játékonként vehettek fel előrendelhető termékeket és kiegészítőket. A vásárlók a /elorendeles oldalon iratkozhatnak fel névvel, e-mail címmel, telefonszámmal és darabszámmal. Egy termék „Link másolása” gombja olyan linket ad, amely csak azt a terméket mutatja, így egy-egy meghirdetéshez is használható.',
      },
      {
        icon: '📄',
        title: 'Jelentkezők és Excel',
        text: 'A beérkezett jelentkezéseket termékenként a „Jelentkezők” gombbal nézhetitek meg, vagy letölthetitek Excelben. Az Excel első lapja termékenként összesíti a darabszámokat. Lezárás után a termék nem látszik a nyilvános oldalon, de a jelentkezések megmaradnak. Mindenki csak az általa kezelt játékok termékeit látja.',
      },
    ],
  },
  {
    id: '2026-10-11',
    date: '2026. október 11.',
    title: 'Decklist jelölés és mai program',
    items: [
      {
        icon: '🃏',
        title: 'Decklist leadásának jelölése',
        text: 'A „Jelentkezők” ablakban és a mobilos check-in nézetben a megjelenés mellett azt is jelölhetitek, hogy a játékos leadta-e a decklistet (✓) vagy nem (✗). Újrakattintással a jelölés visszavonható. Ez csak az admin felületen látszik.',
      },
      {
        icon: '📅',
        title: 'Mai program a nyilvános naptárban',
        text: 'A nyilvános naptár alján külön blokk mutatja az adott helyszín aznapi eseményeit kezdési idő szerint.',
      },
    ],
  },
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
