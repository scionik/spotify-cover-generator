const { clearTokenCookies } = require('./_utils');

module.exports = (req, res) => {
  clearTokenCookies(res);
  res.redirect('/');
};
