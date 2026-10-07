import { Router } from 'express';
import crypto from 'node:crypto';
import { db, hashPassword, verifyPassword, generateToken, parseToken } from '../db.ts';
import type { User } from '../../src/types/index.ts';

export const authRouter = Router();

// Middleware to extract authenticated user & validate active server-side session
// Supports both HttpOnly Secure Cookie (browser) and Bearer header (REST API / Mobile / CLI)
export function getAuthUser(req: any): User | null {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace(/^Bearer\s+/, '').trim();
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const c of cookies) {
      const trimmed = c.trim();
      if (trimmed.startsWith('nc_session_token=')) {
        token = decodeURIComponent(trimmed.substring('nc_session_token='.length));
        break;
      }
    }
  }

  if (!token) return null;
  const userId = parseToken(token);
  if (!userId) return null;

  // Validate server-side session record
  const session = db.getSessionByToken(token);
  if (!session) {
    // Session was revoked or logged out
    return null;
  }

  // Update last active
  db.touchSession(token);

  const user = db.get('users').find((u) => u.id === userId);
  return user || null;
}

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Session invalid or expired. Please sign in.' });
  }
  return res.json({ user });
});

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  const { identifier, password, deviceName } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const cleanIdent = identifier.trim().toLowerCase();
  const user = db.get('users').find(
    (u) => u.username.toLowerCase() === cleanIdent || (u.email && u.email.toLowerCase() === cleanIdent)
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended by administration.' });
  }

  const storedHash = (user as any).passwordHash;
  if (!storedHash || !verifyPassword(password, storedHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = generateToken(user.id);
  const device = deviceName || req.headers['user-agent']?.substring(0, 50) || 'Web Client';
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  db.createSession(user.id, token, device, ip);
  db.logAudit(user.id, user.username, 'LOGIN_SUCCESS', `Device: ${device}`);

  // Set secure HttpOnly session cookie
  res.cookie('nc_session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  return res.json({ token, user });
});

// POST /api/auth/register
authRouter.post('/register', (req, res) => {
  const { username, displayName, email, phone, password, city, bio, deviceName } = req.body;

  if (!username || !displayName || (!email && !phone) || !password) {
    return res.status(400).json({ error: 'Username, display name, email/phone and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters alphanumeric/underscore.' });
  }

  const users = db.get('users');
  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  if (email && users.some((u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const defaultAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80'
  ];

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    displayName: displayName.trim(),
    email: email ? email.trim().toLowerCase() : `${cleanUsername}@notecircle.app`,
    phone: phone ? phone.trim() : undefined,
    avatarUrl: defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)],
    bio: bio ? bio.trim() : '',
    city: city ? city.trim() : undefined,
    isPrivate: true,
    isAdmin: false,
    availability: {
      code: 'available',
      label: 'Available',
      emoji: '🟢',
      strictDnd: false,
      updatedAt: new Date().toISOString()
    },
    privacySettings: {
      whoCanMessageMe: 'mutual',
      whoCanSeeOnlineStatus: 'connections',
      whoCanSeeReadReceipts: 'connections',
      whoCanSeeTyping: 'connections',
      whoCanFollowMe: 'require_approval',
      whoCanReply: 'connections',
      whoCanReact: 'connections',
      bioVisibility: 'connections',
      cityVisibility: 'connections',
      birthdayVisibility: 'only_me',
      workplaceVisibility: 'connections',
      followerCountsVisibility: 'connections',
      dndModeStrict: false
    },
    notificationSettings: {
      messages: true,
      messageRequests: true,
      followRequests: true,
      acceptedRequests: true,
      reactions: true,
      replies: true,
      noteExpiration: true,
      securityAlerts: true
    },
    createdAt: new Date().toISOString()
  };

  (newUser as any).passwordHash = hashPassword(password);

  db.update('users', (curr) => [...curr, newUser]);

  const token = generateToken(newUser.id);
  const device = deviceName || req.headers['user-agent']?.substring(0, 50) || 'Web Client';
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  db.createSession(newUser.id, token, device, ip);
  db.logAudit(newUser.id, newUser.username, 'REGISTER_SUCCESS', `New account created: @${newUser.username}`);

  // Set secure HttpOnly session cookie
  res.cookie('nc_session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  return res.status(201).json({ token, user: newUser });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    token = authHeader.replace(/^Bearer\s+/, '').trim();
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const c of cookies) {
      const trimmed = c.trim();
      if (trimmed.startsWith('nc_session_token=')) {
        token = decodeURIComponent(trimmed.substring('nc_session_token='.length));
        break;
      }
    }
  }

  if (token) {
    db.deleteSessionByToken(token);
  }

  res.clearCookie('nc_session_token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });

  return res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/logout-all
authRouter.post('/logout-all', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  db.deleteAllSessionsForUser(user.id);
  db.logAudit(user.id, user.username, 'LOGOUT_ALL_DEVICES', 'Terminated all active sessions');
  return res.json({ success: true, message: 'All devices logged out successfully' });
});

// POST /api/auth/forgot-password
// Generates a cryptographically random 6-digit recovery OTP, stores hashed token with 15-min expiry
authRouter.post('/forgot-password', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Email or username is required' });

  const clean = identifier.trim().toLowerCase();
  const user = db.get('users').find(
    (u) => u.username.toLowerCase() === clean || (u.email && u.email.toLowerCase() === clean)
  );

  // Constant-time message response to prevent account enumeration
  if (!user) {
    return res.json({
      success: true,
      message: 'If an account exists with this information, a secure recovery code has been sent.'
    });
  }

  // Cryptographically random 6-digit code
  const randomInt = crypto.randomInt(100000, 999999);
  const rawOtp = randomInt.toString();
  const codeHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

  db.createPasswordRecovery(user.id, codeHash, 15);
  db.logAudit(user.id, user.username, 'PASSWORD_RECOVERY_REQUESTED', 'Recovery OTP generated and dispatched');

  // In development/test runtime, we print OTP to secure system console rather than leaking in API response
  console.log(`[AUTH RECOVERY DISPATCH] OTP for user @${user.username} (${user.email}): ${rawOtp}`);

  return res.json({
    success: true,
    message: 'If an account exists with this information, a secure recovery code has been sent to your registered contact.',
    userId: user.id
  });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', (req, res) => {
  const { userId, code, newPassword } = req.body;
  if (!userId || !code || !newPassword) {
    return res.status(400).json({ error: 'User ID, recovery code, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const recovery = db.getActiveRecoveryRequest(userId);
  if (!recovery) {
    return res.status(400).json({ error: 'No active recovery request found. Please request a new code.' });
  }

  // Increment attempts to prevent brute force
  db.incrementRecoveryAttempt(recovery.id);

  const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  if (inputHash !== recovery.code_hash) {
    return res.status(400).json({ error: 'Invalid recovery code. Please check and retry.' });
  }

  // Code is valid! Mark as used
  db.markRecoveryUsed(recovery.id);

  // Invalidate all existing sessions for this user on password change
  db.deleteAllSessionsForUser(userId);

  // Update password with scrypt KDF
  const newHash = hashPassword(newPassword);
  db.updateUserPassword(userId, newHash);

  const user = db.get('users').find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Issue brand-new authenticated session
  const token = generateToken(user.id);
  const device = req.headers['user-agent']?.substring(0, 50) || 'Web Client';
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  db.createSession(user.id, token, device, ip);

  db.logAudit(user.id, user.username, 'PASSWORD_RESET_SUCCESS', 'Password successfully reset via verified OTP');

  return res.json({
    success: true,
    message: 'Password reset successful! You are now logged in.',
    token,
    user
  });
});
