const nodemailer = require('nodemailer');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const { registerUser, getAdminToken, uniqueEmail } = require('./helpers');

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const PASSWORD = 'password123';
const tokenFrom = (inviteLink) => new URL(inviteLink).searchParams.get('token');

let adminToken;

beforeAll(async () => {
  adminToken = await getAdminToken(request, app);
});

async function invite(email, role, token = adminToken) {
  return request(app).post('/api/admin/invitations').set(bearer(token)).send({ email, role });
}

async function accept(token, overrides = {}) {
  return request(app)
    .post('/api/auth/accept-invite')
    .send({ token, name: 'Invited Person', password: PASSWORD, acceptedTerms: true, ...overrides });
}

// The realistic route to a staff account: an admin invites, the person accepts.
async function createStaff(role, byAdminToken = adminToken) {
  const email = uniqueEmail(role);
  const sent = await invite(email, role, byAdminToken);
  const accepted = await accept(tokenFrom(sent.body.inviteLink), { name: `Test ${role}` });
  return { email, user: accepted.body.user, token: accepted.body.token };
}

describe('public signup and staff sign-in are separate', () => {
  test('public signup always makes a student, even if the request asks for more', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: uniqueEmail('sneaky'), password: PASSWORD, acceptedTerms: true, role: 'admin', isAdmin: true });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
  });

  test('students cannot sign in on the staff form, and it does not reveal that they exist', async () => {
    const { user } = await registerUser(request, app);

    const asStudent = await request(app).post('/api/auth/staff-login').send({ email: user.email, password: PASSWORD });
    const wrongPassword = await request(app).post('/api/auth/staff-login').send({ email: user.email, password: 'not-the-password' });
    expect(asStudent.status).toBe(401);
    expect(asStudent.body).toEqual(wrongPassword.body);

    const normal = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(normal.status).toBe(200);
  });

  test('admins and reviewers can sign in on the staff form', async () => {
    const owner = await request(app).post('/api/auth/staff-login').send({ email: process.env.ADMIN_EMAIL, password: PASSWORD });
    expect(owner.status).toBe(200);
    expect(owner.body.user.role).toBe('admin');

    const reviewer = await createStaff('reviewer');
    const res = await request(app).post('/api/auth/staff-login').send({ email: reviewer.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('reviewer');
  });

  test('malformed staff-login input is a 400', async () => {
    const res = await request(app).post('/api/auth/staff-login').send({ email: { a: 1 }, password: PASSWORD });
    expect(res.status).toBe(400);
  });
});

describe('invitations', () => {
  test('an admin invites a reviewer, who accepts and gets exactly the invited email and role', async () => {
    const email = uniqueEmail('teacher');
    const sent = await invite(email, 'reviewer');
    expect(sent.status).toBe(201);
    expect(sent.body.inviteLink).toMatch(/\/accept-invite\?token=/);
    expect(sent.body.emailed).toBe(false);

    const token = tokenFrom(sent.body.inviteLink);
    const info = await request(app).post('/api/auth/invite-info').send({ token });
    expect(info.body).toEqual({ email, role: 'reviewer' });

    // The request cannot override the invited email or role.
    const accepted = await accept(token, { email: 'someone-else@example.com', role: 'admin' });
    expect(accepted.status).toBe(201);
    expect(accepted.body.user.email).toBe(email);
    expect(accepted.body.user.role).toBe('reviewer');
    expect(accepted.body.devVerifyLink).toMatch(/token=/);

    const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);

    const listed = await request(app).get('/api/admin/invitations').set(bearer(adminToken));
    const row = listed.body.find((i) => i.email === email);
    expect(row.status).toBe('accepted');
    expect(JSON.stringify(listed.body)).not.toContain(token);
  });

  test('an invitation works once only', async () => {
    const sent = await invite(uniqueEmail('once'), 'reviewer');
    const token = tokenFrom(sent.body.inviteLink);

    expect((await accept(token)).status).toBe(201);
    expect((await accept(token)).status).toBe(400);
    expect((await request(app).post('/api/auth/invite-info').send({ token })).status).toBe(404);
  });

  test('expired, revoked and replaced invitations stop working', async () => {
    const expiring = await invite(uniqueEmail('expiring'), 'reviewer');
    await prisma.invitation.update({ where: { id: expiring.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await accept(tokenFrom(expiring.body.inviteLink))).status).toBe(400);

    const revoked = await invite(uniqueEmail('revoked'), 'reviewer');
    expect((await request(app).delete(`/api/admin/invitations/${revoked.body.id}`).set(bearer(adminToken))).status).toBe(204);
    expect((await accept(tokenFrom(revoked.body.inviteLink))).status).toBe(400);

    const email = uniqueEmail('reissued');
    const first = await invite(email, 'reviewer');
    const second = await invite(email, 'admin');
    expect((await accept(tokenFrom(first.body.inviteLink))).status).toBe(400);
    const ok = await accept(tokenFrom(second.body.inviteLink));
    expect(ok.status).toBe(201);
    expect(ok.body.user.role).toBe('admin');
  });

  test('only admins can invite, only to staff roles, and not to an email that already has an account', async () => {
    const { token: studentToken, user } = await registerUser(request, app);
    const reviewer = await createStaff('reviewer');

    expect((await invite(uniqueEmail('x'), 'reviewer', studentToken)).status).toBe(403);
    expect((await invite(uniqueEmail('x'), 'reviewer', reviewer.token)).status).toBe(403);

    expect((await invite(uniqueEmail('x'), 'student')).status).toBe(400);
    expect((await invite(uniqueEmail('x'), 'owner')).status).toBe(400);
    expect((await invite('not-an-email', 'reviewer')).status).toBe(400);

    const existing = await invite(user.email, 'reviewer');
    expect(existing.status).toBe(409);
  });

  test('a weak password or missing consent is refused without using up the invitation', async () => {
    const sent = await invite(uniqueEmail('careful'), 'reviewer');
    const token = tokenFrom(sent.body.inviteLink);

    expect((await accept(token, { password: 'short' })).status).toBe(400);
    expect((await accept(token, { acceptedTerms: false })).status).toBe(400);
    expect((await accept(token, { name: '' })).status).toBe(400);
    expect((await accept(token)).status).toBe(201);
  });

  test('an invitation dies with the admin who issued it', async () => {
    const secondAdmin = await createStaff('admin');
    const sent = await invite(uniqueEmail('orphan'), 'reviewer', secondAdmin.token);
    expect(sent.status).toBe(201);

    const demote = await request(app)
      .patch(`/api/admin/users/${secondAdmin.user.id}`)
      .set(bearer(adminToken))
      .send({ role: 'student' });
    expect(demote.status).toBe(200);

    expect((await accept(tokenFrom(sent.body.inviteLink))).status).toBe(400);
  });

  test('the invitation email is sent when email is configured, and the admin still gets the link', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const spy = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });
    const saved = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
    const owner = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL } });

    try {
      process.env.EMAIL_USER = 'sender@example.com';
      process.env.EMAIL_PASS = 'app-password';
      await prisma.user.update({ where: { id: owner.id }, data: { emailVerified: true } }); // staff need a verified email once email is on

      const email = uniqueEmail('mailed');
      const sent = await invite(email, 'reviewer');
      expect(sent.status).toBe(201);
      expect(sent.body.emailed).toBe(true);
      expect(sent.body.inviteLink).toMatch(/accept-invite/);
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0].to).toBe(email);
      expect(sendMail.mock.calls[0][0].html).toContain('/accept-invite?token=');
    } finally {
      spy.mockRestore();
      if (saved.user === undefined) delete process.env.EMAIL_USER;
      else process.env.EMAIL_USER = saved.user;
      if (saved.pass === undefined) delete process.env.EMAIL_PASS;
      else process.env.EMAIL_PASS = saved.pass;
    }
  });
});

describe('what each role may do', () => {
  test('a reviewer can use Content Review but nothing else in the admin area', async () => {
    const reviewer = await createStaff('reviewer');

    expect((await request(app).get('/api/admin/content/overview').set(bearer(reviewer.token))).status).toBe(200);
    for (const path of ['/api/admin/users', '/api/admin/invitations', '/api/admin/payments', '/api/admin/quizzes', '/api/admin/contact-messages', '/api/admin/curricula', '/api/admin/videos']) {
      const res = await request(app).get(path).set(bearer(reviewer.token));
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });

  test('a reviewer can approve content, which publishes it to students', async () => {
    const reviewer = await createStaff('reviewer');
    const { token: studentToken } = await registerUser(request, app);

    const subject = await prisma.subject.findFirst({ where: { name: 'Mathematics', curriculum: { name: 'JC' } } });
    const topic = await prisma.topic.create({ data: { subjectId: subject.id, title: 'Roles test topic' } });
    const note = await prisma.topicNote.create({
      data: { key: `ROLES-N-${Date.now()}`, subjectId: subject.id, topicId: topic.id, heading: 'Reviewed by a teacher', bodyMarkdown: 'Hello **class**' },
    });

    const before = await request(app).get(`/api/subjects/${subject.id}/topic-notes`).set(bearer(studentToken));
    expect(before.body.find((g) => g.topic.id === topic.id)).toBeUndefined();

    const approved = await request(app)
      .patch(`/api/admin/content/notes/${note.id}`)
      .set(bearer(reviewer.token))
      .send({ reviewStatus: 'approved', reviewerName: 'Mrs Teacher' });
    expect(approved.status).toBe(200);

    const after = await request(app).get(`/api/subjects/${subject.id}/topic-notes`).set(bearer(studentToken));
    expect(after.body.find((g) => g.topic.id === topic.id).notes[0].heading).toBe('Reviewed by a teacher');
  });

  test('changing a role takes effect immediately and is not undone at the next login', async () => {
    const { token, user } = await registerUser(request, app);
    expect((await request(app).get('/api/admin/content/overview').set(bearer(token))).status).toBe(403);

    const promote = await request(app).patch(`/api/admin/users/${user.id}`).set(bearer(adminToken)).send({ role: 'admin' });
    expect(promote.status).toBe(200);
    expect((await request(app).get('/api/admin/users').set(bearer(token))).status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(login.body.user.role).toBe('admin');
    expect((await request(app).get('/api/admin/users').set(bearer(login.body.token))).status).toBe(200);
  });

  test('the owner account cannot be demoted or deleted, even by another admin', async () => {
    const otherAdmin = await createStaff('admin');
    const list = await request(app).get('/api/admin/users').set(bearer(otherAdmin.token));
    const owner = list.body.find((u) => u.email === process.env.ADMIN_EMAIL);
    expect(owner.isOwner).toBe(true);

    const demote = await request(app).patch(`/api/admin/users/${owner.id}`).set(bearer(otherAdmin.token)).send({ role: 'student' });
    expect(demote.status).toBe(400);
    const remove = await request(app).delete(`/api/admin/users/${owner.id}`).set(bearer(otherAdmin.token));
    expect(remove.status).toBe(400);
    expect((await request(app).get('/api/admin/users').set(bearer(adminToken))).status).toBe(200);
  });

  test('role changes validate their input', async () => {
    const { user } = await registerUser(request, app);
    expect((await request(app).patch(`/api/admin/users/${user.id}`).set(bearer(adminToken)).send({ role: 'superuser' })).status).toBe(400);
    expect((await request(app).patch('/api/admin/users/nonexistent').set(bearer(adminToken)).send({ role: 'reviewer' })).status).toBe(404);
  });

  test('staff do not appear on the student leaderboard', async () => {
    const reviewer = await createStaff('reviewer');
    const { token: studentToken } = await registerUser(request, app, { name: 'Leaderboard Student' });

    const res = await request(app).get('/api/leaderboard').set(bearer(studentToken));
    expect(res.body.some((r) => r.name === 'Leaderboard Student')).toBe(true);
    expect(res.body.some((r) => r.userId === reviewer.user.id)).toBe(false);
    expect(res.body.some((r) => r.name === 'Admin')).toBe(false);
  });
});

describe('admins can see every curriculum', () => {
  test('an admin gets every curriculum and can switch between them', async () => {
    const first = await request(app).get('/api/user/dashboard').set(bearer(adminToken));
    expect(first.status).toBe(200);
    expect(first.body.user.role).toBe('admin');
    const names = first.body.availableCurricula.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['JC', 'BGCSE', 'IGCSE', 'A-Levels', 'IB', 'IEB']));

    const bgcse = first.body.availableCurricula.find((c) => c.name === 'BGCSE');
    const switched = await request(app).get(`/api/user/dashboard?curriculumId=${bgcse.id}`).set(bearer(adminToken));
    expect(switched.body.curriculum.name).toBe('BGCSE');
    expect(switched.body.subjects.some((s) => s.name === 'Chemistry')).toBe(true);

    const jc = first.body.availableCurricula.find((c) => c.name === 'JC');
    const other = await request(app).get(`/api/user/dashboard?curriculumId=${jc.id}`).set(bearer(adminToken));
    expect(other.body.curriculum.name).toBe('JC');
    expect(other.body.subjects.some((s) => s.name === 'Chemistry')).toBe(false);
  });

  test('students stay on their own curriculum and cannot use the switcher', async () => {
    const { token } = await registerUser(request, app);
    const bgcse = await prisma.curriculum.findUnique({ where: { name: 'BGCSE' } });
    const jc = await prisma.curriculum.findUnique({ where: { name: 'JC' } });
    await request(app).patch('/api/user/curriculum').set(bearer(token)).send({ curriculumId: jc.id });

    const res = await request(app).get(`/api/user/dashboard?curriculumId=${bgcse.id}`).set(bearer(token));
    expect(res.body.curriculum.name).toBe('JC');
    expect(res.body.availableCurricula).toBeUndefined();
  });
});
