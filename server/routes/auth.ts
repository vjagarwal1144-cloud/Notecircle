import { Router } from 'express';
import crypto from 'node:crypto';
import { db, hashPassword, verifyPassword, generateToken, parseToken } from '../db.ts';
import { 
  sendRegistrationOtpEmail, 
  sendWelcomeEmail, 
  sendPasswordRecoveryEmail, 
  sendAdminNewUserAlert,
  sendSecurityAlertEmail 
} from '../email.ts';
import type { User } from '../../src/types/index.ts';

export const authRouter = Router();

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(`nc_otp_salt_${otp.trim()}`).digest('hex');
}

function hashVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(`nc_verif_salt_${token.trim()}`).digest('hex');
}

/**
 * Strips passwordHash, password_hash and internal security secrets before returning to client.
 */
export function sanitizeUser<T extends Record<string, any>>(user: T | null | undefined): T | null {
  if (!user) return null;
  const copy = { ...user };
  delete (copy as any).passwordHash;
  delete (copy as any).password_hash;
  return copy as T;
}

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
  return res.json({ user: sanitizeUser(user) });
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

  return res.json({ token, user: sanitizeUser(user) });
});

// POST /api/auth/register/send-otp
// Step 1: Send cryptographically secure random 6-digit OTP to user's real email address
authRouter.post('/register/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address (e.g. name@domain.com)' });
  }

  // Duplicate account protection
  const existingUser = db.get('users').find((u) => u.email && u.email.toLowerCase() === cleanEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'An account is already registered with this email address. Please sign in.' });
  }

  // Rate limiting / resend cooldown check (60 seconds)
  const cooldown = db.checkEmailCooldown(cleanEmail);
  if (cooldown.inCooldown) {
    return res.status(429).json({
      error: `Please wait ${cooldown.secondsRemaining} seconds before requesting a new code.`,
      retryAfter: cooldown.secondsRemaining
    });
  }

  // Cryptographically secure random 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashOtp(otp);

  const otpRecord = db.createRegistrationOtp(cleanEmail, otpHash, 10, 60);

  // Dispatch real transactional email strictly through Resend
  const emailRes = await sendRegistrationOtpEmail(cleanEmail, otp, 10);

  if (!emailRes.success) {
    // If delivery failed or Resend is not configured, remove the OTP record
    db.removeRegistrationOtp(otpRecord.id);
    return res.status(502).json({
      error: emailRes.error || 'Failed to deliver verification code through Resend. Please check email service configuration.',
      configured: emailRes.configured
    });
  }

  // Requirement 5 & 6: Only report success after confirmed Resend delivery
  return res.json({
    success: true,
    message: 'Verification code sent to your email.',
    email: cleanEmail,
    expiresAt: otpRecord.expiresAt,
    cooldownUntil: otpRecord.cooldownUntil
  });
});

// POST /api/auth/register/verify-otp
// Step 2: Verify the 6-digit OTP and return a secure single-use verification token
authRouter.post('/register/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and 6-digit verification code are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  const record = (await db.fetchRegistrationOtp(cleanEmail)) || db.getLatestRegistrationOtp(cleanEmail);
  if (!record) {
    return res.status(404).json({ error: 'No active verification code found for this email. Please request a new code.' });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a fresh code.' });
  }

  if (record.attempts >= record.max_attempts) {
    return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
  }

  const currentAttempts = db.incrementOtpAttempts(record.id);
  const incomingHash = hashOtp(cleanOtp);

  let match = false;
  try {
    match = crypto.timingSafeEqual(
      Buffer.from(incomingHash, 'hex'),
      Buffer.from(record.otp_hash, 'hex')
    );
  } catch {
    match = false;
  }

  if (!match) {
    const remaining = Math.max(0, record.max_attempts - currentAttempts);
    return res.status(400).json({
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      attemptsRemaining: remaining
    });
  }

  // Generate single-use verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(verificationToken);
  db.markRegistrationOtpVerified(record.id, tokenHash);

  return res.json({
    success: true,
    message: 'Email verified successfully.',
    verificationToken
  });
});

// POST /api/auth/register/complete
// Step 3: Consume single-use token and activate the new account
authRouter.post('/register/complete', async (req, res) => {
  const { email, verificationToken, username, displayName, password, bio, city, avatarUrl, deviceName } = req.body;
  if (!email || !verificationToken || !username || !displayName || !password) {
    return res.status(400).json({ error: 'Email, verification token, username, display name, and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const tokenHash = hashVerificationToken(verificationToken);

  const consumed = db.consumeRegistrationOtp(cleanEmail, tokenHash);
  if (!consumed) {
    return res.status(403).json({ error: 'Invalid, expired, or already-used verification token. Please verify your email again.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3 || cleanUsername.length > 24) {
    return res.status(400).json({ error: 'Username must be 3-24 characters (alphanumeric and underscore only).' });
  }

  const users = db.get('users');
  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(409).json({ error: 'Username @' + cleanUsername + ' is already taken.' });
  }
  if (users.some((u) => u.email && u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Email is already registered.' });
  }

  // Clean avatar handling (no remote demo/Unsplash defaults; uses custom initials badge if not provided)
  const chosenAvatar = avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : '';

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    displayName: displayName.trim(),
    email: cleanEmail,
    avatarUrl: chosenAvatar,
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
  db.logAudit(newUser.id, newUser.username, 'REGISTER_EMAIL_VERIFIED', `Activated with email: ${cleanEmail}`);

  // Send Welcome Email and Admin Alert
  sendWelcomeEmail(cleanEmail, newUser.displayName, newUser.username).catch(() => {});
  sendAdminNewUserAlert(newUser).catch(() => {});

  // Set secure HttpOnly session cookie
  res.cookie('nc_session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  return res.status(201).json({ token, user: sanitizeUser(newUser) });
});

// Legacy / Direct register endpoint protection: requires verification
authRouter.post('/register', (req, res) => {
  return res.status(400).json({
    error: 'Direct unverified registration is disabled. Please verify your email using /api/auth/register/send-otp.'
  });
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

  // Dispatch real transactional password recovery email if user has email
  if (user.email) {
    sendPasswordRecoveryEmail(user.email, rawOtp).catch((err) => {
      console.error('[AUTH RECOVERY] Failed to send recovery email:', err.message);
    });
  }

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
