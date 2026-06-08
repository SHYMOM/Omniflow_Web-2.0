import { VideoExtractor, IVideo } from '../models';

export async function extractStreamTape(url: string): Promise<{ url: string; type: 'hls' | 'mp4'; headers?: Record<string, string> }> {
  try {
    // Streamtape URL format correction
    const targetUrl = url.replace('/v/', '/e/');
    
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error(`StreamTape failed with status ${res.status}`);
    const html = await res.text();
    
    // Implement regex matching to capture the segmented video path variables (ID selector 'robotlink')
    // document.getElementById('robotlink').innerHTML = '//streamtape.com/get_video?...' + ('&expires=...').substring(3);
    const tokenRegex = html.match(/getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(['"]([^'"]+)['"]\.substring/);
    
    if (!tokenRegex || !tokenRegex[1] || !tokenRegex[2]) {
      // Try alternate structure without substring
      const altRegex = html.match(/getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*['"]([^'"]+)['"]/);
      if (altRegex && altRegex[1] && altRegex[2]) {
         let finalUrl = altRegex[1] + altRegex[2];
         if (finalUrl.startsWith('//')) finalUrl = `https:${finalUrl}`;
         return { url: finalUrl, type: 'mp4' };
      }
      throw new Error('StreamTape: Robotlink structure not found');
    }
    
    // Dynamically combine the string components, adjusting for the .substring() shift (usually 2 or 3)
    // Often it is .substring(1), (2), or (3). If we capture the whole appended string, we'll strip the leading characters.
    // If the substring parameter isn't statically parsed, we'll default to 3 as it's the most common StreamTape offset.
    const substrParamMatch = html.match(/\+\s*\(['"][^'"]+['"]\.substring\(\s*(\d+)\s*\)/);
    const shift = substrParamMatch ? parseInt(substrParamMatch[1], 10) : 3;
    
    let finalUrl = tokenRegex[1] + tokenRegex[2].substring(shift);
    if (finalUrl.startsWith('//')) {
      finalUrl = `https:${finalUrl}`;
    }
    
    return {
      url: finalUrl,
      type: 'mp4'
    };
  } catch (error) {
    throw new Error(`StreamTape extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

class StreamTape extends VideoExtractor {
  protected override serverName = 'StreamTape';
  protected override sources: IVideo[] = [];

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    const result = await extractStreamTape(videoUrl.href);
    this.sources.push({
      url: result.url,
      isM3U8: result.type === 'hls',
      headers: result.headers
    });
    return this.sources;
  };
}

export default StreamTape;
