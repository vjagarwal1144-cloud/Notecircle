import { Router } from 'express';
import { db, hashPassword } from '../db.ts';
import { getAuthUser } from './auth.ts';
import { getRedactedProfile, isBlocked } from '../privacy.ts';
import type { UserAvailability } from '../../src/types/index.ts';

export const usersRouter = Router();

// GET /api/users/search?q=username
// Requirements:
// - Exact username search & prefix matching
// - Real database query with privacy redaction
// - Shows avatar, displayName, @username, Private Account indicator, relationship state
// - ZERO private notes, followers, following or private profile info leaked to strangers!
usersRouter.get('/search', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const query = ((req.query.q as string) || '').trim().toLowerCase();
  if (!query) {
    return res.json({ users: [] });
  }

  const allUsers = db.get('users');
  const results = allUsers
    .filter((u) => {
      if (u.id === viewer.id) return false;
      if (u.isSuspended) return false;
      if (isBlocked(viewer.id, u.id)) return false;

      const uName = u.username.toLowerCase();
      const dName = u.displayName.toLowerCase();

      // Prefix match or exact match or partial match
      return uName.startsWith(query) || uName.includes(query) || dName.includes(query);
    })
    .slice(0, 25)
    .map((target) => getRedactedProfile(viewer.id, target));

  return res.json({ users: results });
});

// GET /api/users/profile/:username
usersRouter.get('/profile/:username', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const targetUsername = req.params.username.toLowerCase();
  const targetUser = db.get('users').find((u) => u.username.toLowerCase() === targetUsername);

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (isBlocked(viewer.id, targetUser.id)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const profile = getRedactedProfile(viewer.id, targetUser);
  return res.json({ profile });
});

// PUT /api/users/me/availability
usersRouter.put('/me/availability', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { code, label, emoji, customStatus, expiresAt, strictDnd } = req.body;

  const newAvailability: UserAvailability = {
    code: code || 'available',
    label: label || 'Available',
    emoji: emoji || '🟢',
    customStatus: customStatus || undefined,
    expiresAt: expiresAt || null,
    strictDnd: !!strictDnd,
    updatedAt: new Date().toISOString()
  };

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          availability: newAvailability
        };
        return updatedUser;
      }
      return u;
    })
  );

  return res.json({ availability: newAvailability, user: updatedUser });
});

// PUT /api/users/me (Update profile fields)
usersRouter.put('/me', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { displayName, username, bio, city, birthday, workplace, avatarUrl } = req.body;

  let newUsername = viewer.username;
  if (username !== undefined) {
    const cleanU = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanU.length < 3 || cleanU.length > 24) {
      return res.status(400).json({ error: 'Username must be 3-24 characters (alphanumeric and underscore only)' });
    }
    const allUsers = db.get('users');
    const taken = allUsers.some((u) => u.id !== viewer.id && u.username.toLowerCase() === cleanU);
    if (taken) {
      return res.status(409).json({ error: `Username @${cleanU} is already taken by another user.` });
    }
    newUsername = cleanU;
  }

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          username: newUsername,
          displayName: displayName !== undefined ? displayName.trim() : u.displayName,
          bio: bio !== undefined ? bio.trim() : u.bio,
          city: city !== undefined ? city.trim() : u.city,
          birthday: birthday !== undefined ? birthday : u.birthday,
          workplace: workplace !== undefined ? workplace.trim() : u.workplace,
          avatarUrl: avatarUrl !== undefined ? avatarUrl.trim() : u.avatarUrl
        };
        return updatedUser;
      }
      return u;
    })
  );

  db.logAudit(viewer.id, updatedUser.username, 'PROFILE_UPDATED', `Display name: ${updatedUser.displayName}, handle: @${updatedUser.username}`);

  return res.json({ user: updatedUser });
});

// PUT /api/users/me/privacy (Update privacy settings)
usersRouter.put('/me/privacy', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const newSettings = req.body;

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          privacySettings: {
            ...u.privacySettings,
            ...newSettings
          }
        };
        return updatedUser;
      }
      return u;
    })
  );

  return res.json({ user: updatedUser });
});

// PUT /api/users/me/notifications (Update notification settings)
usersRouter.put('/me/notifications', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const newSettings = req.body;

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          notificationSettings: {
            ...u.notificationSettings,
            ...newSettings
          }
        };
        return updatedUser;
      }
      return u;
    })
  );

  return res.json({ user: updatedUser });
});

// PUT /api/users/me/credentials (Change password, email, phone)
usersRouter.put('/me/credentials', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword, newEmail, newPhone } = req.body;

  if (newPassword) {
    const expectedCurrent = hashPassword(currentPassword || '');
    if ((viewer as any).passwordHash && (viewer as any).passwordHash !== expectedCurrent) {
      return res.status(400).json({ error: 'Current password incorrect' });
    }
  }

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          email: newEmail ? newEmail.trim().toLowerCase() : u.email,
          phone: newPhone ? newPhone.trim() : u.phone
        };
        if (newPassword) {
          (updatedUser as any).passwordHash = hashPassword(newPassword);
        }
        return updatedUser;
      }
      return u;
    })
  );

  db.logAudit(viewer.id, viewer.username, 'CREDENTIALS_CHANGED', 'User updated account credentials');
  return res.json({ success: true, user: updatedUser });
});

// GET /api/users/me/sessions (Active sessions from real database)
usersRouter.get('/me/sessions', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const authHeader = req.headers.authorization;
  const currentToken = authHeader ? authHeader.replace(/^Bearer\s+/, '').trim() : undefined;

  const sessions = db.getUserSessions(viewer.id, currentToken).map((s) => ({
    id: s.id,
    device: s.device,
    browser: s.device,
    ip: s.ip,
    current: s.current,
    lastActive: s.lastActive
  }));

  return res.json({ sessions });
});

// DELETE /api/users/me/sessions/:sessionId (Revoke specific session)
usersRouter.delete('/me/sessions/:sessionId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  db.deleteSessionById(req.params.sessionId, viewer.id);
  db.logAudit(viewer.id, viewer.username, 'SESSION_REVOKED', `Session ID: ${req.params.sessionId}`);
  return res.json({ success: true, message: 'Session revoked successfully' });
});

// POST /api/users/me/logout-all-devices
usersRouter.post('/me/logout-all-devices', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const authHeader = req.headers.authorization;
  const currentToken = authHeader ? authHeader.replace(/^Bearer\s+/, '').trim() : undefined;

  // Revoke all except current session
  db.deleteAllSessionsForUser(viewer.id, currentToken);
  db.logAudit(viewer.id, viewer.username, 'LOGOUT_ALL_DEVICES', 'Terminated all remote companion sessions');
  return res.json({ success: true, message: 'All other remote devices logged out successfully' });
});

// GET /api/users/me/export-data (Download Personal Data Export)
usersRouter.get('/me/export-data', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const allConnections = db.get('connections').filter((c) => c.requesterId === viewer.id || c.targetId === viewer.id);
  const myNotes = db.get('notes').filter((n) => n.userId === viewer.id);
  const myCloseFriends = db.get('closeFriends').filter((cf) => cf.userId === viewer.id);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    complianceStandard: 'GDPR / Local-First Data Portability Article 20',
    userProfile: {
      id: viewer.id,
      username: viewer.username,
      displayName: viewer.displayName,
      email: viewer.email,
      phone: viewer.phone,
      bio: viewer.bio,
      city: viewer.city,
      birthday: viewer.birthday,
      workplace: viewer.workplace,
      createdAt: viewer.createdAt
    },
    privacySettings: viewer.privacySettings,
    connections: allConnections.map((c) => ({
      connectionId: c.id,
      type: c.requesterId === viewer.id ? 'FOLLOWING' : 'FOLLOWER',
      status: c.status,
      timestamp: c.createdAt
    })),
    closeFriendsCount: myCloseFriends.length,
    activeNotesMetadata: myNotes.map((n) => ({
      noteId: n.id,
      category: n.category,
      audience: n.audience,
      createdAt: n.createdAt,
      expiresAt: n.expiresAt
    }))
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="notecircle_export_${viewer.username}.json"`);
  return res.send(JSON.stringify(exportPayload, null, 2));
});

// DELETE /api/users/me (Account deletion)
usersRouter.delete('/me', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  db.purgeUserData(viewer.id);
  db.logAudit(viewer.id, viewer.username, 'ACCOUNT_DELETED', 'User account permanently purged from NoteCircle');
  return res.json({ success: true, message: 'Your account has been deleted.' });
});
