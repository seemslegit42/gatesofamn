import { NextResponse } from 'next/server';
import {
  getDbMode,
  getLeaderboard,
  loadRecentDynamicEvents,
  loadWorldShrines,
} from '@/lib/db/turso';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [shrines, leaderboard, recentEvents] = await Promise.all([
      loadWorldShrines(),
      getLeaderboard(10),
      loadRecentDynamicEvents(5),
    ]);
    return NextResponse.json({
      dbMode: getDbMode(),
      shrines,
      leaderboard,
      recentEvents,
    });
  } catch (err) {
    console.error('World API error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}
