const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser } = require('./helpers');

describe('tutorials', () => {
  test('locked premium tutorial withholds steps from a free-plan user', async () => {
    const { token } = await registerUser(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });

    const tutorial = await prisma.tutorial.create({
      data: {
        subjectId: subject.id,
        title: 'Secret tutorial',
        isPremium: true,
        steps: { create: [{ order: 1, text: 'Step one' }] },
      },
    });

    const res = await request(app).get(`/api/tutorials/${subject.id}`).set('Authorization', `Bearer ${token}`);

    const found = res.body.find((t) => t.id === tutorial.id);
    expect(found.locked).toBe(true);
    expect(found.steps).toEqual([]);
  });

  test('premium user sees the steps for a premium tutorial, in order', async () => {
    const { token } = await registerUser(request, app);
    await request(app).post('/api/billing/upgrade').set('Authorization', `Bearer ${token}`);

    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const tutorial = await prisma.tutorial.create({
      data: {
        subjectId: subject.id,
        title: 'Visible tutorial',
        isPremium: true,
        steps: { create: [{ order: 2, text: 'Second' }, { order: 1, text: 'First' }] },
      },
    });

    const res = await request(app).get(`/api/tutorials/${subject.id}`).set('Authorization', `Bearer ${token}`);

    const found = res.body.find((t) => t.id === tutorial.id);
    expect(found.locked).toBe(false);
    expect(found.steps.map((s) => s.text)).toEqual(['First', 'Second']);
  });

  test('free tutorial is visible and unlocked for everyone', async () => {
    const { token } = await registerUser(request, app);
    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const tutorial = await prisma.tutorial.create({
      data: { subjectId: subject.id, title: 'Free tutorial', steps: { create: [{ order: 1, text: 'Only step' }] } },
    });

    const res = await request(app).get(`/api/tutorials/${subject.id}`).set('Authorization', `Bearer ${token}`);

    const found = res.body.find((t) => t.id === tutorial.id);
    expect(found.locked).toBe(false);
    expect(found.steps).toHaveLength(1);
  });
});
