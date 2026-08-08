const { Pool } = require('pg');

// Vercel의 Postgres 스토리지 통합(Neon, Supabase 등)마다 주입하는 환경변수 이름이
// 다를 수 있어 흔히 쓰이는 이름들을 순서대로 확인한다.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

const pool = new Pool({ connectionString });

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
