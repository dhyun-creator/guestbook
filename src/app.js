require('dotenv').config();

const express = require('express');
const path = require('node:path');
const multer = require('multer');

const postsRouter = require('./routes/posts');
const commentsRouter = require('./routes/comments');
const adminRouter = require('./routes/admin');
const { ensureInit } = require('./db');

const app = express();

app.use(async (req, res, next) => {
  try {
    await ensureInit();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/posts', postsRouter);
app.use('/api', commentsRouter);
app.use('/api/admin', adminRouter);

// multer 및 예기치 못한 에러를 JSON으로 응답
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '이미지 용량은 최대 5MB까지 업로드 가능합니다.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    console.error(err);
    return res.status(500).json({ error: '요청을 처리할 수 없습니다.' });
  }
  next();
});

module.exports = app;
