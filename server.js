const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cron = require('node-cron');
const { getAccessToken, getPlaylistTracks, updatePlaylistCover, rankTracksByPlayCount } = require('./src/spotify');
const { generateCover } = require('./src/generateCover');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let cachedTracks = null;
let cachedToken = null;
// Fingerprint of the last track list we pushed a cover for
let lastPushedFingerprint = null;

function trackFingerprint(tracks) {
  return tracks.map(t => t.id || t.imageUrl).join(',');
}

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

async function autoPush() {
  try {
    console.log('[auto-push] Checking playlist…');
    // Force a fresh fetch
    cachedTracks = null;
    cachedToken = null;
    const { token, tracks } = await getTracksAndToken();
    const fingerprint = trackFingerprint(tracks);

    if (fingerprint === lastPushedFingerprint) {
      console.log('[auto-push] No changes, skipping.');
      return;
    }

    console.log(`[auto-push] Playlist changed (${tracks.length} tracks), generating cover…`);
    const imageBase64 = await generateCover(tracks);
    await updatePlaylistCover(token, process.env.SPOTIFY_PLAYLIST_ID, imageBase64);
    lastPushedFingerprint = fingerprint;
    console.log('[auto-push] Cover updated on Spotify ✓');
  } catch (err) {
    console.error('[auto-push] Error:', err.message);
  }
}

// Run every hour at :00
cron.schedule('0 * * * *', autoPush);

// Also push once on server start
autoPush();

// ── Routes ────────────────────────────────────────────────────────────────────

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

app.post('/api/publish', async (req, res) => {
  try {
    const { maxTracks, maxRadius, minRadius, padding, background } = req.body;
    const { token, tracks } = await getTracksAndToken();
    const imageBase64 = await generateCover(tracks, { maxTracks, maxRadius, minRadius, padding, background });
    await updatePlaylistCover(token, process.env.SPOTIFY_PLAYLIST_ID, imageBase64);
    lastPushedFingerprint = trackFingerprint(tracks);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tracks', async (req, res) => {
  try {
    const { tracks } = await getTracksAndToken();
    res.json(tracks.map(t => ({ imageUrl: t.imageUrl, name: t.name, artist: t.artist, score: t.score })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Manual trigger for auto-push (useful for testing)
app.post('/api/auto-push', async (req, res) => {
  try {
    await autoPush();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\nCover generator panel: http://localhost:${PORT}\n`);
});
