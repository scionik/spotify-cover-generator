const axios = require('axios');

function parseCookies(req) {
  const str = req.headers.cookie || '';
  const cookies = {};
  for (const part of str.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  }
  return cookies;
}

function setTokenCookies(res, accessToken, refreshToken, expiresIn = 3600) {
  const expiry = Date.now() + expiresIn * 1000 - 60000; // 1 min early
  const base = 'HttpOnly; Secure; SameSite=Lax; Path=/';
  res.setHeader('Set-Cookie', [
    `sp_at=${encodeURIComponent(accessToken)}; ${base}; Max-Age=${expiresIn}`,
    `sp_rt=${encodeURIComponent(refreshToken)}; ${base}; Max-Age=${60 * 60 * 24 * 30}`,
    `sp_exp=${expiry}; ${base}; Max-Age=${60 * 60 * 24 * 30}`,
  ]);
}

function clearTokenCookies(res) {
  const base = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
  res.setHeader('Set-Cookie', [
    `sp_at=; ${base}`,
    `sp_rt=; ${base}`,
    `sp_exp=; ${base}`,
  ]);
}

async function getValidToken(req, res) {
  const cookies = parseCookies(req);
  const accessToken = cookies.sp_at;
  const refreshToken = cookies.sp_rt;
  const expiry = parseInt(cookies.sp_exp || '0', 10);

  if (!refreshToken) return null;

  // Return access token if not yet expired
  if (accessToken && Date.now() < expiry) return accessToken;

  // Refresh
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    const { access_token, refresh_token: newRt, expires_in } = response.data;
    setTokenCookies(res, access_token, newRt || refreshToken, expires_in);
    return access_token;
  } catch {
    return null;
  }
}

module.exports = { parseCookies, setTokenCookies, clearTokenCookies, getValidToken };
