import { buildSyntheticM3U8 } from '../utils/serverBuilder';

export class FileHostResolver {
  /**
   * Resolves Gofile direct link using guest API token
   */
  async resolveGofile(url: string): Promise<string | null> {
    try {
      const idMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      const contentId = idMatch[1];

      // 1. Get Guest Token
      const tokenRes = await fetch('https://api.gofile.io/createAccount', { method: 'POST' });
      if (!tokenRes.ok) return null;
      const tokenData = await tokenRes.json();
      const token = tokenData.data?.token;
      if (!token) return null;

      // 2. Fetch content details
      const contentRes = await fetch(`https://api.gofile.io/getContent?contentId=${contentId}&token=${token}&wt=4fd6sg89d7s6`);
      if (!contentRes.ok) return null;
      const contentData = await contentRes.json();
      
      const contents = contentData.data?.contents;
      if (!contents) return null;

      // Find the first video file
      const fileId = Object.keys(contents).find(key => contents[key].mimetype?.includes('video/'));
      if (!fileId) return null;

      const directLink = contents[fileId].link;
      return directLink;
    } catch (e) {
      console.error('[FileHostResolver] Gofile resolution failed', e);
      return null;
    }
  }

  /**
   * Resolves PixelDrain direct link
   */
  async resolvePixelDrain(url: string): Promise<string | null> {
    try {
      const idMatch = url.match(/pixeldrain\.com\/u\/([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      const id = idMatch[1];
      
      return `https://pixeldrain.com/api/file/${id}`;
    } catch (e) {
      console.error('[FileHostResolver] PixelDrain resolution failed', e);
      return null;
    }
  }

  /**
   * Resolves MediaFire direct link
   */
  async resolveMediaFire(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      const text = await res.text();
      // Look for the download button href
      const match = text.match(/href="([^"]+)"\s+id="downloadButton"/);
      if (match && match[1]) {
        return match[1];
      }
      return null;
    } catch (e) {
      console.error('[FileHostResolver] MediaFire resolution failed', e);
      return null;
    }
  }

  /**
   * Master resolver function
   */
  async resolve(url: string, title?: string): Promise<{ streamUrl: string; type: 'hls' | 'mp4' } | null> {
    let rawUrl: string | null = null;
    let type: 'hls' | 'mp4' = 'mp4';

    try {
      if (url.includes('gofile.io')) {
        rawUrl = await this.resolveGofile(url);
      } else if (url.includes('pixeldrain.com')) {
        rawUrl = await this.resolvePixelDrain(url);
      } else if (url.includes('mediafire.com')) {
        rawUrl = await this.resolveMediaFire(url);
      } else if (url.includes('streamwish')) {
        // Assume streamwish resolver exists or we just proxy it
        // Stub implementation
        rawUrl = null; 
      } else if (url.includes('streamtape')) {
        rawUrl = null;
      }
      
      if (!rawUrl) return null;

      if (type === 'mp4') {
        // Return a proxied URL for the synthetic M3U8
        // Using /api/stream/proxy/ directly
        const proxiedMp4 = `/api/stream/proxy?url=${encodeURIComponent(rawUrl)}`;
        const syntheticM3u8 = buildSyntheticM3U8(proxiedMp4, title);
        
        // Since we can't easily return a blob URL from the server, 
        // we encode the m3u8 as a data URI to be played by HLS.js
        const dataUri = `data:application/vnd.apple.mpegurl;base64,${Buffer.from(syntheticM3u8).toString('base64')}`;
        return { streamUrl: dataUri, type: 'hls' };
      }

      return { streamUrl: rawUrl, type: 'hls' };
    } catch (err) {
      console.error('[FileHostResolver] Master resolve failed for', url, err);
      return null;
    }
  }
}
