const axios = require('axios');
const { getValidToken } = require('./_utils');

module.exports = async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json({ name: data.display_name, image: data.images?.[0]?.url || null });
  } catch {
    res.status(401).json({ error: 'Token invalid' });
  }
};
