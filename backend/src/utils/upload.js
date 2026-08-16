const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'past-papers');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});

function pdfOnly(req, file, cb) {
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
  cb(isPdf ? null : new Error('Only PDF files are allowed'), isPdf);
}

const uploadPastPaperFiles = multer({
  storage,
  fileFilter: pdfOnly,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
}).fields([
  { name: 'examFile', maxCount: 1 },
  { name: 'markingSchemeFile', maxCount: 1 },
]);

module.exports = { uploadPastPaperFiles, UPLOAD_DIR };
