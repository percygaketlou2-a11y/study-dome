const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'past-papers');
const TUTORIAL_IMAGE_DIR = path.join(__dirname, '..', '..', 'uploads', 'tutorial-images');

function makeStorage(dir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
    },
  });
}

function pdfOnly(req, file, cb) {
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
  cb(isPdf ? null : new Error('Only PDF files are allowed'), isPdf);
}

function imageOnly(req, file, cb) {
  const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
  cb(isImage ? null : new Error('Only PNG, JPG, WEBP or GIF images are allowed'), isImage);
}

const uploadPastPaperFiles = multer({
  storage: makeStorage(UPLOAD_DIR),
  fileFilter: pdfOnly,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
}).fields([
  { name: 'examFile', maxCount: 1 },
  { name: 'markingSchemeFile', maxCount: 1 },
]);

const uploadTutorialImage = multer({
  storage: makeStorage(TUTORIAL_IMAGE_DIR),
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('image');

module.exports = { uploadPastPaperFiles, UPLOAD_DIR, uploadTutorialImage, TUTORIAL_IMAGE_DIR };
