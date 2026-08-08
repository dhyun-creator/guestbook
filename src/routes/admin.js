const express = require('express');
const { pool } = require('../db');
const requireAdmin = require('../middleware/adminAuth');
const { deleteBlobIfExists } = require('../middleware/upload');
const { parseCookies } = require('../cookies');
const { createAdminToken, verifyAdminToken, MAX_AGE_MS } = require('../adminToken');

const router = express.Router();
router.use(express.json());

function cookieAttributes() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}${secure}`;
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || !process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
  }
  const token = createAdminToken();
  res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; ${cookieAttributes()}`);
  res.json({ isAdmin: true });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0');
  res.json({ isAdmin: false });
});

// GET /api/admin/session
router.get('/session', (req, res) => {
  const cookies = parseCookies(req);
  res.json({ isAdmin: verifyAdminToken(cookies.admin_token) });
});

// DELETE /api/admin/posts/:id  (비밀번호 없이 강제 삭제)
router.delete('/posts/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    const post = rows[0];
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

    await deleteBlobIfExists(post.image_url);
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/comments/:id  (비밀번호 없이 강제 삭제)
router.delete('/comments/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

    await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
