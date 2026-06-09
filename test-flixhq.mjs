import { MOVIES } from './src/lib/consumet/index.js';

async function test() {
  const flix = new MOVIES.FlixHQ();
  try {
    const search = await flix.search('Hollow Man');
    console.log('Search:', search);
  } catch(e) {
    console.error(e);
  }
}
test();
