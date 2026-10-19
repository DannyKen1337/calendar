// A nyilvános naptár alján megjelenő linkekhez: van-e publikált liga.
// Az előrendelésről szándékosan nem adunk ki információt: az csak az admin felületről kimásolt linkkel érhető el.
export async function getExtraLinks(db) {
  const [league, season] = await Promise.all([
    db.collection('leagues').findOne({ 'published.at': { $exists: true } }, { projection: { _id: 1 } }),
    db.collection('league_seasons').findOne({}, { projection: { _id: 1 } }),
  ]);
  return { leagues: !!(league || season) };
}
