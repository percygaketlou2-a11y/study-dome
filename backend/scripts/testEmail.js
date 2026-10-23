// Checks that email works, and optionally sends a real test message:
//   npm run test:email                      (checks the login only)
//   npm run test:email -- you@example.com   (also sends a test email there)
require('dotenv').config();
const { isEmailConfigured, checkEmailLogin, sendMail, transportOptions } = require('../src/utils/mailer');

const to = process.argv[2];

(async () => {
  if (!isEmailConfigured()) {
    console.error('EMAIL_USER and EMAIL_PASS are not set.');
    process.exit(1);
  }

  const options = transportOptions();
  console.log(`Using ${options.host ? `${options.host}:${options.port}` : 'Gmail'} as ${process.env.EMAIL_USER}`);

  try {
    await checkEmailLogin();
    console.log('OK: the mail server accepted the login.');
    if (to) {
      await sendMail({ to, subject: 'Study Dome test email', html: '<p>Email is working for Study Dome.</p>' });
      console.log(`OK: test email sent to ${to}. Check the inbox (and spam).`);
    }
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    if (!process.env.EMAIL_HOST) {
      console.error('Gmail needs an App Password (16 letters), not the normal account password. See README.md, "Email".');
    }
    process.exit(1);
  }
})();
