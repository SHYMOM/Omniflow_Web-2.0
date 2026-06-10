import { MOVIES } from './src/lib/consumet';

async function test() {
  const flix = new MOVIES.FlixHQ();
  try {
    const search = await flix.search('Hollow Man');
    console.log('Search:', search);
    if(search.results.length > 0) {
      const info = await flix.fetchMediaInfo(search.results[0].id);
      console.log('Info:', info);
      const sources = await flix.fetchEpisodeSources(info.episodes?.[0]?.id || '', info.id);
      console.log('Sources:', sources);
    }
  } catch(e) {
    console.error(e);
  }
}
test();
