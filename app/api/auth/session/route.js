import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (user) {
    const { id, username, email, role, allowedCategories, lastSeenChangelog } = user;
    return NextResponse.json({ user: { id, username, email, role, allowedCategories, lastSeenChangelog } });
  }
  return NextResponse.json({ user: null });
}
