const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
