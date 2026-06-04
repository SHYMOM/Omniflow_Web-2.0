import { NextRequest, NextResponse } from 'next/server';
import { StealthHttpClient } from '@/lib/extraction/stealth-client';

const stealthClient = new StealthHttpClient();

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
    const headers: Record<string, string> = {};

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

    // Determine content type from URL
    const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('m3u8');
    const isImage = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|$)/i.test(targetUrl);
    const isSubtitle = searchParams.get('type') === 'sub' || /\.(vtt|srt)(\?|$)/i.test(targetUrl) || targetUrl.includes('subtitle') || targetUrl.includes('subs');

    // ─── SUBTITLE PROXY (with SRT to VTT conversion) ──────────
    if (isSubtitle) {
      const response = await stealthClient.request({
        url: targetUrl,
        method: 'GET',
        headers,
        referer,
        responseType: 'text',
        timeout: 15000,
      });

      let textData = response.data;
      if (typeof textData !== 'string') {
        textData = String(textData || '');
      }

      // Strip BOM early before checking format
      if (textData.charCodeAt(0) === 0xFEFF) {
        textData = textData.substring(1);
      }

      // Check if it is SRT format (fails to start with WEBVTT but has SRT pattern)
      const trimmed = textData.trim();
      const isSrt = targetUrl.includes('.srt') || searchParams.get('type') === 'sub' || (!trimmed.startsWith('WEBVTT') && /^\d+\s*\n\d{2}:\d{2}:\d{2}/.test(trimmed));
      
      if (isSrt && !trimmed.startsWith('WEBVTT')) {
        // Normalize line endings
        let vtt = textData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Convert timestamps: replace comma with dot
        vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        textData = `WEBVTT\n\n${vtt}`;
      }

      return new NextResponse(textData, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/vtt; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // ─── IMAGE PROXY (for manga pages) ────────────────────────
    if (isImage) {
      const response = await stealthClient.request({
        url: targetUrl,
        method: 'GET',
        headers,
        referer,
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      // Detect content type from response or URL extension
      let contentType: string = String(response.headers['content-type'] || 'image/jpeg');
      if (!contentType.startsWith('image/')) {
        const ext = targetUrl.match(/\.(jpe?g|png|webp|gif|avif|bmp)/i)?.[1]?.toLowerCase();
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          png: 'image/png', webp: 'image/webp',
          gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp',
        };
        contentType = mimeMap[ext || 'jpg'] || 'image/jpeg';
      }

      return new NextResponse(response.data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': String(response.data.byteLength || 0),
          'Cache-Control': 'public, max-age=3600, immutable',
        },
      });
    }

    if (isPlaylist) {
      // Fetch playlist as text, rewrite relative and absolute URLs to proxy through this endpoint
      const response = await stealthClient.request({
        url: targetUrl,
        method: 'GET',
        headers,
        referer,
        responseType: 'text',
        timeout: 8000,
      });

      const parentUrl = new URL(targetUrl);
      const lines = response.data.split('\n');

      const rewrittenLines = lines.map((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Case 1: Any tag with a URI="..." attribute (e.g. #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP)
        // We proxy key URIs instead of stripping them — the player has proper retry logic
        // to handle broken/fake keys without crashing.
        if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match, urlValue) => {
            const resolvedUrl = new URL(urlValue, parentUrl.href).href;
            const proxyUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(referer)}`;
            return `URI="${proxyUrl}"`;
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
          'Content-Type': 'text/plain', // IDM BYPASS: Use text/plain instead of application/vnd.apple.mpegurl
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } else {

      // ─── DIRECT MP4 PROXY (STREAMING) ───────────────────────
      const isMp4 = targetUrl.includes('.mp4');
      if (isMp4) {
        // We use native fetch to get a ReadableStream we can pipe directly to NextResponse
        // This avoids buffering a 2GB file into memory!
        const fetchRes = await fetch(targetUrl, {
          headers: headers as any,
        });

        const resHeaders = new Headers(corsHeaders);
        resHeaders.set('Content-Type', fetchRes.headers.get('content-type') || 'video/mp4');
        if (fetchRes.headers.has('content-length')) resHeaders.set('Content-Length', fetchRes.headers.get('content-length') as string);
        if (fetchRes.headers.has('content-range')) resHeaders.set('Content-Range', fetchRes.headers.get('content-range') as string);
        resHeaders.set('Accept-Ranges', 'bytes');

        return new NextResponse(fetchRes.body, {
          status: fetchRes.status,
          headers: resHeaders,
        });
      }

      // ─── VIDEO SEGMENT / TS CHUNK PROXY ─────────────────────────
      // Many pirate CDNs wrap real MPEG-TS video data inside fake PNG images
      // to hide them on image CDNs (e.g. TikTok ByteDance ibyteimg.com).
      // We must download the full chunk, detect the PNG wrapper, strip it,
      // and serve only the raw MPEG-TS bytes to hls.js.

      const response = await stealthClient.request({
        url: targetUrl,
        method: 'GET',
        headers,
        referer,
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      // If the upstream CDN returned an error (404, 403, etc.), forward the error
      // instead of serving HTML error pages as fake video data to hls.js
      if (response.status >= 400) {
        return new NextResponse(`Upstream error: ${response.status}`, {
          status: response.status,
          headers: corsHeaders,
        });
      }

      let buffer = Buffer.from(response.data);
      let contentType = 'video/mp2t';

      // PNG magic bytes: 89 50 4E 47 (hex for \x89PNG)
      const isPNG = buffer.length > 70 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 &&
        buffer[2] === 0x4E && buffer[3] === 0x47;

      if (isPNG) {
        // The CDN wraps TS data inside a minimal 1x1 PNG (IHDR+IDAT+IEND).
        // PNG structure: 8-byte signature, then length(4)+type(4)+data(N)+crc(4) chunks.
        // We parse the PNG chunk structure to find where IEND ends,
        // then the real MPEG-TS data starts immediately after.
        let offset = 8; // skip PNG signature
        while (offset + 8 <= buffer.length) {
          const chunkLen = buffer.readUInt32BE(offset);
          const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');
          offset += 12 + chunkLen; // 4(len) + 4(type) + data + 4(crc)
          if (chunkType === 'IEND') break;
        }

        if (offset < buffer.length) {
          // Strip the PNG wrapper — everything after IEND is real video
          buffer = buffer.slice(offset);
        }
        contentType = 'application/octet-stream'; // IDM BYPASS
      } else if (buffer.length > 0 && buffer[0] === 0x47) {
        // Already raw MPEG-TS
        contentType = 'application/octet-stream'; // IDM BYPASS
      } else {
        // Unknown format — pass through as-is
        const upstreamCT = String(response.headers['content-type'] || '');
        contentType = upstreamCT.includes('image/') ? 'application/octet-stream' : (upstreamCT || 'application/octet-stream');
      }

      return new NextResponse(buffer, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': String(buffer.length),
          'Cache-Control': 'public, max-age=300',
        },
      });
    }
  } catch (error: any) {
    console.error('Streaming proxy error:', error?.message || error);
    return new NextResponse('Internal Proxy Error', { status: 500, headers: corsHeaders });
  }
}
