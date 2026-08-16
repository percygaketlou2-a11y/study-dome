const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const curriculaRoutes = require('./routes/curricula');
const quizzesRoutes = require('./routes/quizzes');
const pastPapersRoutes = require('./routes/pastPapers');
const leaderboardRoutes = require('./routes/leaderboard');
const subjectsRoutes = require('./routes/subjects');
const adminRoutes = require('./routes/admin');
const billingRoutes = require('./routes/billing');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/curricula', curriculaRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/past-papers', pastPapersRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /pdf/i.test(err?.message ?? '')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
