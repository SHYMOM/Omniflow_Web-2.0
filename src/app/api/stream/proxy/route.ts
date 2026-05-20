import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Standard CORS headers to allow playback in the browser
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const referer = searchParams.get('referer') || '';

    if (!targetUrl) {
      return new NextResponse('Missing url parameter', { status: 400, headers: corsHeaders });
    }

    // Prepare headers for the target request
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (referer) {
      headers['Referer'] = referer;
      // Also set Origin to match referer if applicable
      try {
        const refUrl = new URL(referer);
        headers['Origin'] = refUrl.origin;
      } catch (_) {}
    }

    // Forward the Range header to support seeking on MP4/chunked media files
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Determine if it's a playlist or a chunk/segment
    const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('m3u8');

    if (isPlaylist) {
      // Fetch playlist as text, rewrite relative and absolute URLs to proxy through this endpoint
      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'text',
        timeout: 8000,
      });

      const parentUrl = new URL(targetUrl);
      const lines = response.data.split('\n');

      const rewrittenLines = lines.map((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Case 1: Decryption Key lines
        if (trimmed.startsWith('#EXT-X-KEY:')) {
          return trimmed.replace(/URI="([^"]+)"/, (match, keyUrl) => {
            const resolvedKeyUrl = new URL(keyUrl, parentUrl.href).href;
            const proxyKeyUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(resolvedKeyUrl)}&referer=${encodeURIComponent(referer)}`;
            return `URI="${proxyKeyUrl}"`;
          });
        }

        // Case 2: Segment links or Sub-playlists
        if (!trimmed.startsWith('#')) {
          const resolvedSegmentUrl = new URL(trimmed, parentUrl.href).href;
          return `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(resolvedSegmentUrl)}&referer=${encodeURIComponent(referer)}`;
        }

        return line;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } else {
      // Stream segment or raw MP4 files
      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'stream',
        timeout: 15000,
        validateStatus: () => true, // Pipe back all status codes (like 206 Partial Content)
      });

      // Forward target headers that are critical for browser playback
      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
      };

      const copyHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
      ];

      for (const h of copyHeaders) {
        const val = response.headers[h];
        if (val !== undefined) {
          responseHeaders[h] = String(val);
        }
      }

      // Add default content-type if missing
      if (!responseHeaders['content-type']) {
        if (targetUrl.includes('.ts')) {
          responseHeaders['content-type'] = 'video/mp2t';
        } else {
          responseHeaders['content-type'] = 'application/octet-stream';
        }
      }

      // Read from the axios readable stream
      const stream = new ReadableStream({
        async start(controller) {
          response.data.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          response.data.on('end', () => {
            controller.close();
          });
          response.data.on('error', (err: Error) => {
            controller.error(err);
          });
        },
      });

      return new NextResponse(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }
  } catch (error: any) {
    console.error('Streaming proxy error:', error?.message || error);
    return new NextResponse('Internal Proxy Error', { status: 500, headers: corsHeaders });
  }
}
