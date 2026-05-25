import { makeProviders, makeStandardFetcher, targets } from '@movie-web/providers';

async function test() {
  const fetcher = makeStandardFetcher(fetch);
  const providers = makeProviders({
    fetcher,
    target: targets.ANY,
  });

  const media = {
    type: 'movie' as const,
    title: 'Fight Club',
    releaseYear: 1999,
    tmdbId: '550',
  };

  console.log('Running extraction...');
  try {
    const result = await providers.runAll({
      media: media,
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
