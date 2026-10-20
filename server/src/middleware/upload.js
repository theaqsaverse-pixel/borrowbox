const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { badRequest } = require('../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(badRequest('Only JPG, PNG, WEBP or GIF images are allowed'));
    cb(null, true);
  },
});

/** Optional single image in the multipart field "image". Sets req.file. */
const uploadItemImage = upload.single('image');

/** Remove a previously uploaded file given its public path (/uploads/xyz.jpg). */
function removeUploadedFile(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(publicPath));
  fs.unlink(file, () => {});
}

module.exports = { uploadItemImage, removeUploadedFile, UPLOAD_DIR };
