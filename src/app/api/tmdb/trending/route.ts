import { NextRequest, NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'movie';
    const timeWindow = searchParams.get('timeWindow') || 'week';

    const response = await fetch(
      `${TMDB_BASE}/trending/${type}/${timeWindow}?api_key=${TMDB_KEY}&language=en-US`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'TMDB API error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('TMDB trending proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
