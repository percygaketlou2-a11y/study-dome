require('dotenv').config();
const app = require('./app');
const { validateEnv } = require('./config');
const { isEmailConfigured, checkEmailLogin } = require('./utils/mailer');

// Refuse to start a production server with a missing or placeholder secret.
const { errors, warnings } = validateEnv();
warnings.forEach((warning) => console.warn(`[config] warning: ${warning}`));
if (errors.length > 0) {
  errors.forEach((error) => console.error(`[config] error: ${error}`));
  if (process.env.NODE_ENV === 'production') {
    console.error('[config] Refusing to start in production with the errors above.');
    process.exit(1);
  }
}

// A rejected promise nobody awaited is logged rather than silently ignored.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Study Dome API listening on port ${port}`);

  // Say plainly in the log whether email works, instead of finding out when the first signup fails.
  if (isEmailConfigured()) {
    checkEmailLogin()
      .then(() => console.log('[mail] Email is set up and the mail server accepted the login.'))
      .catch((err) =>
        console.error(`[mail] Email is configured but the mail server refused it: ${err.message}. Check EMAIL_USER / EMAIL_PASS (Gmail needs an App Password, not the normal password). Run "npm run test:email" for details.`)
      );
  }
});
