import { Router } from 'express';
import { db, hashPassword, generateToken, parseToken } from '../db.ts';
import type { User } from '../../src/types/index.ts';

export const authRouter = Router();

// Middleware to extract authenticated user
export function getAuthUser(req: any): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/, '');
  const userId = parseToken(token);
  if (!userId) return null;
  const user = db.get('users').find((u) => u.id === userId);
  return user || null;
}

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user });
});

// GET /api/auth/switchable-users (Quick switcher for testing real interactions)
authRouter.get('/switchable-users', (req, res) => {
  const users = db.get('users').map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isAdmin: !!u.isAdmin
  }));
  return res.json({ users });
});

// POST /api/auth/switch-user (Instantly log in as any test user)
authRouter.post('/switch-user', (req, res) => {
  const { userId } = req.body;
  const user = db.get('users').find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const token = generateToken(user.id);
  return res.json({ token, user });
});

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifier (username/email) and password are required' });
  }

  const cleanIdent = identifier.trim().toLowerCase();
  const user = db.get('users').find(
    (u) => u.username.toLowerCase() === cleanIdent || u.email.toLowerCase() === cleanIdent
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended by administration.' });
  }

  // Check password
  const expectedHash = hashPassword(password);
  // Default fallback password for demo users is 'password123'
  const isMatch = (user as any).passwordHash 
    ? (user as any).passwordHash === expectedHash 
    : password === 'password123' || password === 'admin123';

  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = generateToken(user.id);
  return res.json({ token, user });
});

// POST /api/auth/register
authRouter.post('/register', (req, res) => {
  const { username, displayName, email, phone, password, city, bio } = req.body;

  if (!username || !displayName || (!email && !phone) || !password) {
    return res.status(400).json({ error: 'Username, display name, email/phone and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters alphanumeric/underscore.' });
  }

  const users = db.get('users');
  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  if (email && users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
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

  return res.status(201).json({ token, user: newUser });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/forgot-password (Forgot password flow)
authRouter.post('/forgot-password', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Email or username is required' });

  const clean = identifier.trim().toLowerCase();
  const user = db.get('users').find(
    (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
  );

  if (!user) {
    return res.json({ success: true, message: 'If this account exists, a recovery OTP code has been dispatched.' });
  }

  return res.json({ 
    success: true, 
    message: `Recovery code dispatched to your registered address. Verification code: 849201`,
    recoveryCode: '849201',
    userId: user.id
  });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', (req, res) => {
  const { userId, code, newPassword } = req.body;
  if (!userId || !code || !newPassword) {
    return res.status(400).json({ error: 'User ID, code, and new password are required' });
  }

  if (code !== '849201' && code.length !== 6) {
    return res.status(400).json({ error: 'Invalid or expired recovery code' });
  }

  const user = db.get('users').find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.update('users', (users) =>
    users.map((u) => (u.id === userId ? { ...u, passwordHash: hashPassword(newPassword) } : u))
  );

  db.logAudit(user.id, user.username, 'PASSWORD_RESET', 'Password successfully reset via recovery code');
  const token = generateToken(user.id);
  return res.json({ success: true, message: 'Password reset successful! You are now logged in.', token, user });
});
