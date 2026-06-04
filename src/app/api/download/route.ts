import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const referer = searchParams.get('referer') || '';
    const name = searchParams.get('name') || 'video';

    if (!targetUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    if (referer) {
      headers['Referer'] = referer;
      try {
        const refUrl = new URL(referer);
        headers['Origin'] = refUrl.origin;
      } catch (_) {}
    }

    // Determine extension based on target URL
    const isM3U8 = targetUrl.includes('.m3u8') || targetUrl.includes('m3u8');
    const ext = isM3U8 ? '.m3u8' : '.mp4';
    const filename = `${name}${ext}`;

    const fetchRes = await fetch(targetUrl, {
      headers: headers as any,
    });

    if (!fetchRes.ok) {
      return new NextResponse(`Upstream Error: ${fetchRes.status}`, { status: fetchRes.status });
    }

    const resHeaders = new Headers();
    resHeaders.set('Content-Type', fetchRes.headers.get('content-type') || (isM3U8 ? 'application/vnd.apple.mpegurl' : 'video/mp4'));
    if (fetchRes.headers.has('content-length')) {
      resHeaders.set('Content-Length', fetchRes.headers.get('content-length') as string);
    }
    
    // Force browser to download the file instead of rendering it inline
    resHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(fetchRes.body, {
      status: 200,
      headers: resHeaders,
    });
  } catch (error: any) {
    console.error('Download proxy error:', error?.message || error);
    return new NextResponse('Internal Proxy Error', { status: 500 });
  }
}
