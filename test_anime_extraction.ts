import 'dotenv/config';
import { AnimeExtractionService } from './src/lib/extraction/anime-extraction.service';

async function test() {
  const service = new AnimeExtractionService();
  try {
    const res = await service.extractSources({
      mediaId: 'anilist-147105',
      title: 'Tongari Boushi no Atelier',
      episode: 1,
      mediaType: 'anime',
      language: 'sub'
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
