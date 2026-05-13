import { NextRequest, NextResponse } from 'next/server';

const JIKAN_BASE = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${JIKAN_BASE}/anime/${id}/full`, { next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: 'Jikan API error' }, { status: response.status });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jikan anime detail proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
