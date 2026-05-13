/**
 * Format a date string or date parts into human-readable format
 */
export function formatDate(dateStr?: string | null, dateParts?: { year: number | null; month: number | null; day: number | null }): string {
  if (dateParts) {
    if (!dateParts.year) return '?';
    const parts: string[] = [];
    if (dateParts.month) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      parts.push(monthNames[dateParts.month - 1]);
    }
    if (dateParts.day) parts.push(`${dateParts.day},`);
    parts.push(String(dateParts.year));
    return parts.join(' ');
  }
  if (!dateStr) return '?';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Normalize score to 0-10 scale
 * AniList: 0-100, TMDB: 0-10, MAL: 0-10
 */
export function normalizeScore(score: number | null | undefined, source: 'anilist' | 'tmdb' | 'jikan' = 'anilist'): number {
  if (score == null || score === 0) return 0;
  if (source === 'anilist') return Math.round(score) / 10; // 87 → 8.7
  return Math.round(score * 10) / 10; // 8.71 → 8.7
}

/**
 * Format score for display (e.g., "8.7")
 */
export function formatScore(score: number): string {
  if (score === 0) return 'N/A';
  return score.toFixed(1);
}

/**
 * Format score as percentage for hero badge (e.g., "87%")
 */
export function formatScorePercent(score: number | null | undefined, source: 'anilist' | 'tmdb' = 'anilist'): string {
  if (score == null || score === 0) return 'N/A';
  if (source === 'anilist') return `${Math.round(score)}%`;
  return `${Math.round(score * 10)}%`;
}

/**
 * Format duration (minutes → "24 min" or "1h 32m")
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '?';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format episode number (e.g., "Ep 5")
 */
export function formatEpisodeNumber(num: number, prefix = 'Ep'): string {
  return `${prefix} ${num}`;
}

/**
 * Format view count (e.g., 470000 → "470K", 1200 → "1.2K")
 */
export function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1)}K`;
  return String(count);
}

/**
 * Format relative time (e.g., "2h ago", "3 days ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffYear > 0) return `${diffYear}y ago`;
  if (diffMonth > 0) return `${diffMonth}mo ago`;
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
}

/**
 * Format countdown (e.g., "in 4 days", "in 2 months")
 */
export function formatCountdown(targetTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = targetTimestamp - now;
  if (diff <= 0) return 'now';
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  
  if (days > 30) return `${Math.floor(days / 30)} months`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

/**
 * Map AniList format to display label
 */
export function formatMediaType(format: string): string {
  const map: Record<string, string> = {
    'TV': 'TV Show',
    'TV_SHORT': 'TV Short',
    'MOVIE': 'Movie',
    'SPECIAL': 'Special',
    'OVA': 'OVA',
    'ONA': 'ONA',
    'MUSIC': 'Music',
    'MANGA': 'Manga',
    'NOVEL': 'Light Novel',
    'ONE_SHOT': 'One Shot',
  };
  return map[format] || format;
}

/**
 * Format season + year (e.g., "FALL 1999")
 */
export function formatSeason(season?: string | null, year?: number | null): string {
  if (!season && !year) return '?';
  if (!season) return String(year);
  return `${season} ${year || '?'}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Build TMDB image URL
 */
export function tmdbImageUrl(path: string | null | undefined, size: string = 'w500'): string {
  if (!path) return '/placeholder-poster.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
