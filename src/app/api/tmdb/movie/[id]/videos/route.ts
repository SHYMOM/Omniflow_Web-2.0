import { NextRequest, NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(
      `${TMDB_BASE}/movie/${id}/videos?api_key=${TMDB_KEY}&language=en-US`
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'TMDB API error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('TMDB movie videos proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
