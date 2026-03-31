import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mode = (req.nextUrl.searchParams.get('mode') as 'local' | 'remote') || 'local';

  try {
    const logs = await db.getLogs(mode);
    return NextResponse.json({ ok: true, count: logs.length, logs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
