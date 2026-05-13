import { NextRequest, NextResponse } from 'next/server';

const MU_BASE = process.env.MANGAUPDATES_BASE_URL || 'https://api.mangaupdates.com/v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${MU_BASE}/series/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) return NextResponse.json({ error: 'MangaUpdates API error' }, { status: response.status });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('MangaUpdates search proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
