import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { 
  User, 
  Connection, 
  Note, 
  Conversation, 
  Message, 
  AppNotification, 
  Report,
  BugReport
} from '../src/types/index.ts';

export interface DevicePublicKeyRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  publicKeyJwk: string;
  fingerprint: string;
  isRevoked: boolean;
  createdAt: string;
  lastSeen: string;
}

export interface DatabaseSchema {
  users: User[];
  connections: Connection[];
  closeFriends: { id: string; userId: string; friendId: string; createdAt: string }[];
  notes: Note[];
  conversations: Conversation[];
  messages: Message[];
  notifications: AppNotification[];
  reports: Report[];
  bugReports: BugReport[];
  auditLogs: { id: string; action: string; actorId: string; actorUsername: string; timestamp: string; details?: string }[];
  mutes: { id: string; userId: string; mutedUserId: string; createdAt: string }[];
  blocks: { id: string; userId: string; blockedUserId: string; createdAt: string }[];
  sessions: { id: string; userId: string; token: string; device: string; ip: string; createdAt: string; lastActive: string }[];
  devicePublicKeys: DevicePublicKeyRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'notecircle.db');

function getOrGenerateSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 32) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretFile = path.resolve(DATA_DIR, '.session_secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const fresh = crypto.randomBytes(32).toString('hex');
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(secretFile, fresh, { mode: 0o600 });
    return fresh;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SERVER_SECRET_KEY = getOrGenerateSessionSecret();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt:v1:${salt}:${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  // Handle scrypt:v1:salt:hash format
  if (storedHash.startsWith('scrypt:v1:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;
    const [, , salt, hash] = parts;
    const derived = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
  }
  // Legacy migration check (if old hex hash exists)
  try {
    const oldDerived = crypto.pbkdf2Sync(password, 'notecircle_secure_salt_2026', 1000, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(oldDerived, 'hex'));
  } catch {
    return false;
  }
}

export function generateToken(userId: string): string {
  const ts = Date.now().toString();
  const rand = crypto.randomBytes(16).toString('hex');
  const payload = `${userId}:${ts}:${rand}`;
  const hmac = crypto.createHmac('sha256', SERVER_SECRET_KEY).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function parseToken(token: string): string | null {
  try {
    if (!token) return null;
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 4) return null;
    const [userId, ts, rand, hmac] = parts;
    const payload = `${userId}:${ts}:${rand}`;
    const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET_KEY).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
    // Expire token after 30 days
    const createdTime = parseInt(ts, 10);
    if (isNaN(createdTime) || Date.now() - createdTime > 30 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return userId || null;
  } catch {
    return null;
  }
}

class SqlDatabaseManager {
  private sqlite: DatabaseSync;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.sqlite = new DatabaseSync(DB_FILE);
    this.sqlite.exec('PRAGMA journal_mode = WAL;');
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
    this.initTables();
    this.seedInitialIfEmpty();
  }

  private initTables(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        avatar_url TEXT,
        bio TEXT,
        city TEXT,
        birthday TEXT,
        workplace TEXT,
        is_private INTEGER DEFAULT 1,
        is_admin INTEGER DEFAULT 0,
        is_suspended INTEGER DEFAULT 0,
        availability TEXT,
        privacy_settings TEXT,
        notification_settings TEXT,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS close_friends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        author TEXT NOT NULL,
        emoji TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        text TEXT NOT NULL,
        audience TEXT NOT NULL,
        selected_user_ids TEXT,
        expires_at TEXT,
        scheduled_for TEXT,
        status TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        allow_replies INTEGER DEFAULT 1,
        allow_reactions INTEGER DEFAULT 1,
        reactions TEXT DEFAULT '[]',
        replies TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT,
        participant_ids TEXT NOT NULL,
        last_message TEXT,
        unread_count INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_avatar TEXT,
        text TEXT NOT NULL,
        encrypted_payload TEXT,
        reply_to_id TEXT,
        reply_preview TEXT,
        media_url TEXT,
        reactions TEXT DEFAULT '[]',
        status TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        deleted_for_me INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_avatar TEXT,
        type TEXT NOT NULL,
        entity_id TEXT,
        text TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL,
        reporter_username TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_author_name TEXT,
        target_content_preview TEXT,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL,
        action_taken TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bug_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        error_identifier TEXT,
        screenshot TEXT,
        device_info TEXT NOT NULL,
        status TEXT NOT NULL,
        resolution_note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        blocked_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mutes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        muted_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        device TEXT NOT NULL,
        ip TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS password_recovery_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        title TEXT NOT NULL,
        emoji TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        location TEXT,
        rsvps TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_capsules (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        title TEXT NOT NULL,
        cover_emoji TEXT NOT NULL,
        unlock_at TEXT,
        items TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS device_public_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        public_key_jwk TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        is_revoked INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        last_seen TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verified_safety_numbers (
        user_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        PRIMARY KEY (user_id, contact_id)
      );

      CREATE TABLE IF NOT EXISTS registration_otps (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        resend_available_at TEXT NOT NULL,
        verified INTEGER DEFAULT 0,
        verification_token_hash TEXT,
        used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS email_logs (
        id TEXT PRIMARY KEY,
        recipient TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_connections_users ON connections (requester_id, target_id);
      CREATE INDEX IF NOT EXISTS idx_notes_user_status ON notes (user_id, status);
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id);
      CREATE INDEX IF NOT EXISTS idx_notifs_recip ON notifications (recipient_id);
      CREATE INDEX IF NOT EXISTS idx_device_keys_user ON device_public_keys (user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
      CREATE INDEX IF NOT EXISTS idx_recovery_user ON password_recovery_requests (user_id);
      CREATE INDEX IF NOT EXISTS idx_safety_user ON verified_safety_numbers (user_id);
      CREATE INDEX IF NOT EXISTS idx_reg_email ON registration_otps (email);
      CREATE INDEX IF NOT EXISTS idx_email_recipient ON email_logs (recipient);
    `);
  }

  private cleanSeedDemoDataAndPreserveReal(): void {
    // Strictly preserve real user accounts while purging demo/fake seeded content
    const demoUserIds = ['usr_rahul', 'usr_priya', 'usr_amit', 'usr_admin'];
    for (const id of demoUserIds) {
      this.sqlite.prepare('DELETE FROM users WHERE id = ?;').run(id);
      this.sqlite.prepare('DELETE FROM notes WHERE user_id = ?;').run(id);
      this.sqlite.prepare('DELETE FROM connections WHERE requester_id = ? OR target_id = ?;').run(id, id);
      this.sqlite.prepare('DELETE FROM close_friends WHERE user_id = ? OR friend_id = ?;').run(id, id);
      this.sqlite.prepare('DELETE FROM messages WHERE sender_id = ?;').run(id);
      this.sqlite.prepare('DELETE FROM plans WHERE creator_id = ?;').run(id);
      this.sqlite.prepare('DELETE FROM memory_capsules WHERE creator_id = ?;').run(id);
      this.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?;').run(id);
      this.sqlite.prepare('DELETE FROM notifications WHERE recipient_id = ? OR sender_id = ?;').run(id, id);
    }
    this.sqlite.prepare("DELETE FROM conversations WHERE id = 'conv_rp_seed';").run();
    // Grant verified admin privileges to real owner emails
    this.sqlite.prepare("UPDATE users SET is_admin = 1 WHERE email IN ('vjagarwal1133@gmail.com', 'vjagarwal1144@gmail.com');").run();
  }

  private seedInitialIfEmpty(): void {
    // Demo seeding is permanently disabled in favor of real database persistence
    this.cleanSeedDemoDataAndPreserveReal();
  }

  // Generic getter mapped to SQL tables
  public get<K extends keyof DatabaseSchema>(table: K): DatabaseSchema[K] {
    switch (table) {
      case 'users': {
        const rows = this.sqlite.prepare('SELECT * FROM users ORDER BY created_at ASC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          email: r.email,
          phone: r.phone || undefined,
          avatarUrl: r.avatar_url,
          bio: r.bio || '',
          city: r.city || undefined,
          birthday: r.birthday || undefined,
          workplace: r.workplace || undefined,
          isPrivate: r.is_private === 1,
          isAdmin: r.is_admin === 1,
          isSuspended: r.is_suspended === 1,
          availability: r.availability ? JSON.parse(r.availability) : undefined,
          privacySettings: r.privacy_settings ? JSON.parse(r.privacy_settings) : undefined,
          notificationSettings: r.notification_settings ? JSON.parse(r.notification_settings) : undefined,
          passwordHash: r.password_hash,
          createdAt: r.created_at
        })) as unknown as DatabaseSchema[K];
      }
      case 'connections': {
        const rows = this.sqlite.prepare('SELECT * FROM connections;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          requesterId: r.requester_id,
          targetId: r.target_id,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })) as DatabaseSchema[K];
      }
      case 'closeFriends': {
        const rows = this.sqlite.prepare('SELECT * FROM close_friends;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          friendId: r.friend_id,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'notes': {
        const rows = this.sqlite.prepare('SELECT * FROM notes ORDER BY created_at DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          author: JSON.parse(r.author),
          emoji: r.emoji,
          category: r.category,
          categoryLabel: r.category_label,
          text: r.text,
          audience: r.audience,
          selectedUserIds: r.selected_user_ids ? JSON.parse(r.selected_user_ids) : undefined,
          expiresAt: r.expires_at || null,
          scheduledFor: r.scheduled_for || null,
          status: r.status,
          isPinned: r.is_pinned === 1,
          isDraft: r.is_draft === 1,
          allowReplies: r.allow_replies === 1,
          allowReactions: r.allow_reactions === 1,
          reactions: JSON.parse(r.reactions || '[]'),
          replies: JSON.parse(r.replies || '[]'),
          createdAt: r.created_at,
          updatedAt: r.updated_at || undefined
        })) as DatabaseSchema[K];
      }
      case 'conversations': {
        const rows = this.sqlite.prepare('SELECT * FROM conversations ORDER BY updated_at DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title || undefined,
          participantIds: JSON.parse(r.participant_ids),
          participants: [],
          lastMessage: r.last_message ? JSON.parse(r.last_message) : undefined,
          unreadCount: r.unread_count,
          isMuted: r.is_muted === 1,
          isArchived: r.is_archived === 1,
          isPinned: r.is_pinned === 1,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })) as unknown as DatabaseSchema[K];
      }
      case 'messages': {
        const rows = this.sqlite.prepare('SELECT * FROM messages ORDER BY created_at ASC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          conversationId: r.conversation_id,
          senderId: r.sender_id,
          senderName: r.sender_name,
          senderAvatar: r.sender_avatar || undefined,
          text: r.text,
          encryptedPayload: r.encrypted_payload || undefined,
          replyToId: r.reply_to_id || undefined,
          replyPreview: r.reply_preview ? JSON.parse(r.reply_preview) : undefined,
          mediaUrl: r.media_url || undefined,
          reactions: JSON.parse(r.reactions || '[]'),
          status: r.status,
          isDeleted: r.is_deleted === 1,
          deletedForMe: r.deleted_for_me === 1,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'notifications': {
        const rows = this.sqlite.prepare('SELECT * FROM notifications ORDER BY created_at DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          recipientId: r.recipient_id,
          senderId: r.sender_id,
          senderName: r.sender_name,
          senderAvatar: r.sender_avatar,
          type: r.type,
          entityId: r.entity_id || undefined,
          text: r.text,
          read: r.read === 1,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'reports': {
        const rows = this.sqlite.prepare('SELECT * FROM reports ORDER BY created_at DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          reporterId: r.reporter_id,
          reporterUsername: r.reporter_username,
          targetType: r.target_type,
          targetId: r.target_id,
          targetAuthorName: r.target_author_name || undefined,
          targetContentPreview: r.target_content_preview || undefined,
          reason: r.reason,
          details: r.details || undefined,
          status: r.status,
          actionTaken: r.action_taken || undefined,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'bugReports': {
        const rows = this.sqlite.prepare('SELECT * FROM bug_reports ORDER BY created_at DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          username: r.username,
          category: r.category,
          description: r.description,
          errorIdentifier: r.error_identifier || undefined,
          screenshot: r.screenshot || undefined,
          deviceInfo: JSON.parse(r.device_info),
          status: r.status,
          resolutionNote: r.resolution_note || undefined,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'auditLogs': {
        const rows = this.sqlite.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          action: r.action,
          actorId: r.actor_id,
          actorUsername: r.actor_username,
          timestamp: r.timestamp,
          details: r.details || undefined
        })) as DatabaseSchema[K];
      }
      case 'blocks': {
        const rows = this.sqlite.prepare('SELECT * FROM blocks;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          blockedUserId: r.blocked_user_id,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'mutes': {
        const rows = this.sqlite.prepare('SELECT * FROM mutes;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          mutedUserId: r.muted_user_id,
          createdAt: r.created_at
        })) as DatabaseSchema[K];
      }
      case 'sessions': {
        const rows = this.sqlite.prepare('SELECT * FROM sessions ORDER BY last_active DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          token: r.token,
          device: r.device,
          ip: r.ip,
          createdAt: r.created_at,
          lastActive: r.last_active
        })) as DatabaseSchema[K];
      }
      case 'devicePublicKeys': {
        const rows = this.sqlite.prepare('SELECT * FROM device_public_keys ORDER BY created_at DESC;').all() as any[];
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          deviceId: r.device_id,
          deviceName: r.device_name,
          publicKeyJwk: r.public_key_jwk,
          fingerprint: r.fingerprint,
          isRevoked: r.is_revoked === 1,
          createdAt: r.created_at,
          lastSeen: r.last_seen
        })) as DatabaseSchema[K];
      }
      default:
        return [] as any;
    }
  }

  // Generic updater executing SQL transactions
  public update<K extends keyof DatabaseSchema>(
    table: K,
    updater: (curr: DatabaseSchema[K]) => DatabaseSchema[K]
  ): void {
    const current = this.get(table);
    const updated = updater(current);

    this.sqlite.exec('BEGIN TRANSACTION;');
    try {
      switch (table) {
        case 'users': {
          this.sqlite.exec('DELETE FROM users;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO users (
              id, username, display_name, email, phone, avatar_url, bio, city, birthday, workplace,
              is_private, is_admin, is_suspended, availability, privacy_settings, notification_settings, password_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const u of updated as User[]) {
            stmt.run(
              u.id,
              u.username,
              u.displayName,
              u.email,
              u.phone || null,
              u.avatarUrl || null,
              u.bio || null,
              u.city || null,
              u.birthday || null,
              u.workplace || null,
              u.isPrivate ? 1 : 0,
              u.isAdmin ? 1 : 0,
              u.isSuspended ? 1 : 0,
              JSON.stringify(u.availability || {}),
              JSON.stringify(u.privacySettings || {}),
              JSON.stringify(u.notificationSettings || {}),
              (u as any).passwordHash || '',
              u.createdAt
            );
          }
          break;
        }
        case 'connections': {
          this.sqlite.exec('DELETE FROM connections;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO connections (id, requester_id, target_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?);
          `);
          for (const c of updated as Connection[]) {
            stmt.run(c.id, c.requesterId, c.targetId, c.status, c.createdAt, c.updatedAt);
          }
          break;
        }
        case 'closeFriends': {
          this.sqlite.exec('DELETE FROM close_friends;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO close_friends (id, user_id, friend_id, created_at)
            VALUES (?, ?, ?, ?);
          `);
          for (const cf of updated as any[]) {
            stmt.run(cf.id, cf.userId, cf.friendId, cf.createdAt);
          }
          break;
        }
        case 'notes': {
          this.sqlite.exec('DELETE FROM notes;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO notes (
              id, user_id, author, emoji, category, category_label, text, audience, selected_user_ids,
              expires_at, scheduled_for, status, is_pinned, is_draft, allow_replies, allow_reactions, reactions, replies, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const n of updated as Note[]) {
            stmt.run(
              n.id,
              n.userId,
              JSON.stringify(n.author),
              n.emoji,
              n.category,
              n.categoryLabel,
              n.text,
              n.audience,
              n.selectedUserIds ? JSON.stringify(n.selectedUserIds) : null,
              n.expiresAt || null,
              n.scheduledFor || null,
              n.status,
              n.isPinned ? 1 : 0,
              n.isDraft ? 1 : 0,
              n.allowReplies !== false ? 1 : 0,
              n.allowReactions !== false ? 1 : 0,
              JSON.stringify(n.reactions || []),
              JSON.stringify(n.replies || []),
              n.createdAt,
              n.updatedAt || null
            );
          }
          break;
        }
        case 'conversations': {
          this.sqlite.exec('DELETE FROM conversations;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO conversations (id, type, title, participant_ids, last_message, unread_count, is_muted, is_archived, is_pinned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const c of updated as Conversation[]) {
            stmt.run(
              c.id,
              c.type,
              c.title || null,
              JSON.stringify(c.participantIds),
              c.lastMessage ? JSON.stringify(c.lastMessage) : null,
              c.unreadCount || 0,
              c.isMuted ? 1 : 0,
              c.isArchived ? 1 : 0,
              c.isPinned ? 1 : 0,
              c.createdAt,
              c.updatedAt
            );
          }
          break;
        }
        case 'messages': {
          this.sqlite.exec('DELETE FROM messages;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO messages (
              id, conversation_id, sender_id, sender_name, sender_avatar, text, encrypted_payload,
              reply_to_id, reply_preview, media_url, reactions, status, is_deleted, deleted_for_me, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const m of updated as Message[]) {
            stmt.run(
              m.id,
              m.conversationId,
              m.senderId,
              m.senderName,
              m.senderAvatar || null,
              m.text,
              m.encryptedPayload || null,
              m.replyToId || null,
              m.replyPreview ? JSON.stringify(m.replyPreview) : null,
              m.mediaUrl || null,
              JSON.stringify(m.reactions || []),
              m.status,
              m.isDeleted ? 1 : 0,
              m.deletedForMe ? 1 : 0,
              m.createdAt
            );
          }
          break;
        }
        case 'notifications': {
          this.sqlite.exec('DELETE FROM notifications;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO notifications (id, recipient_id, sender_id, sender_name, sender_avatar, type, entity_id, text, read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const notif of updated as AppNotification[]) {
            stmt.run(
              notif.id,
              notif.recipientId,
              notif.senderId,
              notif.senderName,
              notif.senderAvatar,
              notif.type,
              notif.entityId || null,
              notif.text,
              notif.read ? 1 : 0,
              notif.createdAt
            );
          }
          break;
        }
        case 'reports': {
          this.sqlite.exec('DELETE FROM reports;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO reports (id, reporter_id, reporter_username, target_type, target_id, target_author_name, target_content_preview, reason, details, status, action_taken, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const r of updated as Report[]) {
            stmt.run(
              r.id,
              r.reporterId,
              r.reporterUsername,
              r.targetType,
              r.targetId,
              r.targetAuthorName || null,
              r.targetContentPreview || null,
              r.reason,
              r.details || null,
              r.status,
              r.actionTaken || null,
              r.createdAt
            );
          }
          break;
        }
        case 'bugReports': {
          this.sqlite.exec('DELETE FROM bug_reports;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO bug_reports (id, user_id, username, category, description, error_identifier, screenshot, device_info, status, resolution_note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const b of updated as BugReport[]) {
            stmt.run(
              b.id,
              b.userId,
              b.username,
              b.category,
              b.description,
              b.errorIdentifier || null,
              b.screenshot || null,
              JSON.stringify(b.deviceInfo),
              b.status,
              b.resolutionNote || null,
              b.createdAt
            );
          }
          break;
        }
        case 'auditLogs': {
          this.sqlite.exec('DELETE FROM audit_logs;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO audit_logs (id, action, actor_id, actor_username, timestamp, details)
            VALUES (?, ?, ?, ?, ?, ?);
          `);
          for (const a of updated as any[]) {
            stmt.run(a.id, a.action, a.actorId, a.actorUsername, a.timestamp, a.details || null);
          }
          break;
        }
        case 'blocks': {
          this.sqlite.exec('DELETE FROM blocks;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO blocks (id, user_id, blocked_user_id, created_at)
            VALUES (?, ?, ?, ?);
          `);
          for (const b of updated as any[]) {
            stmt.run(b.id, b.userId, b.blockedUserId, b.createdAt);
          }
          break;
        }
        case 'mutes': {
          this.sqlite.exec('DELETE FROM mutes;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO mutes (id, user_id, muted_user_id, created_at)
            VALUES (?, ?, ?, ?);
          `);
          for (const m of updated as any[]) {
            stmt.run(m.id, m.userId, m.mutedUserId, m.createdAt);
          }
          break;
        }
        case 'sessions': {
          this.sqlite.exec('DELETE FROM sessions;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO sessions (id, user_id, token, device, ip, created_at, last_active)
            VALUES (?, ?, ?, ?, ?, ?, ?);
          `);
          for (const s of updated as any[]) {
            stmt.run(s.id, s.userId, s.token, s.device, s.ip, s.createdAt, s.lastActive);
          }
          break;
        }
        case 'devicePublicKeys': {
          this.sqlite.exec('DELETE FROM device_public_keys;');
          const stmt = this.sqlite.prepare(`
            INSERT INTO device_public_keys (id, user_id, device_id, device_name, public_key_jwk, fingerprint, is_revoked, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
          `);
          for (const k of updated as DevicePublicKeyRecord[]) {
            stmt.run(k.id, k.userId, k.deviceId, k.deviceName, k.publicKeyJwk, k.fingerprint, k.isRevoked ? 1 : 0, k.createdAt, k.lastSeen);
          }
          break;
        }
      }
      this.sqlite.exec('COMMIT;');
    } catch (err) {
      this.sqlite.exec('ROLLBACK;');
      console.error(`Database transaction error on ${table}:`, err);
      throw err;
    }
  }

  public backupDatabase(destinationPath: string): void {
    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(destinationPath)) {
      fs.unlinkSync(destinationPath);
    }
    this.sqlite.exec(`VACUUM INTO '${destinationPath}';`);
  }

  public logAudit(actorId: string, actorUsername: string, action: string, details?: string): void {
    const stmt = this.sqlite.prepare(`
      INSERT INTO audit_logs (id, action, actor_id, actor_username, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?);
    `);
    stmt.run(`audit_${Date.now()}`, action, actorId, actorUsername, new Date().toISOString(), details || null);
  }

  public resetToDefault(): void {
    this.sqlite.exec(`
      DELETE FROM users;
      DELETE FROM connections;
      DELETE FROM close_friends;
      DELETE FROM notes;
      DELETE FROM conversations;
      DELETE FROM messages;
      DELETE FROM notifications;
      DELETE FROM reports;
      DELETE FROM bug_reports;
      DELETE FROM audit_logs;
      DELETE FROM blocks;
      DELETE FROM mutes;
      DELETE FROM sessions;
      DELETE FROM password_recovery_requests;
      DELETE FROM plans;
      DELETE FROM memory_capsules;
    `);
    this.seedInitialIfEmpty();
  }

  // --- Session Management (Direct SQL) ---
  public createSession(userId: string, token: string, device: string, ip: string): void {
    const id = `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const stmt = this.sqlite.prepare(`
      INSERT INTO sessions (id, user_id, token, device, ip, created_at, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `);
    stmt.run(id, userId, token, device, ip, now, now);
  }

  public getSessionByToken(token: string): { id: string; userId: string; device: string; ip: string; lastActive: string } | null {
    const row = this.sqlite.prepare('SELECT * FROM sessions WHERE token = ?;').get(token) as any;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      device: row.device,
      ip: row.ip,
      lastActive: row.last_active
    };
  }

  public touchSession(token: string): void {
    const now = new Date().toISOString();
    this.sqlite.prepare('UPDATE sessions SET last_active = ? WHERE token = ?;').run(now, token);
  }

  public deleteSessionByToken(token: string): void {
    this.sqlite.prepare('DELETE FROM sessions WHERE token = ?;').run(token);
  }

  public deleteSessionById(id: string, userId: string): void {
    this.sqlite.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?;').run(id, userId);
  }

  public deleteAllSessionsForUser(userId: string, exceptToken?: string): void {
    if (exceptToken) {
      this.sqlite.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?;').run(userId, exceptToken);
    } else {
      this.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?;').run(userId);
    }
  }

  public getUserSessions(userId: string, currentToken?: string): Array<{ id: string; device: string; ip: string; current: boolean; lastActive: string }> {
    const rows = this.sqlite.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_active DESC;').all(userId) as any[];
    return rows.map((r) => ({
      id: r.id,
      device: r.device,
      ip: r.ip,
      current: r.token === currentToken,
      lastActive: r.last_active
    }));
  }

  // --- Password Recovery Requests ---
  public createPasswordRecovery(userId: string, codeHash: string, expiresInMinutes = 15): string {
    const id = `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    // Invalidate prior requests for this user
    this.sqlite.prepare('UPDATE password_recovery_requests SET used = 1 WHERE user_id = ? AND used = 0;').run(userId);
    this.sqlite.prepare(`
      INSERT INTO password_recovery_requests (id, user_id, code_hash, expires_at, attempts, used, created_at)
      VALUES (?, ?, ?, ?, 0, 0, ?);
    `).run(id, userId, codeHash, expiresAt, now);
    return id;
  }

  public getActiveRecoveryRequest(userId: string): any {
    const now = new Date().toISOString();
    return this.sqlite.prepare(`
      SELECT * FROM password_recovery_requests
      WHERE user_id = ? AND used = 0 AND expires_at > ? AND attempts < 5
      ORDER BY created_at DESC LIMIT 1;
    `).get(userId, now);
  }

  public incrementRecoveryAttempt(id: string): void {
    this.sqlite.prepare('UPDATE password_recovery_requests SET attempts = attempts + 1 WHERE id = ?;').run(id);
  }

  public markRecoveryUsed(id: string): void {
    this.sqlite.prepare('UPDATE password_recovery_requests SET used = 1 WHERE id = ?;').run(id);
  }

  // --- Direct SQL for Users ---
  public updateUserPassword(userId: string, newPasswordHash: string): void {
    this.sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?;').run(newPasswordHash, userId);
  }

  public purgeUserData(userId: string): void {
    this.sqlite.exec('BEGIN TRANSACTION;');
    try {
      this.sqlite.prepare('DELETE FROM users WHERE id = ?;').run(userId);
      this.sqlite.prepare('DELETE FROM notes WHERE user_id = ?;').run(userId);
      this.sqlite.prepare('DELETE FROM connections WHERE requester_id = ? OR target_id = ?;').run(userId, userId);
      this.sqlite.prepare('DELETE FROM close_friends WHERE user_id = ? OR friend_id = ?;').run(userId, userId);
      this.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?;').run(userId);
      this.sqlite.prepare('DELETE FROM device_public_keys WHERE user_id = ?;').run(userId);
      this.sqlite.prepare('DELETE FROM blocks WHERE user_id = ? OR blocked_user_id = ?;').run(userId, userId);
      this.sqlite.prepare('DELETE FROM mutes WHERE user_id = ? OR muted_user_id = ?;').run(userId, userId);
      this.sqlite.prepare('DELETE FROM password_recovery_requests WHERE user_id = ?;').run(userId);
      this.sqlite.exec('COMMIT;');
    } catch (err) {
      this.sqlite.exec('ROLLBACK;');
      throw err;
    }
  }

  // --- Plans (Signature Feature with Strict Circle Authorization) ---
  public getPlansForUser(userId: string): any[] {
    const connections = this.sqlite.prepare(`
      SELECT target_id as contact_id FROM connections WHERE requester_id = ? AND status = 'ACCEPTED'
      UNION
      SELECT requester_id as contact_id FROM connections WHERE target_id = ? AND status = 'ACCEPTED';
    `).all(userId, userId) as any[];
    const authorizedCreatorIds = new Set<string>([userId, ...connections.map((c) => c.contact_id)]);

    const rows = this.sqlite.prepare('SELECT * FROM plans ORDER BY scheduled_time ASC;').all() as any[];
    return rows
      .filter((r) => {
        // Creator themselves, or connected circle member, or user in rsvps
        if (authorizedCreatorIds.has(r.creator_id)) return true;
        const rsvps = JSON.parse(r.rsvps || '[]');
        return rsvps.some((rsvp: any) => rsvp.userId === userId);
      })
      .map((r) => ({
        id: r.id,
        creatorId: r.creator_id,
        title: r.title,
        emoji: r.emoji,
        scheduledTime: r.scheduled_time,
        location: r.location,
        rsvps: JSON.parse(r.rsvps || '[]'),
        createdAt: r.created_at
      }));
  }

  public getPlanById(planId: string): any | null {
    const r = this.sqlite.prepare('SELECT * FROM plans WHERE id = ?;').get(planId) as any;
    if (!r) return null;
    return {
      id: r.id,
      creatorId: r.creator_id,
      title: r.title,
      emoji: r.emoji,
      scheduledTime: r.scheduled_time,
      location: r.location,
      rsvps: JSON.parse(r.rsvps || '[]'),
      createdAt: r.created_at
    };
  }

  public createPlan(plan: { id: string; creatorId: string; title: string; emoji: string; scheduledTime: string; location?: string }): void {
    this.sqlite.prepare(`
      INSERT INTO plans (id, creator_id, title, emoji, scheduled_time, location, rsvps, created_at)
      VALUES (?, ?, ?, ?, ?, ?, '[]', ?);
    `).run(plan.id, plan.creatorId, plan.title, plan.emoji, plan.scheduledTime, plan.location || null, new Date().toISOString());
  }

  public updatePlanRsvp(planId: string, userId: string, username: string, status: 'attending' | 'maybe' | 'declined'): boolean {
    const row = this.sqlite.prepare('SELECT * FROM plans WHERE id = ?;').get(planId) as any;
    if (!row) return false;

    // Authorization check: User must be creator or in creator's accepted circle
    const isCreator = row.creator_id === userId;
    let isConnected = false;
    if (!isCreator) {
      const conn = this.sqlite.prepare(`
        SELECT 1 FROM connections 
        WHERE ((requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?))
        AND status = 'ACCEPTED';
      `).get(userId, row.creator_id, row.creator_id, userId);
      isConnected = !!conn;
    }

    if (!isCreator && !isConnected) {
      return false; // Unauthorized to RSVP to plans outside their circle
    }

    const rsvps = JSON.parse(row.rsvps || '[]');
    const existingIdx = rsvps.findIndex((r: any) => r.userId === userId);
    if (existingIdx >= 0) {
      rsvps[existingIdx].status = status;
      rsvps[existingIdx].updatedAt = new Date().toISOString();
    } else {
      rsvps.push({ userId, username, status, updatedAt: new Date().toISOString() });
    }
    this.sqlite.prepare('UPDATE plans SET rsvps = ? WHERE id = ?;').run(JSON.stringify(rsvps), planId);
    return true;
  }

  // --- Memory Capsules (Signature Feature with Zero Content Leakage Prior to Unlock) ---
  public getMemoryCapsules(userId: string): any[] {
    const connections = this.sqlite.prepare(`
      SELECT target_id as contact_id FROM connections WHERE requester_id = ? AND status = 'ACCEPTED'
      UNION
      SELECT requester_id as contact_id FROM connections WHERE target_id = ? AND status = 'ACCEPTED';
    `).all(userId, userId) as any[];
    const circleMemberIds = new Set<string>([userId, ...connections.map((c) => c.contact_id)]);

    const rows = this.sqlite.prepare('SELECT * FROM memory_capsules ORDER BY created_at DESC;').all() as any[];
    const now = Date.now();

    return rows
      .filter((r) => circleMemberIds.has(r.creator_id))
      .map((r) => {
        const isLocked = r.unlock_at ? new Date(r.unlock_at).getTime() > now : false;
        return {
          id: r.id,
          creatorId: r.creator_id,
          title: r.title,
          coverEmoji: r.cover_emoji,
          unlockAt: r.unlock_at,
          isLocked,
          // CRITICAL ZERO DATA LEAKAGE: contents strictly stripped if capsule is locked!
          items: isLocked ? [] : JSON.parse(r.items || '[]'),
          createdAt: r.created_at
        };
      });
  }

  public createMemoryCapsule(capsule: { id: string; creatorId: string; title: string; coverEmoji: string; unlockAt?: string; items: any[] }): void {
    this.sqlite.prepare(`
      INSERT INTO memory_capsules (id, creator_id, title, cover_emoji, unlock_at, items, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).run(capsule.id, capsule.creatorId, capsule.title, capsule.coverEmoji, capsule.unlockAt || null, JSON.stringify(capsule.items || []), new Date().toISOString());
  }

  // --- Out-of-band Safety Numbers Verification State ---
  public isSafetyNumberVerified(userId: string, contactId: string): boolean {
    const row = this.sqlite.prepare('SELECT 1 FROM verified_safety_numbers WHERE user_id = ? AND contact_id = ?;').get(userId, contactId);
    return !!row;
  }

  public setSafetyNumberVerified(userId: string, contactId: string, verified: boolean): void {
    if (verified) {
      this.sqlite.prepare(`
        INSERT OR REPLACE INTO verified_safety_numbers (user_id, contact_id, verified_at)
        VALUES (?, ?, ?);
      `).run(userId, contactId, new Date().toISOString());
    } else {
      this.sqlite.prepare('DELETE FROM verified_safety_numbers WHERE user_id = ? AND contact_id = ?;').run(userId, contactId);
    }
  }

  // --- Registration OTP Management ---
  public createRegistrationOtp(email: string, otpHash: string, expiresMinutes = 10, cooldownSeconds = 60): { id: string; expiresAt: string; cooldownUntil: string } {
    const id = `otp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();
    const expiresAt = new Date(now + expiresMinutes * 60 * 1000).toISOString();
    const resendAvailableAt = new Date(now + cooldownSeconds * 1000).toISOString();
    const createdAt = new Date(now).toISOString();

    // Invalidate previous unverified OTPs for this email
    this.sqlite.prepare('UPDATE registration_otps SET used = 1 WHERE email = ? AND verified = 0;').run(email);

    this.sqlite.prepare(`
      INSERT INTO registration_otps (id, email, otp_hash, expires_at, attempts, max_attempts, resend_available_at, verified, used, created_at)
      VALUES (?, ?, ?, ?, 0, 5, ?, 0, 0, ?);
    `).run(id, email, otpHash, expiresAt, resendAvailableAt, createdAt);

    return { id, expiresAt, cooldownUntil: resendAvailableAt };
  }

  public removeRegistrationOtp(id: string): void {
    this.sqlite.prepare('DELETE FROM registration_otps WHERE id = ?;').run(id);
  }

  public getLatestRegistrationOtp(email: string): any {
    return this.sqlite.prepare(`
      SELECT * FROM registration_otps
      WHERE email = ? AND used = 0
      ORDER BY created_at DESC
      LIMIT 1;
    `).get(email);
  }

  public checkEmailCooldown(email: string): { inCooldown: boolean; secondsRemaining: number } {
    const latest = this.sqlite.prepare(`
      SELECT resend_available_at FROM registration_otps
      WHERE email = ?
      ORDER BY created_at DESC
      LIMIT 1;
    `).get(email) as any;

    if (!latest) return { inCooldown: false, secondsRemaining: 0 };
    const cooldownTime = new Date(latest.resend_available_at).getTime();
    const diff = cooldownTime - Date.now();
    if (diff > 0) {
      return { inCooldown: true, secondsRemaining: Math.ceil(diff / 1000) };
    }
    return { inCooldown: false, secondsRemaining: 0 };
  }

  public incrementOtpAttempts(id: string): number {
    this.sqlite.prepare('UPDATE registration_otps SET attempts = attempts + 1 WHERE id = ?;').run(id);
    const row = this.sqlite.prepare('SELECT attempts, max_attempts FROM registration_otps WHERE id = ?;').get(id) as any;
    return row ? row.attempts : 0;
  }

  public markRegistrationOtpVerified(id: string, verificationTokenHash: string): void {
    this.sqlite.prepare(`
      UPDATE registration_otps
      SET verified = 1, verification_token_hash = ?
      WHERE id = ?;
    `).run(verificationTokenHash, id);
  }

  public consumeRegistrationOtp(email: string, verificationTokenHash: string): boolean {
    const row = this.sqlite.prepare(`
      SELECT id FROM registration_otps
      WHERE email = ? AND verification_token_hash = ? AND verified = 1 AND used = 0;
    `).get(email, verificationTokenHash) as any;

    if (!row) return false;

    this.sqlite.prepare('UPDATE registration_otps SET used = 1 WHERE id = ?;').run(row.id);
    return true;
  }

  // --- Transactional Email Logs ---
  public logEmail(recipient: string, type: string, status: string, provider: string, error?: string): void {
    const id = `elog_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.sqlite.prepare(`
      INSERT INTO email_logs (id, recipient, type, status, provider, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).run(id, recipient, type, status, provider, error || null, new Date().toISOString());
  }

  public getEmailLogs(limit = 100): any[] {
    return this.sqlite.prepare(`
      SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ?;
    `).all(limit) as any[];
  }
}

export const db = new SqlDatabaseManager();
