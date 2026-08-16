let counter = 0;

function uniqueEmail(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

async function registerUser(request, app, overrides = {}) {
  const email = overrides.email ?? uniqueEmail('user');
  const res = await request(app).post('/api/auth/register').send({
    name: overrides.name ?? 'Test User',
    email,
    password: overrides.password ?? 'password123',
  });
  return res.body;
}

module.exports = { uniqueEmail, registerUser };
