import { MOVIES } from './src/lib/consumet';

async function test() {
  const p = new MOVIES.SmashyStream();
  console.log("Testing Smashy...");
  // 94796 is TMDB ID for Crash Landing on You
  const res = await p.fetchEpisodeSources('94796', 1, 1);
  console.log("Sources:", res.sources.length);
  console.log(res.sources[0]);
}

test().catch(console.error);
