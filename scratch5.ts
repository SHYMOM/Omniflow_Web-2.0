import { MovieboxExtractor } from './src/lib/extraction/moviebox-extractor';

async function test() {
  const p = new MovieboxExtractor();
  console.log("Testing Moviebox...");
  const res = await p.extractDirectStream("Crash Landing on You", "tv", 1, 1);
  console.log("Sources:", res.sources.length);
  if (res.sources.length > 0) {
    console.log("Audio Tracks:", res.sources[0].audioTracks);
  }
}

test().catch(console.error);
