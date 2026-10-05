// Megjelenési előzmények (check-in) a megbízhatósági statisztikához.
// 1 évig őrizzük meg (a jelentkezési ablak adatkezelési tájékoztatója szerint), utána törlődnek.

export async function deleteOldAttendanceHistory(db) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  await db.collection('attendance_history').deleteMany({ recordedAt: { $lt: oneYearAgo } });
}

// E-mail címenként: hányszor jelent meg / hányszor nem (csak a megadott címekre)
export async function getAttendanceStats(db, emails) {
  const list = [...new Set((emails || []).filter(Boolean))];
  if (list.length === 0) return {};
  const rows = await db.collection('attendance_history').aggregate([
    { $match: { email: { $in: list } } },
    { $group: { _id: '$email', attended: { $sum: { $cond: ['$attended', 1, 0] } }, noShow: { $sum: { $cond: ['$attended', 0, 1] } } } },
  ]).toArray();
  return Object.fromEntries(rows.map(r => [r._id, { attended: r.attended, noShow: r.noShow }]));
}
