const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser } = require('./helpers');

describe('videos', () => {
  test('locked premium video withholds embed URL from a free-plan user', async () => {
    const { token } = await registerUser(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });

    const video = await prisma.video.create({
      data: { subjectId: subject.id, title: 'Secret lesson', url: 'https://www.youtube.com/watch?v=secret1', isPremium: true },
    });

    const res = await request(app).get(`/api/videos/${subject.id}`).set('Authorization', `Bearer ${token}`);

    const found = res.body.find((v) => v.id === video.id);
    expect(found.locked).toBe(true);
    expect(found.embedUrl).toBeNull();
  });

  test('premium user sees the embed URL for a premium video', async () => {
    const { token } = await registerUser(request, app);
    await request(app).post('/api/billing/upgrade').set('Authorization', `Bearer ${token}`);

    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const video = await prisma.video.create({
      data: { subjectId: subject.id, title: 'Visible lesson', url: 'https://www.youtube.com/watch?v=visible1', isPremium: true },
    });

    const res = await request(app).get(`/api/videos/${subject.id}`).set('Authorization', `Bearer ${token}`);

    const found = res.body.find((v) => v.id === video.id);
    expect(found.locked).toBe(false);
    expect(found.embedUrl).toBe('https://www.youtube.com/embed/visible1');
  });

  test('free video is visible and unlocked for everyone', async () => {
    const { token } = await registerUser(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const video = await prisma.video.create({
      data: { subjectId: subject.id, title: 'Free lesson', url: 'https://youtu.be/free123', isPremium: false },
    });

    const res = await request(app).get(`/api/videos/${subject.id}`).set('Authorization', `Bearer ${token}`);

    const found = res.body.find((v) => v.id === video.id);
    expect(found.locked).toBe(false);
    expect(found.embedUrl).toBe('https://www.youtube.com/embed/free123');
  });
});
