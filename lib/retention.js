// Személyes adatok megőrzési ideje (a törlést és az előtte készülő Drive-mentést a lib/cleanup.js végzi).
// - Előrendelés: a lezárt termék a jelentkezőivel együtt a lezárás után PREORDER_RETENTION_MONTHS hónappal törlődik.
// - Liga: a játékos (teljes név, e-mail) törlődik, ha LEAGUE_PLAYER_RETENTION_MONTHS hónapja nem jelent meg egy alkalmon sem
//   (és legalább ennyi ideje vették fel). A publikált és archív ranglistákban csak a becenév marad meg.

export const PREORDER_RETENTION_MONTHS = 6;
export const LEAGUE_PLAYER_RETENTION_MONTHS = 12;
