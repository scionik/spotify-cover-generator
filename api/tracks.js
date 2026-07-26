const axios = require('axios');
const { getValidToken } = require('./_utils');

module.exports = async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { playlistId } = req.query;
  if (!playlistId) return res.status(400).json({ error: 'Missing playlistId' });

  try {
    const tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`;
    while (url) {
      const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      for (const item of data.items) {
        const track = item?.track;
        if (track?.album?.images?.length) {
          tracks.push({
            id: track.id,
            name: track.name,
            artist: track.artists?.[0]?.name || '',
            imageUrl: track.album.images[0].url,
            addedAt: item.added_at,
          });
        }
      }
      url = data.next;
    }

    // Deduplicate by imageUrl
    const seen = new Set();
    const unique = tracks.filter(t => {
      if (seen.has(t.imageUrl)) return false;
      seen.add(t.imageUrl);
      return true;
    });

    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
