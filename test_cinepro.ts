import { CineproAggregator } from './src/lib/extraction/cinepro-aggregator';

async function run() {
  const aggregator = new CineproAggregator();
  console.log("Scraping Shawshank Redemption (TMDB 278)...");
  const sources = await aggregator.scrapeMovie("278");
  console.log(`Found ${sources.length} sources!`);
  console.log(sources);
}

run();
