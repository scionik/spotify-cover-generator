require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;
const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'playlist-read-private ugc-image-upload user-top-read';

app.get('/login', (req, res) => {
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', SPOTIFY_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  res.redirect(url.toString());
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { refresh_token } = response.data;
    console.log('\n✅ Got your refresh token:\n');
    console.log(refresh_token);
    console.log('\nAdd this to your .env file as SPOTIFY_REFRESH_TOKEN=<token above>\n');
    res.send('<h2>Success! Check your terminal for the refresh token. You can close this tab.</h2>');
    process.exit(0);
  } catch (err) {
    res.send('Error: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`\nOpen this in your browser to authorize:\nhttp://localhost:${PORT}/login\n`);
});
