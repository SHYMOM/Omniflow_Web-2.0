import { NextRequest, NextResponse } from 'next/server';

const ANILIST_URL = process.env.ANILIST_BASE_URL || 'https://graphql.anilist.co';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, variables } = body;

    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'AniList API error', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('AniList proxy error:', error);
    return NextResponse.json(
      { error: 'Internal proxy error' },
      { status: 500 }
    );
  }
}
