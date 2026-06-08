import { detectAndUnpack } from '../../extraction/utils/jsunpack';
import { VideoExtractor, IVideo } from '../models';

export async function extractFileMoon(url: string): Promise<{ url: string; type: 'hls' | 'mp4'; headers?: Record<string, string> }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url
      }
    });
    
    if (!res.ok) throw new Error(`FileMoon failed with status ${res.status}`);
    const html = await res.text();
    
    let unpacked = html;
    // Look for packed script structure inside the HTML page
    const packedMatch = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\).+?\}\s*\)\s*\)/s);
    if (packedMatch) {
        unpacked = detectAndUnpack(packedMatch[0]);
    }
    
    // Extract the master HLS .m3u8 link (usually hidden in `file:"..."` or `src:"..."` arrays)
    const m3u8Match = unpacked.match(/\{?\s*(?:file|src)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    
    if (!m3u8Match || !m3u8Match[1]) {
      throw new Error('FileMoon: Master M3U8 not found');
    }
    
    return {
      url: m3u8Match[1],
      type: 'hls',
      headers: {
        'Referer': new URL(url).origin + '/'
      }
    };
  } catch (error) {
    throw new Error(`FileMoon extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

class Filemoon extends VideoExtractor {
  protected override serverName = 'Filemoon';
  protected override sources: IVideo[] = [];

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    const result = await extractFileMoon(videoUrl.href);
    this.sources.push({
      url: result.url,
      isM3U8: result.type === 'hls',
      headers: result.headers
    });
    return this.sources;
  };
}

export default Filemoon;
