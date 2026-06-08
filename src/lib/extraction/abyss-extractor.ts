import { detectAndUnpack } from './utils/jsunpack';

export interface ExtractorResult {
    url: string;
    type: 'mp4' | 'mkv' | 'm3u8' | 'unknown';
}

/**
 * Extracts the raw media URL from a cyberlocker embed page (e.g., Abyss.to, FileLions)
 * Bypasses standard JS obfuscation to locate the actual video source.
 */
export async function extractCyberlockerMedia(embedUrl: string): Promise<ExtractorResult | null> {
    try {
        // 1. Fetch the target embed page
        const response = await fetch(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch embed URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        // 2. Extract all script tags
        const scriptMatches = html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);

        for (const match of scriptMatches) {
            const scriptContent = match[1];

            // 3. Detect and unpack P.A.C.K.E.R. obfuscated scripts
            let decodedScript = scriptContent;
            if (scriptContent.includes('eval(function(p,a,c,k,e,d)')) {
                try {
                    decodedScript = detectAndUnpack(scriptContent);
                } catch (unpackError) {
                    console.warn("Failed to unpack script payload", unpackError);
                    continue; // Try the next script element if this one fails
                }
            }

            // 4. Look for the raw media URL in the decoded script
            // Matches standard video file types and HLS playlists
            const videoUrlRegex = /(https:\/\/[^\s"'<>]+\.(?:mp4|mkv|m3u8)[^\s"'<>]*)/i;
            const urlMatch = decodedScript.match(videoUrlRegex);

            if (urlMatch && urlMatch[1]) {
                // Clean up the URL (removing potential backslash escaping)
                const rawUrl = urlMatch[1].replace(/\\/g, '');

                return {
                    url: rawUrl,
                    type: determineType(rawUrl)
                };
            }
        }

        // 5. Fallback: Search the entire raw HTML for un-obfuscated media URLs
        const fallbackMatch = html.match(/(https:\/\/[^\s"'<>]+\.(?:mp4|mkv|m3u8)[^\s"'<>]*)/i);
        if (fallbackMatch && fallbackMatch[1]) {
            const rawUrl = fallbackMatch[1].replace(/\\/g, '');
            return { 
                url: rawUrl, 
                type: determineType(rawUrl) 
            };
        }

        return null; // URL not found
    } catch (error) {
        console.error("Cyberlocker extraction error:", error);
        return null;
    }
}

function determineType(url: string): ExtractorResult['type'] {
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.mkv')) return 'mkv';
    if (url.includes('.m3u8')) return 'm3u8';
    return 'unknown';
}
