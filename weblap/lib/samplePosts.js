// Minta posztok a főoldal Hírek részébe: így néz ki egy Facebookról / Instagramról behúzott poszt. Csak addig látszanak,
// amíg nincs beállítva a Facebook / Instagram behúzás (META_PAGES), vagy nincs egy behúzott poszt sem.
// A hat változat: csak szöveg (rövid, hosszú), 1 kép kevés / sok szöveggel, sok kép kevés / sok szöveggel.
const P = (name) => `/photos/${name}`;

export function samplePosts(now = Date.now()) {
  const ago = (h) => new Date(now - h * 3600 * 1000).toISOString();
  return [
    {
      key: 'minta:1', source: 'facebook', store: 'debrecen', date: ago(2), images: [],
      text: 'Megérkeztek a Pokémon 30. évfordulós ETB-k! 🎉 Gyertek be értük a boltba, amíg tart a készlet.',
    },
    {
      key: 'minta:2', source: 'instagram', store: 'miskolc', date: ago(5), images: [P('pakli-bontas.png')],
      text: 'Itt vannak a 30. évfordulós ETB-k! 30 év Pokémon egy dobozban. Ma 15:00-tól nálunk. ⚡',
    },
    {
      key: 'minta:3', source: 'facebook', store: 'jatekceh', date: ago(9), images: [],
      text: 'Megérkeztek a Pokémon TCG 30. évfordulós Elite Trainer Boxok!\n\nAz évforduló alkalmából készült ETB-ben a booster csomagok mellett exkluzív promókártya, évfordulós kártyatartó, sorszámozott jelölők és egy gyűjtői doboz is van, ami a polcon is jól mutat.\n\nA dobozokat a nyitvatartási időben a boltban veheted meg. Fejenként legfeljebb 2 darab, hogy mindenkinek jusson. Ha az előrendelésben foglaltál, a neved alatt már félretettük, csak szólj a pultnál.\n\nKérdésed van? Írj nekünk Messengeren, vagy gyere be, és megmutatjuk a tartalmát. Szombaton 10-től 21-ig várunk!',
    },
    {
      key: 'minta:4', source: 'facebook', store: 'debrecen', date: ago(26), images: [P('bolt-asztalok.png')],
      text: 'Megérkeztek a Pokémon 30. évfordulós ETB-k, és már a pulton is ott vannak!\n\nPénteken a Nexus Night előtt is meg tudod venni, és akár ott helyben bonthatod a klubasztalnál, a többiekkel együtt. Fejenként legfeljebb 2 darabot adunk, az előrendelők dobozai félre vannak téve.\n\nVárunk a Gambrinus közben: szerdától péntekig 15 és 21 óra között, szombaton 10-től, vasárnap 11-től. Hozd a haverokat is, asztal mindig akad!',
    },
    {
      key: 'minta:5', source: 'instagram', store: 'debrecen', date: ago(30), images: [P('pakli-bontas.png'), P('klub-asztal.png'), P('verseny.png'), P('bolt-asztalok.png'), P('csapat.png')],
      text: 'Kicsomagoltuk 📦 Pokémon 30. évfordulós ETB-k a boltban. Gyertek!',
    },
    {
      key: 'minta:6', source: 'facebook', store: 'jatekceh', date: ago(50), images: [P('jatekceh-kirakat.jpg'), P('pakli-bontas.png'), P('klub-asztal.png'), P('verseny.png')],
      text: 'Bontottunk egyet a Pokémon 30. évfordulós ETB-kből, hogy lássátok, mi van benne!\n\nA dobozban 9 booster csomag, az évfordulós promókártya, 65 kártyatartó a jubileumi mintával, sorszámozott jelölők, kocka és egy gyűjtői tároló van. A képeken a teljes tartalom látszik.\n\nA készlet véges: fejenként legfeljebb 2 darab. Az előrendelőknek félretettük, a többit érkezési sorrendben adjuk. A boltban kipróbálhatod a promókártyát is egy barátságos meccsen.\n\nNézz be hozzánk a Batthyány utcába: hétfőn és kedden 12–18, pénteken 14–20, szombaton 10–21 óra között.',
    },
  ];
}
