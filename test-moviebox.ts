import { MovieboxExtractor } from './src/lib/extraction/moviebox-extractor';
async function test() {
  const extractor = new MovieboxExtractor();
  try {
    const stream = await extractor.extractDirectStream('Hollow Man', 'movie', 1, 1);
    console.log(stream);
  } catch (e) {
    console.error(e);
  }
}
test();
