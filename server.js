const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`방명록 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
