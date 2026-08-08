function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: '관리자 인증이 필요합니다.' });
}

module.exports = requireAdmin;
