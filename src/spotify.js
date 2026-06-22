const axios = require('axios');

async function getAccessToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
    {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

async function getPlaylistTracks(accessToken, playlistId) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`;

  while (url) {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = response.data;
    const items = data.items || [];
    for (const item of items) {
      const track = item.track || item.item;
      if (track && track.album && track.album.images.length > 0) {
        tracks.push({
          id: track.id,
          name: track.name,
          artist: track.artists[0].name,
          imageUrl: track.album.images[0].url,
          addedAt: item.added_at,
        });
      }
    }
    url = data.next;
  }

  return tracks;
}

async function updatePlaylistCover(accessToken, playlistId, imageBase64) {
  await axios.put(
    `https://api.spotify.com/v1/playlists/${playlistId}/images`,
    imageBase64,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
    }
  );
}

async function getTopTrackIds(accessToken) {
  const ids = new Map(); // trackId -> rank score (lower = more played)
  const ranges = ['short_term', 'medium_term', 'long_term'];

  for (let ri = 0; ri < ranges.length; ri++) {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${ranges[ri]}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const items = response.data.items || [];
    items.forEach((track, index) => {
      const existing = ids.get(track.id);
      // Weight: short_term counts most (multiplier 3), medium 2, long 1
      const weight = (3 - ri) * (50 - index);
      ids.set(track.id, (existing || 0) + weight);
    });
  }

  return ids; // Map<trackId, score>
}

async function rankTracksByPlayCount(accessToken, tracks) {
  const topIds = await getTopTrackIds(accessToken);

  return tracks
    .map(track => ({
      ...track,
      score: topIds.get(track.id) || 0,
    }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { getAccessToken, getPlaylistTracks, updatePlaylistCover, rankTracksByPlayCount };
