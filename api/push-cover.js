const axios = require('axios');
const { getValidToken } = require('./_utils');

module.exports = async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { playlistId, imageBase64 } = req.body || {};
  if (!playlistId || !imageBase64) return res.status(400).json({ error: 'Missing fields' });

  // Strip data URI prefix
  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  try {
    await axios.put(
      `https://api.spotify.com/v1/playlists/${playlistId}/images`,
      base64,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        maxBodyLength: 4 * 1024 * 1024,
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
};
