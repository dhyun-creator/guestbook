const express = require('express');
const { pool } = require('../db');
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
router.post('/posts/:postId/comments', async (req, res, next) => {
  try {
    const postId = Number(req.params.postId);
    const { rows: postRows } = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (!postRows[0]) return res.status(404).json({ error: '원글을 찾을 수 없습니다.' });

    const { nickname, password, passwordConfirm, content } = req.body;

    if (!validateNicknameAndContent(nickname, content, res)) return;

    if (!password) {
      return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    const passwordHash = hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO comments (post_id, nickname, password_hash, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [postId, nickname.trim(), passwordHash, content.trim()]
    );

    res.status(201).json(sanitizeComment(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PUT /api/comments/:id
router.put('/comments/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
    const comment = rows[0];
    if (!comment) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

    const { nickname, password, content } = req.body;

    if (!password || !verifyPassword(password, comment.password_hash)) {
      return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    if (!validateNicknameAndContent(nickname, content, res)) return;

    const { rows: updatedRows } = await pool.query(
      'UPDATE comments SET nickname = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *',
      [nickname.trim(), content.trim(), id]
    );

    res.json(sanitizeComment(updatedRows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/comments/:id
router.delete('/comments/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
    const comment = rows[0];
    if (!comment) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

    const { password } = req.body;
    if (!password || !verifyPassword(password, comment.password_hash)) {
      return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
