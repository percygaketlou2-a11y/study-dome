const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'past-papers');
const TUTORIAL_IMAGE_DIR = path.join(__dirname, '..', '..', 'uploads', 'tutorial-images');

// Raised for a rejected upload. The API error handler recognises this class and
// returns its message to the client; it never matches on message text, so an
// unrelated internal error can't be mistaken for one and leaked.
class UploadError extends Error {}

// The stored file's extension comes from the validated content type - never
// from the uploaded filename. Otherwise a file could be sent as "image/png"
// but named "x.html", and then be served back from our own origin as a web page.
const EXTENSION_BY_TYPE = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function makeStorage(dir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${unique}${EXTENSION_BY_TYPE[file.mimetype]}`);
    },
  });
}

function onlyTypes(allowed, message) {
  return (req, file, cb) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new UploadError(message), false);
  };
}

const uploadPastPaperFiles = multer({
  storage: makeStorage(UPLOAD_DIR),
  fileFilter: onlyTypes(['application/pdf'], 'Only PDF files are allowed'),
  limits: { fileSize: 25 * 1024 * 1024, files: 2 }, // 25MB each
}).fields([
  { name: 'examFile', maxCount: 1 },
  { name: 'markingSchemeFile', maxCount: 1 },
]);

const uploadTutorialImage = multer({
  storage: makeStorage(TUTORIAL_IMAGE_DIR),
  fileFilter: onlyTypes(['image/png', 'image/jpeg', 'image/webp', 'image/gif'], 'Only PNG, JPG, WEBP or GIF images are allowed'),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
}).single('image');

module.exports = { uploadPastPaperFiles, UPLOAD_DIR, uploadTutorialImage, TUTORIAL_IMAGE_DIR, UploadError };
