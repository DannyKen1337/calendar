// A hangulatszövegek: rövid cím és egy rövid mondat. A töltőképernyőkön látszanak (a főoldal első betöltésekor és
// a naptár- / asztalfoglaló ablak töltése közben), az oldalon már nincsenek külön mezőként.
export const MOODS = [
  { title: 'Minden héten verseny', text: 'Pokémon, One Piece, Magic, Warhammer és még sok más.' },
  { title: 'Három bolt, egy klub', text: 'Szabad asztal mindig akad.' },
  { title: 'Ligák szezononként', text: 'Minden alkalom számít.' },
  { title: 'Ne maradj le', text: 'Foglald le az új kiadást előre.' },
];

// Melyik szöveg látszik: 5 percenként a következő (a főoldal is ennyi időnként frissül)
export const moodAt = (time = Date.now()) => MOODS[Math.floor(time / 300000) % MOODS.length];
