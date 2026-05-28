import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`https://api.jikan.moe/v4/anime/${id}/reviews`, {
      next: { revalidate: 3600 }
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Jikan anime reviews' }, { status: 500 });
  }
}
