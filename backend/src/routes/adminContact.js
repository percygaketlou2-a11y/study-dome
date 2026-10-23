const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/contact-messages - everything submitted through the public contact form
router.get('/contact-messages', async (req, res) => {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(messages);
});

module.exports = router;
