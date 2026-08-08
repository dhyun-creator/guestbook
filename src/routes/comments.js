const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../hash');

const router = express.Router();
router.use(express.json());

const NICKNAME_MAX = 20;
const CONTENT_MAX = 300;

function sanitizeComment(comment) {
  const { password_hash, ...rest } = comment;
  return rest;
}

function validateNicknameAndContent(nickname, content, res) {
  if (!nickname || !nickname.trim()) {
    res.status(400).json({ error: '이름/별명을 입력해주세요.' });
    return false;
  }
  if (nickname.trim().length > NICKNAME_MAX) {
    res.status(400).json({ error: `이름/별명은 최대 ${NICKNAME_MAX}자까지 입력 가능합니다.` });
    return false;
  }
  if (!content || !content.trim()) {
    res.status(400).json({ error: '답글 내용을 입력해주세요.' });
    return false;
  }
  if (content.trim().length > CONTENT_MAX) {
    res.status(400).json({ error: `답글은 최대 ${CONTENT_MAX}자까지 입력 가능합니다.` });
    return false;
  }
  return true;
}

// POST /api/posts/:postId/comments
router.post('/posts/:postId/comments', (req, res) => {
  const postId = Number(req.params.postId);
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: '원글을 찾을 수 없습니다.' });

  const { nickname, password, passwordConfirm, content } = req.body;

  if (!validateNicknameAndContent(nickname, content, res)) return;

  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  const passwordHash = hashPassword(password);
  const info = db
    .prepare(
      'INSERT INTO comments (post_id, nickname, password_hash, content) VALUES (?, ?, ?, ?)'
    )
    .run(postId, nickname.trim(), passwordHash, content.trim());

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(sanitizeComment(comment));
});

// PUT /api/comments/:id
router.put('/comments/:id', (req, res) => {
  const id = Number(req.params.id);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  if (!comment) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

  const { nickname, password, content } = req.body;

  if (!password || !verifyPassword(password, comment.password_hash)) {
    return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  if (!validateNicknameAndContent(nickname, content, res)) return;

  db.prepare(
    "UPDATE comments SET nickname = ?, content = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(nickname.trim(), content.trim(), id);

  const updated = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  res.json(sanitizeComment(updated));
});

// DELETE /api/comments/:id
router.delete('/comments/:id', (req, res) => {
  const id = Number(req.params.id);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  if (!comment) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

  const { password } = req.body;
  if (!password || !verifyPassword(password, comment.password_hash)) {
    return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  res.status(204).send();
});

module.exports = router;
