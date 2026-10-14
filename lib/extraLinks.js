// A nyilvános naptár alján megjelenő linkekhez: van-e publikált liga, illetve nyitott előrendelés
export async function getExtraLinks(db) {
  const [league, season, product] = await Promise.all([
    db.collection('leagues').findOne({ 'published.at': { $exists: true } }, { projection: { _id: 1 } }),
    db.collection('league_seasons').findOne({}, { projection: { _id: 1 } }),
    db.collection('preorder_products').findOne({ isOpen: true }, { projection: { _id: 1 } }),
  ]);
  return { leagues: !!(league || season), preorders: !!product };
}
