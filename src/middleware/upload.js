const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');
const { put, del } = require('@vercel/blob');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error('허용되지 않는 이미지 형식입니다. (jpg, jpeg, png, gif, webp만 가능)'));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
});

async function uploadImageToBlob(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `uploads/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const blob = await put(key, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
  });
  return blob.url;
}

async function deleteBlobIfExists(url) {
  if (!url) return;
  try {
    await del(url);
  } catch {
    // 이미 삭제되었거나 존재하지 않는 경우 무시
  }
}

module.exports = { upload, uploadImageToBlob, deleteBlobIfExists };
