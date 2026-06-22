require('dotenv').config();
const { getAccessToken, getPlaylistTracks, updatePlaylistCover, rankTracksByPlayCount } = require('./src/spotify');
const { generateCover } = require('./src/generateCover');

async function run() {
  const playlistId = process.env.SPOTIFY_PLAYLIST_ID;

  console.log('Getting access token...');
  const token = await getAccessToken();

  console.log('Fetching playlist tracks...');
  const tracks = await getPlaylistTracks(token, playlistId);
  console.log(`Found ${tracks.length} tracks`);

  if (tracks.length === 0) {
    console.log('No tracks found, skipping.');
    return;
  }

  console.log('Ranking by play count...');
  const ranked = await rankTracksByPlayCount(token, tracks);

  // Remove duplicate album artwork — keep highest-ranked track per unique image
  const seenImages = new Set();
  const deduplicated = ranked.filter(t => {
    if (seenImages.has(t.imageUrl)) return false;
    seenImages.add(t.imageUrl);
    return true;
  });
  console.log(`After deduplication: ${deduplicated.length} unique artworks`);
  console.log(`Top track: "${ranked[0].name}" by ${ranked[0].artist} (score: ${ranked[0].score})`);

  console.log('Generating cover image...');
  const imageBase64 = await generateCover(deduplicated);

  console.log('Uploading cover to Spotify...');
  await updatePlaylistCover(token, playlistId, imageBase64);

  console.log('Done! Playlist cover updated.');
}

run().catch(console.error);
