import { NextResponse } from 'next/server';
import { getPlexStatus } from '@/lib/plex';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getPlexStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[plex-status ${new Date().toISOString()}] /api/status failed — ${message}`
    );
    return NextResponse.json(
      { error: 'Failed to retrieve Plex status' },
      { status: 500 }
    );
  }
}
