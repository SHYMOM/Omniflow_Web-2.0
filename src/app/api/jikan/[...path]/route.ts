import { NextRequest, NextResponse } from 'next/server';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const targetUrl = `${JIKAN_BASE}/${pathSegments.join('/')}${queryString ? '?' + queryString : ''}`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      next: { revalidate: 1800 } // Cache for 30 minutes to safeguard rate-limits
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Jikan API responded with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.warn('Jikan catch-all proxy error:', error?.message || error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
