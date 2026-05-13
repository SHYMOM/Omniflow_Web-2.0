// ═══════════════════════════════════════════════════════════════
// Video Embed Server Types
// ═══════════════════════════════════════════════════════════════

export interface ServerPattern {
  movie?: string;
  tv?: string;
  anime_sub?: string;
  anime_dub?: string;
  manga?: string;
}

export interface Server {
  id: string;
  name: string;
  baseUrl: string;
  patterns: ServerPattern;
  quality: string[];             // ["1080p", "720p", "480p"]
  features: string[];            // ["sub", "dub", "download"]
  recommended: boolean;
  status: 'active' | 'inactive';
}
