const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const db = require('../db');
const requireAdmin = require('../middleware/adminAuth');
const { uploadDir } = require('../middleware/upload');

const router = express.Router();
router.use(express.json());

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(uploadDir, filename);
  fs.promises.unlink(filePath).catch(() => {});
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ isAdmin: true });
  }
  res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ isAdmin: false });
});

// GET /api/admin/session
router.get('/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// DELETE /api/admin/posts/:id  (비밀번호 없이 강제 삭제)
router.delete('/posts/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

  deleteImageFile(post.image_url);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  res.status(204).send();
});

// DELETE /api/admin/comments/:id  (비밀번호 없이 강제 삭제)
router.delete('/comments/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  if (!comment) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  res.status(204).send();
});

module.exports = router;
