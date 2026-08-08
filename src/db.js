const { Pool } = require('pg');

// Vercel의 Postgres 스토리지 통합(Neon, Supabase 등)마다 주입하는 환경변수 이름이
// 다를 수 있어 흔히 쓰이는 이름들을 순서대로 확인한다.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

// Supabase/Neon 등 관리형 Postgres는 SSL을 요구하며, pg는 연결 문자열의
// sslmode 파라미터를 자동으로 신뢰하지 않으므로 명시적으로 켜준다.
const pool = new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : undefined,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      nickname VARCHAR(20) NOT NULL,
      password_hash TEXT NOT NULL,
      content VARCHAR(500) NOT NULL,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      nickname VARCHAR(20) NOT NULL,
      password_hash TEXT NOT NULL,
      content VARCHAR(300) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    );
  `);
}

let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = init();
  return initPromise;
}

module.exports = { pool, ensureInit };
