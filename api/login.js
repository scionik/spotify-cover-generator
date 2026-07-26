module.exports = (req, res) => {
  const { SPOTIFY_CLIENT_ID, BASE_URL } = process.env;
  const redirectUri = `${BASE_URL}/api/callback`;
  const scopes = 'playlist-read-private ugc-image-upload user-top-read user-read-private';
  const state = Math.random().toString(36).slice(2);

  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', SPOTIFY_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);

  res.setHeader('Set-Cookie', `sp_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  res.redirect(url.toString());
};
