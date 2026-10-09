import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, hashPassword } from '../db.ts';
import { getAuthUser, sanitizeUser } from './auth.ts';
import { getServerSupabase } from '../supabase.ts';
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

  return res.json({ availability: newAvailability, user: sanitizeUser(updatedUser) });
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

  return res.json({ user: sanitizeUser(updatedUser) });
});

// POST /api/users/me/avatar (Upload and set profile photo)
usersRouter.post('/me/avatar', async (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { dataUrl } = req.body;
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'Valid image data is required.' });
  }

  // Parse Data URL: data:image/png;base64,....
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Invalid image format. Expected base64 Data URL.' });
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];

  // Validate MIME type
  const allowedMimeTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };

  const extension = allowedMimeTypes[mimeType];
  if (!extension) {
    return res.status(400).json({ error: 'Unsupported file format. Please upload JPG, PNG, WEBP, or GIF.' });
  }

  const buffer = Buffer.from(base64Data, 'base64');

  // Maximum file size: 5MB
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: 'Image exceeds maximum allowed size of 5MB.' });
  }

  // Magic bytes validation
  let validMagicBytes = false;
  if (buffer.length >= 4) {
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) validMagicBytes = true;
    // PNG: 89 50 4E 47
    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) validMagicBytes = true;
    // GIF: GIF8
    else if (buffer.toString('ascii', 0, 4) === 'GIF8') validMagicBytes = true;
    // WEBP: RIFF....WEBP
    else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') validMagicBytes = true;
  }

  if (!validMagicBytes) {
    return res.status(400).json({ error: 'Invalid or corrupted image file.' });
  }

  const uploadsDir = path.resolve(process.cwd(), 'data/uploads/avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeFilename = `avatar_${viewer.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const filePath = path.join(uploadsDir, safeFilename);

  fs.writeFileSync(filePath, buffer);

  let newAvatarUrl = `/uploads/avatars/${safeFilename}`;

  // Upload to Supabase Storage for persistent cross-deployment availability
  const sb = getServerSupabase();
  if (sb) {
    try {
      const { error: storageErr } = await sb.storage
        .from('avatars')
        .upload(safeFilename, buffer, {
          contentType: mimeType,
          upsert: true
        });
      if (!storageErr) {
        const { data: publicData } = sb.storage.from('avatars').getPublicUrl(safeFilename);
        if (publicData?.publicUrl) {
          newAvatarUrl = publicData.publicUrl;
        }
      } else {
        console.warn('[Avatar Upload] Supabase storage upload warning:', storageErr.message);
      }
    } catch (uploadException: any) {
      console.warn('[Avatar Upload] Supabase storage exception:', uploadException?.message || uploadException);
    }
  }

  // Clean up previous uploaded avatar file
  if (viewer.avatarUrl) {
    try {
      if (viewer.avatarUrl.startsWith('/uploads/avatars/')) {
        const oldFilename = path.basename(viewer.avatarUrl);
        const oldFilePath = path.join(uploadsDir, oldFilename);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      } else if (viewer.avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const parts = viewer.avatarUrl.split('/storage/v1/object/public/avatars/');
        if (parts[1] && sb) {
          sb.storage.from('avatars').remove([parts[1]]).catch(() => {});
        }
      }
    } catch (cleanupErr) {
      console.warn('Failed to clean up old avatar:', cleanupErr);
    }
  }

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          avatarUrl: newAvatarUrl
        };
        return updatedUser;
      }
      return u;
    })
  );

  db.logAudit(viewer.id, viewer.username, 'AVATAR_UPLOADED', `New avatar saved: ${newAvatarUrl}`);

  return res.json({
    success: true,
    avatarUrl: newAvatarUrl,
    user: sanitizeUser(updatedUser)
  });
});

// DELETE /api/users/me/avatar (Remove profile photo)
usersRouter.delete('/me/avatar', async (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getServerSupabase();
  // Clean up previous uploaded avatar file
  if (viewer.avatarUrl) {
    try {
      if (viewer.avatarUrl.startsWith('/uploads/avatars/')) {
        const uploadsDir = path.resolve(process.cwd(), 'data/uploads/avatars');
        const oldFilename = path.basename(viewer.avatarUrl);
        const oldFilePath = path.join(uploadsDir, oldFilename);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      } else if (viewer.avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const parts = viewer.avatarUrl.split('/storage/v1/object/public/avatars/');
        if (parts[1] && sb) {
          await sb.storage.from('avatars').remove([parts[1]]);
        }
      }
    } catch {}
  }

  let updatedUser = viewer;
  db.update('users', (users) =>
    users.map((u) => {
      if (u.id === viewer.id) {
        updatedUser = {
          ...u,
          avatarUrl: ''
        };
        return updatedUser;
      }
      return u;
    })
  );

  db.logAudit(viewer.id, viewer.username, 'AVATAR_REMOVED', 'Removed custom profile photo');

  return res.json({
    success: true,
    avatarUrl: null,
    user: sanitizeUser(updatedUser)
  });
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

  return res.json({ user: sanitizeUser(updatedUser) });
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

  return res.json({ user: sanitizeUser(updatedUser) });
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
  return res.json({ success: true, user: sanitizeUser(updatedUser) });
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
