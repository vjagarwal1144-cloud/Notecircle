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

export function hashPassword(password: string): string {
  const salt = 'notecircle_secure_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

export function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  return Buffer.from(payload).toString('base64');
}

export function parseToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const [userId] = raw.split(':');
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

      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_connections_users ON connections (requester_id, target_id);
      CREATE INDEX IF NOT EXISTS idx_notes_user_status ON notes (user_id, status);
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id);
      CREATE INDEX IF NOT EXISTS idx_notifs_recip ON notifications (recipient_id);
      CREATE INDEX IF NOT EXISTS idx_device_keys_user ON device_public_keys (user_id);
    `);
  }

  private seedInitialIfEmpty(): void {
    const userCount = (this.sqlite.prepare('SELECT count(*) as count FROM users;').get() as any)?.count || 0;
    if (userCount > 0) return;

    const now = new Date();
    const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const inEightHours = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    const inFourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const initialUsers: User[] = [
      {
        id: 'usr_rahul',
        username: 'rahul',
        displayName: 'Rahul Sharma',
        email: 'rahul@notecircle.app',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
        bio: 'Lover of mountains, design & slow living. 🏕️',
        city: 'Bangalore, India',
        birthday: '1996-05-14',
        workplace: 'Craft & Code Studio',
        isPrivate: true,
        isAdmin: false,
        availability: {
          code: 'family',
          label: 'Family Time',
          emoji: '🏕️',
          customStatus: 'Spending time with family. Urgent calls only.',
          expiresAt: inTwoDays,
          strictDnd: false,
          updatedAt: now.toISOString()
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
        createdAt: now.toISOString()
      },
      {
        id: 'usr_priya',
        username: 'priya',
        displayName: 'Priya Patel',
        email: 'priya@notecircle.app',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
        bio: 'Ceramicist & visual storyteller. Offline mornings. ☕',
        city: 'Mumbai, India',
        birthday: '1998-11-22',
        workplace: 'Studio Clay',
        isPrivate: true,
        isAdmin: false,
        availability: {
          code: 'studying',
          label: 'Deep Focus Studio',
          emoji: '📚',
          customStatus: 'Glazing ceramics all afternoon. Replies delayed.',
          expiresAt: inEightHours,
          strictDnd: false,
          updatedAt: now.toISOString()
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
        createdAt: now.toISOString()
      },
      {
        id: 'usr_amit',
        username: 'amit',
        displayName: 'Amit Verma',
        email: 'amit@notecircle.app',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
        bio: 'Sound designer & late-night cyclist. 🎧',
        city: 'New Delhi, India',
        isPrivate: true,
        isAdmin: false,
        availability: {
          code: 'sleeping',
          label: 'Sleeping',
          emoji: '💤',
          customStatus: 'Asleep after recording session.',
          expiresAt: inFourHours,
          strictDnd: true,
          updatedAt: now.toISOString()
        },
        privacySettings: {
          whoCanMessageMe: 'followers',
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
          dndModeStrict: true
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
        createdAt: now.toISOString()
      },
      {
        id: 'usr_admin',
        username: 'admin',
        displayName: 'NoteCircle Admin',
        email: 'safety@notecircle.app',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
        bio: 'Trust, Safety & Security Operations',
        city: 'San Francisco, CA',
        isPrivate: true,
        isAdmin: true,
        availability: {
          code: 'available',
          label: 'Active',
          emoji: '🛡️',
          strictDnd: false,
          updatedAt: now.toISOString()
        },
        privacySettings: {
          whoCanMessageMe: 'nobody',
          whoCanSeeOnlineStatus: 'connections',
          whoCanSeeReadReceipts: 'connections',
          whoCanSeeTyping: 'connections',
          whoCanFollowMe: 'require_approval',
          whoCanReply: 'nobody',
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
        createdAt: now.toISOString()
      }
    ];

    const insertUser = this.sqlite.prepare(`
      INSERT INTO users (
        id, username, display_name, email, phone, avatar_url, bio, city, birthday, workplace,
        is_private, is_admin, is_suspended, availability, privacy_settings, notification_settings, password_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    for (const u of initialUsers) {
      insertUser.run(
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
        0,
        JSON.stringify(u.availability),
        JSON.stringify(u.privacySettings),
        JSON.stringify(u.notificationSettings),
        hashPassword('password123'),
        u.createdAt
      );
    }

    // Seed initial follow connection: Rahul & Priya are mutual followers
    const insertConn = this.sqlite.prepare(`
      INSERT INTO connections (id, requester_id, target_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `);
    insertConn.run('conn_rp_1', 'usr_rahul', 'usr_priya', 'ACCEPTED', now.toISOString(), now.toISOString());
    insertConn.run('conn_pr_1', 'usr_priya', 'usr_rahul', 'ACCEPTED', now.toISOString(), now.toISOString());

    // Close friends
    const insertCf = this.sqlite.prepare(`
      INSERT INTO close_friends (id, user_id, friend_id, created_at)
      VALUES (?, ?, ?, ?);
    `);
    insertCf.run('cf_rp_1', 'usr_rahul', 'usr_priya', now.toISOString());

    // Initial note
    const insertNote = this.sqlite.prepare(`
      INSERT INTO notes (
        id, user_id, author, emoji, category, category_label, text, audience, selected_user_ids,
        expires_at, scheduled_for, status, is_pinned, is_draft, allow_replies, allow_reactions, reactions, replies, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    const rahulAuthor = {
      id: 'usr_rahul',
      username: 'rahul',
      displayName: 'Rahul Sharma',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'
    };

    insertNote.run(
      'note_seed_1',
      'usr_rahul',
      JSON.stringify(rahulAuthor),
      '🏕️',
      'family',
      'Family Trip',
      "I'm spending time with my family in Coorg for the weekend. Please don't call unless urgent! 🌲",
      'followers',
      null,
      inTwoDays,
      null,
      'ACTIVE',
      1,
      0,
      1,
      1,
      JSON.stringify([
        {
          id: 'rx_seed_1',
          noteId: 'note_seed_1',
          userId: 'usr_priya',
          username: 'priya',
          displayName: 'Priya Patel',
          emoji: '❤️',
          createdAt: now.toISOString()
        }
      ]),
      JSON.stringify([
        {
          id: 'rep_seed_1',
          noteId: 'note_seed_1',
          userId: 'usr_priya',
          username: 'priya',
          displayName: 'Priya Patel',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
          text: 'Have a wonderful trip with family Rahul!',
          createdAt: now.toISOString()
        }
      ]),
      now.toISOString(),
      null
    );

    // Initial conversation
    const insertConv = this.sqlite.prepare(`
      INSERT INTO conversations (id, type, title, participant_ids, last_message, unread_count, is_muted, is_archived, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);
    insertConv.run(
      'conv_rp_seed',
      'direct',
      null,
      JSON.stringify(['usr_rahul', 'usr_priya']),
      null,
      0,
      0,
      0,
      0,
      now.toISOString(),
      now.toISOString()
    );
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
              (u as any).passwordHash || hashPassword('password123'),
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
    `);
    this.seedInitialIfEmpty();
  }
}

export const db = new SqlDatabaseManager();
