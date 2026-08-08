const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../hash');
const { upload, uploadDir } = require('../middleware/upload');

const router = express.Router();

const NICKNAME_MAX = 20;
const CONTENT_MAX = 500;
const PAGE_SIZE = 10;

function sanitizePost(post) {
  const { password_hash, ...rest } = post;
  return rest;
}

function sanitizeComment(comment) {
  const { password_hash, ...rest } = comment;
  return rest;
}

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(uploadDir, filename);
  fs.promises.unlink(filePath).catch(() => {});
}

function validateNicknameAndContent(nickname, content, contentMax, res) {
  if (!nickname || !nickname.trim()) {
    res.status(400).json({ error: '이름/별명을 입력해주세요.' });
    return false;
  }
  if (nickname.trim().length > NICKNAME_MAX) {
    res.status(400).json({ error: `이름/별명은 최대 ${NICKNAME_MAX}자까지 입력 가능합니다.` });
    return false;
  }
  if (!content || !content.trim()) {
    res.status(400).json({ error: '내용을 입력해주세요.' });
    return false;
  }
  if (content.trim().length > contentMax) {
    res.status(400).json({ error: `내용은 최대 ${contentMax}자까지 입력 가능합니다.` });
    return false;
  }
  return true;
}

// GET /api/posts?page=1
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const totalRow = db.prepare('SELECT COUNT(*) AS count FROM posts').get();
  const total = totalRow.count;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  const posts = db
    .prepare('SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(PAGE_SIZE, offset);

  const commentsStmt = db.prepare(
    'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC, id ASC'
  );

  const result = posts.map((post) => ({
    ...sanitizePost(post),
    comments: commentsStmt.all(post.id).map(sanitizeComment),
  }));

  res.json({ posts: result, page, totalPages, total });
});

// POST /api/posts
router.post('/', upload.single('image'), (req, res) => {
  const { nickname, password, passwordConfirm, content } = req.body;

  if (!validateNicknameAndContent(nickname, content, CONTENT_MAX, res)) return;

  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const passwordHash = hashPassword(password);

  const info = db
    .prepare(
      'INSERT INTO posts (nickname, password_hash, content, image_url) VALUES (?, ?, ?, ?)'
    )
    .run(nickname.trim(), passwordHash, content.trim(), imageUrl);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...sanitizePost(post), comments: [] });
});

// PUT /api/posts/:id
router.put('/:id', upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

  const { nickname, password, content, removeImage } = req.body;

  if (!password || !verifyPassword(password, post.password_hash)) {
    return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  if (!validateNicknameAndContent(nickname, content, CONTENT_MAX, res)) return;

  let imageUrl = post.image_url;
  if (req.file) {
    deleteImageFile(post.image_url);
    imageUrl = `/uploads/${req.file.filename}`;
  } else if (removeImage === 'true') {
    deleteImageFile(post.image_url);
    imageUrl = null;
  }

  db.prepare(
    "UPDATE posts SET nickname = ?, content = ?, image_url = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(nickname.trim(), content.trim(), imageUrl, id);

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  const comments = db
    .prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC, id ASC')
    .all(id)
    .map(sanitizeComment);

  res.json({ ...sanitizePost(updated), comments });
});

// DELETE /api/posts/:id
router.delete('/:id', express.json(), (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

  const { password } = req.body;
  if (!password || !verifyPassword(password, post.password_hash)) {
    return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  deleteImageFile(post.image_url);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  res.status(204).send();
});

module.exports = router;
