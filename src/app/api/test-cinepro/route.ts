import { NextRequest, NextResponse } from 'next/server';
import { CineproAggregator } from '@/lib/extraction/cinepro-aggregator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get('tmdbId') || '1083381'; // Backrooms
    const imdbId = searchParams.get('imdbId') || 'tt26657236';

    console.log(`[TestCinepro] Scraping TMDB ${tmdbId}, IMDB ${imdbId}...`);
    const aggregator = new CineproAggregator();
    const result = await aggregator.scrapeMovie(tmdbId, imdbId);

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
