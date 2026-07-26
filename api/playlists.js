const axios = require('axios');
const { getValidToken } = require('./_utils');

module.exports = async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const playlists = [];
    let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
    while (url) {
      const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      for (const p of data.items) {
        if (!p) continue;
        playlists.push({
          id: p.id,
          name: p.name,
          trackCount: p.tracks.total,
          image: p.images?.[0]?.url || null,
        });
      }
      url = data.next;
    }
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
