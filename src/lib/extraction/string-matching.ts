export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
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

export function findBestMatch(target: string, candidates: { title: string; [key: string]: any }[]): any | null {
  if (!candidates || candidates.length === 0) return null;
  
  const targetClean = target.toLowerCase().trim();

  // 1. Check for exact match first
  for (const candidate of candidates) {
    const candidateClean = candidate.title.toLowerCase().trim();
    if (candidateClean === targetClean) return candidate;
  }

  // 2. Check for best inclusion match (minimizing the length difference to find the closest subset/superset)
  let bestInclusiveMatch = null;
  let shortestLengthDiff = Infinity;
  for (const candidate of candidates) {
    const candidateClean = candidate.title.toLowerCase().trim();
    if (candidateClean.includes(targetClean) || targetClean.includes(candidateClean)) {
      const lengthDiff = Math.abs(candidateClean.length - targetClean.length);
      if (lengthDiff < shortestLengthDiff) {
        shortestLengthDiff = lengthDiff;
        bestInclusiveMatch = candidate;
      }
    }
  }
  if (bestInclusiveMatch) return bestInclusiveMatch;

  // 3. Fallback to Levenshtein distance
  let bestMatch = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const candidateClean = candidate.title.toLowerCase().trim();
    const distance = levenshteinDistance(targetClean, candidateClean);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = candidate;
    }
  }

  // Only return if the distance is somewhat reasonable (e.g., less than 10 edits)
  return minDistance < 10 ? bestMatch : null;
}
