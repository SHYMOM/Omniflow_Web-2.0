import { MOVIES } from './src/lib/consumet';

async function test() {
  const mhdw = new MOVIES.MovieHdWatch();
  console.log("Searching for Crash Landing on You Hindi...");
  const res = await mhdw.search("Crash Landing on You Hindi");
  console.log(res);
}

test().catch(console.error);
