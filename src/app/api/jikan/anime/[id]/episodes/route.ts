import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const JIKAN_BASE = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';

    const response = await axios.get(`${JIKAN_BASE}/anime/${id}/episodes?page=${page}`, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Jikan episodes proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error', details: error.message, stack: error.stack }, { status: 500 });
  }
}
