/** MongoDB-backed rate limit (works across serverless instances). */
export async function consumeRateLimit(db, key, limit, windowMs) {
  const windowStart = new Date(Date.now() - windowMs);
  const coll = db.collection('rate_limits');
  const recent = await coll.countDocuments({ key, at: { $gte: windowStart } });
  if (recent >= limit) return false;
  await coll.insertOne({ key, at: new Date() });
  return true;
}

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
