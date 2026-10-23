const express = require('express');
const prisma = require('../db');
const { isEmailConfigured, sendContactNotification } = require('../utils/mailer');
const { normalizeEmail, isValidEmail, cleanText } = require('../utils/validate');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 5000;

// POST /api/contact - public contact form. No auth required, since this is
// how a prospective student, teacher or the regional office first reaches us.
router.post('/', async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const email = normalizeEmail(req.body.email);
  const message = cleanText(req.body.message, MAX_MESSAGE_LENGTH);

  if (!name || !isValidEmail(email) || !message) {
    return res.status(400).json({ error: 'A name, a valid email and a message (up to 5000 characters) are required' });
  }

  const contact = await prisma.contactMessage.create({ data: { name, email, message } });

  if (isEmailConfigured()) {
    try {
      await sendContactNotification(contact);
    } catch (err) {
      // The message is already saved; a failed notification email shouldn't
      // make the submission look like it failed to the person who sent it.
      console.error('Failed to send contact notification email:', err);
    }
  }

  res.status(201).json({ received: true });
});

module.exports = router;
