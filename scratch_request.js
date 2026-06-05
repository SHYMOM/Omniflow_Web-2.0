const http = require('http');

http.get('http://localhost:3000/api/test-cinepro?tmdbId=tmdb-movie-1083381&imdbId=tt26657236', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('DATA:', data);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
