import { NextRequest, NextResponse } from 'next/server';

const JIKAN_BASE = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'anime';
    const filter = searchParams.get('filter') || '';
    const page = searchParams.get('page') || '1';

    let url = `${JIKAN_BASE}/top/${type}?page=${page}`;
    if (filter) url += `&filter=${filter}`;

    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: 'Jikan API error' }, { status: response.status });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jikan top proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
