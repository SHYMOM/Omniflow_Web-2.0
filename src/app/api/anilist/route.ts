import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const ANILIST_URL = process.env.ANILIST_BASE_URL || 'https://graphql.anilist.co';

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json(
        { error: 'AniList API error', details: 'Empty request body' },
        { status: 400 }
      );
    }
    const body = JSON.parse(text);
    const { query, variables } = body;

    const response = await axios.post(
      ANILIST_URL,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('AniList proxy error:', error?.response?.data || error?.message || error);
    return NextResponse.json(
      { 
        error: 'AniList API error', 
        details: error?.response?.data || error?.message 
      },
      { status: error?.response?.status || 500 }
    );
  }
}
