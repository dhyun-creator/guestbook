const { parseCookies } = require('../cookies');
const { verifyAdminToken } = require('../adminToken');

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  if (verifyAdminToken(cookies.admin_token)) return next();
  res.status(401).json({ error: '관리자 인증이 필요합니다.' });
}

module.exports = requireAdmin;
