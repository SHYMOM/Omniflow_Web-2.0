const fetchTest = async () => {
    const imdbId = 'tt0111161'; // The Shawshank Redemption
    const res = await fetch(`https://opensubtitles-v3.strem.io/subtitles/movie/${imdbId}.json`);
    const data = await res.json();
    console.log(JSON.stringify(data.subtitles?.slice(0, 2), null, 2));
};

fetchTest();
