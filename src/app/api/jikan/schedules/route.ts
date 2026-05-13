import { NextRequest, NextResponse } from 'next/server';

const JIKAN_BASE = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get('day') || '';

    let url = `${JIKAN_BASE}/schedules`;
    if (day) url += `?filter=${day}`;

    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) return NextResponse.json({ error: 'Jikan API error' }, { status: response.status });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jikan schedules proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
