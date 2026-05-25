import { config } from 'dotenv';
config();
import { StremioExtractor } from './src/lib/extraction/stremio-extractor';

async function run() {
  const extractor = new StremioExtractor();
  console.log("Scraping Shawshank Redemption (TMDB 278) via MediaFusion...");
  const result = await extractor.extractDirectStream("278", "movie");
  if (result.success) {
    console.log(`Found ${result.sources.length} sources!`);
    console.log(result.sources);
  } else {
    console.log("No streams found.");
  }
}

run();
