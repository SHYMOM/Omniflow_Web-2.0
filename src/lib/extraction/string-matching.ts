export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')           // remove punctuation
    .replace(/\s+/g, ' ')              // collapse whitespace
    .replace(/\bseason\s+\d+\b/i, '')  // strip "Season X"
    .replace(/\bpart\s+\d+\b/i, '')    // strip "Part X"
    .replace(/\bthe\s+final\s+season\b/i, '') // strip "The Final Season"
    .replace(/\bcour\s+\d+\b/i, '')    // strip "Cour X"
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;
  
  const distance = levenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);
  if (maxLength === 0) return 1.0;
  
  return 1 - (distance / maxLength);
}

export interface ProviderSearchResult {
  title: string;
  id: string;
  [key: string]: any;
}

export function findBestMatch(query: string | string[], candidates: ProviderSearchResult[]): { match: ProviderSearchResult | null; score: number; index: number } {
  if (!candidates || candidates.length === 0) return { match: null, score: 0, index: -1 };
  
  const queries = Array.isArray(query) ? query : [query];
  let bestMatch = null;
  let bestScore = -1;
  let bestIndex = -1;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    for (const q of queries) {
      if (!q) continue;
      const score = titleSimilarity(q, candidate.title);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
        bestIndex = i;
      }
    }
  }

  // Reject anything below 0.82 as requested
  if (bestScore < 0.82) {
    return { match: null, score: bestScore, index: -1 };
  }

  return { match: bestMatch, score: bestScore, index: bestIndex };
}

export function disambiguateMedia(
  query: string | string[],
  metadata: { title: string; season?: number; year?: number; totalEpisodes?: number },
  candidates: ProviderSearchResult[]
): ProviderSearchResult | null {
  if (!candidates || candidates.length === 0) return null;
  
  let bestMatch = null;
  let bestScore = -1;

  const queries = Array.isArray(query) ? query : [query, metadata.title];

  for (const candidate of candidates) {
    let titleScore = 0;
    for (const q of queries) {
      if (!q) continue;
      const score = titleSimilarity(q, candidate.title);
      if (score > titleScore) titleScore = score;
    }

    let seasonScore = 0;
    if (metadata.season) {
      const candidateSeasonMatch = candidate.title.match(/season\s+(\d+)/i) || candidate.title.match(/s(\d+)/i) || candidate.title.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
      if (candidateSeasonMatch) {
        const candidateSeason = parseInt(candidateSeasonMatch[1], 10);
        if (candidateSeason === metadata.season) seasonScore = 1;
        else seasonScore = -0.5; // Penalty for wrong season
      } else if (metadata.season === 1) {
        seasonScore = 0.5; // If candidate has no season, assume season 1
      }
    } else {
      seasonScore = 0.5; // No season data to compare
    }

    let yearScore = 0.5; // default neutral
    if (metadata.year && candidate.year) {
      if (metadata.year === candidate.year) yearScore = 1;
      else if (Math.abs(metadata.year - candidate.year) === 1) yearScore = 0.8;
      else yearScore = 0;
    } else if (metadata.year && candidate.releaseDate) {
       const candidateYear = new Date(candidate.releaseDate).getFullYear();
       if (candidateYear === metadata.year) yearScore = 1;
       else if (Math.abs(metadata.year - candidateYear) === 1) yearScore = 0.8;
       else yearScore = 0;
    }

    // Weighting: Title (50%), Season (30%), Year (20%)
    const totalScore = (titleScore * 0.5) + (seasonScore * 0.3) + (yearScore * 0.2);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = candidate;
    }
  }

  // Reject if score is below 0.75
  if (bestScore < 0.75) {
    return null;
  }

  return bestMatch;
}
