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

    // Determine content type from URL
    const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('m3u8');
    const isImage = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|$)/i.test(targetUrl);

    // ─── IMAGE PROXY (for manga pages) ────────────────────────
    if (isImage) {
      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: () => true,
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
      // ─── VIDEO SEGMENT / TS CHUNK PROXY ─────────────────────────
      // Many pirate CDNs wrap real MPEG-TS video data inside fake PNG images
      // to hide them on image CDNs (e.g. TikTok ByteDance ibyteimg.com).
      // We must download the full chunk, detect the PNG wrapper, strip it,
      // and serve only the raw MPEG-TS bytes to hls.js.

      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: () => true,
      });

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
        contentType = 'video/mp2t';
      } else if (buffer.length > 0 && buffer[0] === 0x47) {
        // Already raw MPEG-TS
        contentType = 'video/mp2t';
      } else {
        // Unknown format — pass through as-is
        const upstreamCT = String(response.headers['content-type'] || '');
        contentType = upstreamCT.includes('image/') ? 'video/mp2t' : (upstreamCT || 'application/octet-stream');
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
