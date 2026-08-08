const express = require('express');
const { pool } = require('../db');
const { hashPassword, verifyPassword } = require('../hash');
const { upload, uploadImageToBlob, deleteBlobIfExists } = require('../middleware/upload');

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
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const {
      rows: [{ count }],
    } = await pool.query('SELECT COUNT(*)::int AS count FROM posts');
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    const { rows: postRows } = await pool.query(
      'SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
      [PAGE_SIZE, offset]
    );

    const postIds = postRows.map((p) => p.id);
    let commentRows = [];
    if (postIds.length > 0) {
      const result = await pool.query(
        'SELECT * FROM comments WHERE post_id = ANY($1::int[]) ORDER BY created_at ASC, id ASC',
        [postIds]
      );
      commentRows = result.rows;
    }

    const commentsByPost = new Map();
    for (const c of commentRows) {
      if (!commentsByPost.has(c.post_id)) commentsByPost.set(c.post_id, []);
      commentsByPost.get(c.post_id).push(sanitizeComment(c));
    }

    const posts = postRows.map((p) => ({
      ...sanitizePost(p),
      comments: commentsByPost.get(p.id) || [],
    }));

    res.json({ posts, page, totalPages, total: count });
  } catch (err) {
    next(err);
  }
});

// POST /api/posts
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { nickname, password, passwordConfirm, content } = req.body;

    if (!validateNicknameAndContent(nickname, content, CONTENT_MAX, res)) return;

    if (!password) {
      return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    const imageUrl = req.file ? await uploadImageToBlob(req.file) : null;
    const passwordHash = hashPassword(password);

    const { rows } = await pool.query(
      'INSERT INTO posts (nickname, password_hash, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [nickname.trim(), passwordHash, content.trim(), imageUrl]
    );

    res.status(201).json({ ...sanitizePost(rows[0]), comments: [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/posts/:id
router.put('/:id', upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    const post = rows[0];
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

    const { nickname, password, content, removeImage } = req.body;

    if (!password || !verifyPassword(password, post.password_hash)) {
      return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    if (!validateNicknameAndContent(nickname, content, CONTENT_MAX, res)) return;

    let imageUrl = post.image_url;
    if (req.file) {
      await deleteBlobIfExists(post.image_url);
      imageUrl = await uploadImageToBlob(req.file);
    } else if (removeImage === 'true') {
      await deleteBlobIfExists(post.image_url);
      imageUrl = null;
    }

    const { rows: updatedRows } = await pool.query(
      'UPDATE posts SET nickname = $1, content = $2, image_url = $3, updated_at = now() WHERE id = $4 RETURNING *',
      [nickname.trim(), content.trim(), imageUrl, id]
    );

    const { rows: commentRows } = await pool.query(
      'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC, id ASC',
      [id]
    );

    res.json({
      ...sanitizePost(updatedRows[0]),
      comments: commentRows.map(sanitizeComment),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/posts/:id
router.delete('/:id', express.json(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    const post = rows[0];
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

    const { password } = req.body;
    if (!password || !verifyPassword(password, post.password_hash)) {
      return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    await deleteBlobIfExists(post.image_url);
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
