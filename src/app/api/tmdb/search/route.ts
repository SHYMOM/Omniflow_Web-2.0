import { NextRequest, NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'multi';
    const page = searchParams.get('page') || '1';

    const response = await fetch(
      `${TMDB_BASE}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=${page}&language=en-US`
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'TMDB API error' }, { status: response.status });
    }

    const data = await response.json();

    // Filter out Anime from TMDB results to prevent duplicates with Anilist/Jikan search.
    // Anime in TMDB usually have original_language = 'ja' and genre_ids including 16 (Animation).
    if (data.results && Array.isArray(data.results)) {
      data.results = data.results.filter((item: any) => {
        const isJapanese = item.original_language === 'ja';
        const isAnimation = item.genre_ids && Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
        return !(isJapanese && isAnimation);
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('TMDB search proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
