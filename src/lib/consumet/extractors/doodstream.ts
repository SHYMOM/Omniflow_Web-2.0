import { VideoExtractor, IVideo } from '../models';

export async function extractDoodStream(url: string): Promise<{ url: string; type: 'hls' | 'mp4'; headers?: Record<string, string> }> {
  try {
    const targetUrl = url.replace('/d/', '/e/'); // Ensure we use the embed route
    
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error(`DoodStream failed with status ${res.status}`);
    const html = await res.text();
    
    // 1. Extract MDS token path (e.g. /pass_md5/...)
    const md5Match = html.match(/\$\.get\(['"](\/pass_md5\/[^'"]+)['"]/);
    if (!md5Match || !md5Match[1]) {
      throw new Error('DoodStream: MD5 pass token not found');
    }
    const md5Path = md5Match[1];
    
    // Token is usually the last segment of the md5 path
    const token = md5Path.split('/').pop();
    const domain = new URL(targetUrl).origin;
    
    // 2. Fetch the token validation path
    const md5Res = await fetch(`${domain}${md5Path}`, {
      headers: {
        'Referer': targetUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!md5Res.ok) throw new Error(`DoodStream pass_md5 failed with status ${md5Res.status}`);
    const hostUrl = await md5Res.text();
    
    // 3. Append token and timestamp to bypass hotlinking protection
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomString = "";
    for (let i = 0; i < 10; i++) {
        randomString += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const finalUrl = `${hostUrl}${randomString}?token=${token}&expiry=${timestamp}`;
    
    return {
      url: finalUrl,
      type: 'mp4',
      headers: {
        'Referer': domain + '/'
      }
    };
  } catch (error) {
    throw new Error(`DoodStream extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

class DoodStream extends VideoExtractor {
  protected override serverName = 'DoodStream';
  protected override sources: IVideo[] = [];

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    const result = await extractDoodStream(videoUrl.href);
    this.sources.push({
      url: result.url,
      isM3U8: result.type === 'hls',
      headers: result.headers
    });
    return this.sources;
  };
}

export default DoodStream;
