import type { Server, ServerPattern } from '@/types/server';

/**
 * Build an embed URL from a server definition and media identifiers
 */
export function buildEmbedUrl(
  server: Server,
  params: {
    type: 'movie' | 'tv' | 'anime_sub' | 'anime_dub' | 'manga';
    tmdbId?: number;
    malId?: number;
    season?: number;
    episode?: number;
    chapter?: number;
  }
): string | null {
  const pattern = server.patterns[params.type as keyof ServerPattern];
  if (!pattern) return null;

  let url = `${server.baseUrl}${pattern}`;

  // Replace placeholders
  if (params.tmdbId) url = url.replace('{tmdbId}', String(params.tmdbId));
  if (params.malId != null) {
    url = url.replace('{malId}', String(params.malId || params.tmdbId || ''));
  }
  if (params.season != null) url = url.replace('{season}', String(params.season));
  if (params.episode != null) url = url.replace('{episode}', String(params.episode));
  if (params.chapter != null) url = url.replace('{chapter}', String(params.chapter));

  return url;
}

/**
 * Get the recommended server from a list
 */
export function getRecommendedServer(servers: Server[]): Server | undefined {
  return servers.find(s => s.recommended && s.status === 'active') || servers.find(s => s.status === 'active');
}

/**
 * Check if a server supports a given content type
 */
export function serverSupportsType(server: Server, type: keyof ServerPattern): boolean {
  return !!server.patterns[type];
}
