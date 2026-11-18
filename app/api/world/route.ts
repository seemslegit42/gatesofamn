import { NextResponse } from 'next/server';
import { getDbMode, getLeaderboard, loadWorldShrines } from '@/lib/db/turso';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [shrines, leaderboard] = await Promise.all([
      loadWorldShrines(),
      getLeaderboard(10),
    ]);
    return NextResponse.json({
      dbMode: getDbMode(),
      shrines,
      leaderboard,
    });
  } catch (err) {
    console.error('World API error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}
