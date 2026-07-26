const axios = require('axios');
const { setTokenCookies } = require('./_utils');

module.exports = async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) return res.redirect('/?error=access_denied');

  const redirectUri = `${process.env.BASE_URL}/api/callback`;

  try {
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    setTokenCookies(res, data.access_token, data.refresh_token, data.expires_in);
    res.redirect('/');
  } catch (err) {
    res.redirect('/?error=auth_failed');
  }
};
