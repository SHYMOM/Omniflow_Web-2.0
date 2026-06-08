import { detectAndUnpack } from '../../extraction/utils/jsunpack';
import { VideoExtractor, IVideo } from '../models';

export async function extractMixDrop(url: string): Promise<{ url: string; type: 'hls' | 'mp4'; headers?: Record<string, string> }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error(`MixDrop failed with status ${res.status}`);
    const html = await res.text();
    
    // Find the eval(function(p,a,c,k,e,d) block
    const packedMatch = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\).+?\}\s*\)\s*\)/s);
    if (!packedMatch) {
      throw new Error('MixDrop: Packed script not found');
    }
    
    // Pass the script to our local jsunpack utility
    const unpacked = detectAndUnpack(packedMatch[0]);
    
    // Use regex to isolate the direct media stream URL (wurl="...")
    const wurlMatch = unpacked.match(/wurl\s*=\s*["']([^"']+)["']/);
    if (!wurlMatch || !wurlMatch[1]) {
      throw new Error('MixDrop: Video URL not found in unpacked script');
    }
    
    let videoUrl = wurlMatch[1];
    if (videoUrl.startsWith('//')) {
      videoUrl = `https:${videoUrl}`;
    }
    
    return {
      url: videoUrl,
      type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4'
    };
  } catch (error) {
    throw new Error(`MixDrop extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

class MixDrop extends VideoExtractor {
  protected override serverName = 'MixDrop';
  protected override sources: IVideo[] = [];

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    const result = await extractMixDrop(videoUrl.href);
    this.sources.push({
      url: result.url,
      isM3U8: result.type === 'hls',
      headers: result.headers
    });
    return this.sources;
  };
}

export default MixDrop;
