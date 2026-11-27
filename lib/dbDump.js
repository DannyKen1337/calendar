// A teljes adatbázis mentése (Továbbiak › Teljes adatbázis mentés, és a Rendszer oldal „Mentés most a Google Drive-ra”):
// jelszó-hash és titkos kulcsok nélkül. Mellette a levelek, üzenetszálak, foglalások és a játékos bázis is.
export async function buildDbDump(db) {
  const [tournaments, registrations, users, logs, blacklist, settings, preorderProducts, preorders, leagues, leaguePlayers, leagueSessions, leagueSeasons] = await Promise.all([
    db.collection('tournaments').find({}).toArray(),
    db.collection('registrations').find({}).toArray(),
    db.collection('users').find({}, { projection: { password: 0 } }).toArray(), // Jelszavakat sosem exportálunk!
    db.collection('audit_logs').find({}).sort({ date: -1 }).toArray(),
    db.collection('blacklist').find({}).toArray(),
    db.collection('settings').find({}).toArray(),
    db.collection('preorder_products').find({}).toArray(),
    db.collection('preorders').find({}).toArray(),
    db.collection('leagues').find({}).toArray(),
    db.collection('league_players').find({}).toArray(),
    db.collection('league_sessions').find({}).toArray(),
    db.collection('league_seasons').find({}).toArray(),
  ]);
  // a többi gyűjtemény (a telefonos feliratkozások kulcsai és a belépési számlálók nem kellenek a mentésbe)
  const more = {};
  for (const [key, name] of [['userGroups', 'user_groups'], ['players', 'players'], ['externalRegistrations', 'external_registrations'], ['attendanceHistory', 'attendance_history'], ['tableBookings', 'table_bookings'], ['storeBookings', 'store_bookings'], ['messageThreads', 'message_threads'], ['inboxMails', 'inbox_mails'], ['websiteContent', 'website_content'], ['websitePosts', 'website_posts']]) {
    more[key] = await db.collection(name).find({}).toArray();
  }

  return {
    exportDate: new Date(),
    tournaments,
    registrations,
    users,
    logs,
    blacklist,
    // a titkos kulcsok (pl. a telefonos értesítések VAPID-kulcsa) nem kerülnek a letöltött fájlba
    settings: settings.map(({ privateKey, ...doc }) => (privateKey ? { ...doc, privateKey: '(kihagyva)' } : doc)),
    preorderProducts,
    preorders,
    leagues,
    leaguePlayers,
    leagueSessions,
    leagueSeasons,
    ...more,
  };
}
