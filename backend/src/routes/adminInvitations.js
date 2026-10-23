const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateToken } = require('../utils/tokens');
const { normalizeEmail, isValidEmail } = require('../utils/validate');
const { INVITABLE_ROLES } = require('../utils/roles');
const { isEmailConfigured, frontendLink, sendInviteEmail } = require('../utils/mailer');

const router = express.Router();

router.use(requireAuth, requireAdmin);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function statusOf(invitation) {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.revokedAt) return 'revoked';
  if (invitation.expiresAt < new Date()) return 'expired';
  return 'pending';
}

// GET /api/admin/invitations - everything issued, newest first. The link itself
// is never stored (only its hash), so it can't be shown again after creation.
router.get('/invitations', async (req, res) => {
  const invitations = await prisma.invitation.findMany({
    include: { invitedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: statusOf(i),
      invitedBy: i.invitedBy?.name ?? null,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
    }))
  );
});

// POST /api/admin/invitations - body { email, role }. Returns the link once so
// the admin can copy it, and also emails it when email is configured.
router.post('/invitations', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { role } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${INVITABLE_ROLES.join(', ')}` });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'That email already has an account. Change their role from the Users list instead.' });
  }

  const { raw, hash } = generateToken();

  // One live invitation per address: issuing a new one cancels any older one.
  const [, invitation] = await prisma.$transaction([
    prisma.invitation.updateMany({
      where: { email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.invitation.create({
      data: { email, role, tokenHash: hash, invitedById: req.userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    }),
  ]);

  let emailed = false;
  if (isEmailConfigured()) {
    try {
      const inviter = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
      await sendInviteEmail({ to: email, role, token: raw, invitedByName: inviter?.name ?? 'An administrator' });
      emailed = true;
    } catch (err) {
      // The invitation exists and the admin still has the link to send by hand.
      console.error('Failed to send invitation email:', err.message);
    }
  }

  res.status(201).json({
    id: invitation.id,
    email,
    role,
    expiresAt: invitation.expiresAt,
    inviteLink: frontendLink(`/accept-invite?token=${raw}`),
    emailed,
  });
});

// DELETE /api/admin/invitations/:id - cancel a pending invitation
router.delete('/invitations/:id', async (req, res) => {
  const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
  if (!invitation) {
    return res.status(404).json({ error: 'Invitation not found' });
  }
  if (invitation.acceptedAt) {
    return res.status(409).json({ error: 'That invitation has already been accepted' });
  }

  await prisma.invitation.update({ where: { id: invitation.id }, data: { revokedAt: invitation.revokedAt ?? new Date() } });
  res.status(204).send();
});

module.exports = router;
