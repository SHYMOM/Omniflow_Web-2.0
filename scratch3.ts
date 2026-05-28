import { VidNestProvider } from './src/lib/extraction/cinepro-providers/vidnest/vidnest';

async function test() {
  const p = new VidNestProvider();
  console.log("Testing VidNest...");
  const res = await p.getTVSources({ type: 'tv', tmdbId: '94796', s: 1, e: 1 } as any);
  console.log("Sources:", res.sources.length);
  console.log("Subtitles length:", res.subtitles.length);
  if (res.subtitles.length > 0) {
    console.log("First sub:", res.subtitles[0]);
  }
}

test().catch(console.error);
