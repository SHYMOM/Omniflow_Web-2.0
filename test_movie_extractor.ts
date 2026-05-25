import { config } from 'dotenv';
config();
import { MovieExtractionService } from './src/lib/extraction/movie-extraction.service';

(async () => {
  const service = new MovieExtractionService();
  console.log('Testing movie extraction for TMDB 550...');
  
  try {
    const result = await service.extractSources({
      mediaId: 'tmdb-movie-550',
      mediaType: 'movie',
      episode: 1,
      season: 1,
      title: 'Fight Club'
    });
    console.log('Result:', result.success ? 'Success!' : 'Failed', result.provider);
    if (!result.success) {
      console.log('Error data:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
})();
