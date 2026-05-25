import { ANIME, StreamingServers } from './src/lib/consumet';

async function test() {
  const gogo = new ANIME.Gogoanime();
  const searchRes = await gogo.search("Tongari Boushi no Atelier");
  console.log("Search Res:", JSON.stringify(searchRes.results, null, 2));
}
test();
