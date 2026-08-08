require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('node:path');
const multer = require('multer');

const postsRouter = require('./src/routes/posts');
const commentsRouter = require('./src/routes/comments');
const adminRouter = require('./src/routes/admin');
const { uploadDir } = require('./src/middleware/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 2 }, // 2시간
  })
);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.use('/api/posts', postsRouter);
app.use('/api', commentsRouter);
app.use('/api/admin', adminRouter);

// multer/그 외 에러를 JSON으로 응답
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '이미지 용량은 최대 5MB까지 업로드 가능합니다.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || '요청을 처리할 수 없습니다.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`방명록 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
