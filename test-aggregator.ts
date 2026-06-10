import 'dotenv/config';
import { UniversalAggregatorService } from './src/lib/extraction/universal-aggregator.service';

async function test() {
  const service = new UniversalAggregatorService();
  console.log("Aggregating...");
  const result = await service.aggregate('anilist-147105', 'anime', 1, 1, 'sub');
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
