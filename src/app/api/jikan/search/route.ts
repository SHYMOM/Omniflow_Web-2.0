import { NextRequest, NextResponse } from 'next/server';

const JIKAN_BASE = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'anime';
    const page = searchParams.get('page') || '1';

    const response = await fetch(
      `${JIKAN_BASE}/${type}?q=${encodeURIComponent(q)}&page=${page}&order_by=score&sort=desc`
    );
    if (!response.ok) return NextResponse.json({ error: 'Jikan API error' }, { status: response.status });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jikan search proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
