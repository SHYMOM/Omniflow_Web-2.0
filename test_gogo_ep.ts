import { ANIME, StreamingServers } from './src/lib/consumet';

async function test() {
  const gogo = new ANIME.Gogoanime();
  const info = await gogo.fetchAnimeInfo("witch-hat-atelier");
  console.log("Episodes:", JSON.stringify(info.episodes, null, 2));
}
test();
