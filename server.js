const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const { getAccessToken, getPlaylistTracks, updatePlaylistCover, rankTracksByPlayCount } = require('./src/spotify');
const { generateCover } = require('./src/generateCover');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let cachedTracks = null;
let cachedToken = null;

async function getTracksAndToken() {
  if (!cachedToken || !cachedTracks) {
    cachedToken = await getAccessToken();
    const raw = await getPlaylistTracks(cachedToken, process.env.SPOTIFY_PLAYLIST_ID);
    const ranked = await rankTracksByPlayCount(cachedToken, raw);
    const seen = new Set();
    cachedTracks = ranked.filter(t => {
      if (seen.has(t.imageUrl)) return false;
      seen.add(t.imageUrl);
      return true;
    });
  }
  return { token: cachedToken, tracks: cachedTracks };
}

// Preview endpoint — generates cover with given settings, returns base64 image
app.post('/api/preview', async (req, res) => {
  try {
    const { maxTracks, maxRadius, minRadius, padding, background } = req.body;
    const { tracks } = await getTracksAndToken();
    const imageBase64 = await generateCover(tracks, { maxTracks, maxRadius, minRadius, padding, background });
    res.json({ image: imageBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Publish endpoint — uploads current preview to Spotify
app.post('/api/publish', async (req, res) => {
  try {
    const { maxTracks, maxRadius, minRadius, padding, background } = req.body;
    const { token, tracks } = await getTracksAndToken();
    const imageBase64 = await generateCover(tracks, { maxTracks, maxRadius, minRadius, padding, background });
    await updatePlaylistCover(token, process.env.SPOTIFY_PLAYLIST_ID, imageBase64);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Tracks endpoint — returns ranked deduplicated tracks with image URLs
app.get('/api/tracks', async (req, res) => {
  try {
    const { tracks } = await getTracksAndToken();
    res.json(tracks.map(t => ({ imageUrl: t.imageUrl, name: t.name, artist: t.artist, score: t.score })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reload tracks from Spotify (in case playlist changed)
app.post('/api/reload', async (req, res) => {
  cachedTracks = null;
  cachedToken = null;
  try {
    await getTracksAndToken();
    res.json({ ok: true, count: cachedTracks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\nCover generator panel: http://localhost:${PORT}\n`);
});
