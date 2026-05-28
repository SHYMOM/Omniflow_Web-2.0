import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: 'TMDB_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/reviews?api_key=${TMDB_API_KEY}&language=en-US&page=1`, {
      next: { revalidate: 3600 }
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch TMDB tv reviews' }, { status: 500 });
  }
}
