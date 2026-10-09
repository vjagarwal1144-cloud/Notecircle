import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getServerSupabase } from './supabase.ts';
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
  blocks: { id: string; userId: string; blockedUserId: string; createdAt: string }[];
  mutes: { id: string; userId: string; mutedUserId: string; createdAt: string }[];
  sessions: { id: string; userId: string; token: string; device: string; ip: string; createdAt: string; lastActive: string }[];
  devicePublicKeys: DevicePublicKeyRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');

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
  if (storedHash.startsWith('scrypt:v1:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;
    const [, , salt, hash] = parts;
    const derived = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
  }
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
    const createdTime = parseInt(ts, 10);
    if (isNaN(createdTime) || Date.now() - createdTime > 30 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return userId || null;
  } catch {
    return null;
  }
}

async function safeExec(promiseLike: PromiseLike<any>): Promise<void> {
  try {
    await Promise.resolve(promiseLike);
  } catch (err: any) {
    console.error('[Supabase Database] Error executing query:', err?.message || err);
  }
}

class SupabaseDatabaseManager {
  private memoryStore: DatabaseSchema = {
    users: [],
    connections: [],
    closeFriends: [],
    notes: [],
    conversations: [],
    messages: [],
    notifications: [],
    reports: [],
    bugReports: [],
    auditLogs: [],
    blocks: [],
    mutes: [],
    sessions: [],
    devicePublicKeys: []
  };

  private passwordRecoveryRequests: any[] = [];
  private plansStore: any[] = [];
  private capsulesStore: any[] = [];
  private verifiedSafetyNumbers: { userId: string; contactId: string; verifiedAt: string }[] = [];
  private registrationOtps: any[] = [];
  private emailLogs: any[] = [];

  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const client = getServerSupabase();
        if (!client) {
          console.warn('[Supabase Database] Supabase client not available yet.');
          return;
        }

        // Load all 20 tables from Supabase PostgreSQL
        const [
          usersRes,
          connectionsRes,
          closeFriendsRes,
          notesRes,
          conversationsRes,
          messagesRes,
          notificationsRes,
          reportsRes,
          bugReportsRes,
          auditLogsRes,
          blocksRes,
          mutesRes,
          sessionsRes,
          deviceKeysRes,
          recoveryRes,
          plansRes,
          capsulesRes,
          safetyRes,
          otpsRes,
          emailLogsRes
        ] = await Promise.all([
          client.from('users').select('*').order('created_at', { ascending: true }),
          client.from('connections').select('*'),
          client.from('close_friends').select('*'),
          client.from('notes').select('*').order('created_at', { ascending: false }),
          client.from('conversations').select('*').order('updated_at', { ascending: false }),
          client.from('messages').select('*').order('created_at', { ascending: true }),
          client.from('notifications').select('*').order('created_at', { ascending: false }),
          client.from('reports').select('*').order('created_at', { ascending: false }),
          client.from('bug_reports').select('*').order('created_at', { ascending: false }),
          client.from('audit_logs').select('*').order('timestamp', { ascending: false }),
          client.from('blocks').select('*'),
          client.from('mutes').select('*'),
          client.from('sessions').select('*').order('last_active', { ascending: false }),
          client.from('device_public_keys').select('*').order('created_at', { ascending: false }),
          client.from('password_recovery_requests').select('*'),
          client.from('plans').select('*').order('scheduled_time', { ascending: true }),
          client.from('memory_capsules').select('*').order('created_at', { ascending: false }),
          client.from('verified_safety_numbers').select('*'),
          client.from('registration_otps').select('*').order('created_at', { ascending: false }),
          client.from('email_logs').select('*').order('created_at', { ascending: false })
        ]);

        if (usersRes.data) {
          this.memoryStore.users = usersRes.data.map((r: any) => ({
            id: r.id,
            username: r.username,
            displayName: r.display_name,
            email: r.email,
            phone: r.phone || undefined,
            avatarUrl: r.avatar_url || '',
            bio: r.bio || '',
            city: r.city || undefined,
            birthday: r.birthday || undefined,
            workplace: r.workplace || undefined,
            isPrivate: true,
            isAdmin: Boolean(r.is_admin),
            isSuspended: Boolean(r.is_suspended),
            availability: r.availability || { code: 'available', label: 'Available', emoji: '🟢', strictDnd: false, updatedAt: new Date().toISOString() },
            privacySettings: r.privacy_settings || {},
            notificationSettings: r.notification_settings || {},
            passwordHash: r.password_hash,
            createdAt: r.created_at
          }));
        }

        if (connectionsRes.data) {
          this.memoryStore.connections = connectionsRes.data.map((r: any) => ({
            id: r.id,
            requesterId: r.requester_id,
            targetId: r.target_id,
            status: r.status,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        }

        if (closeFriendsRes.data) {
          this.memoryStore.closeFriends = closeFriendsRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            friendId: r.friend_id,
            createdAt: r.created_at
          }));
        }

        if (notesRes.data) {
          this.memoryStore.notes = notesRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            author: r.author,
            emoji: r.emoji,
            category: r.category,
            categoryLabel: r.category_label,
            text: r.text,
            audience: r.audience,
            selectedUserIds: r.selected_user_ids || undefined,
            expiresAt: r.expires_at || null,
            scheduledFor: r.scheduled_for || null,
            status: r.status,
            isPinned: Boolean(r.is_pinned),
            isDraft: Boolean(r.is_draft),
            allowReplies: r.allow_replies !== false,
            allowReactions: r.allow_reactions !== false,
            reactions: r.reactions || [],
            replies: r.replies || [],
            isOwner: false,
            isCloseFriendOnly: r.audience === 'close_friends',
            createdAt: r.created_at,
            updatedAt: r.updated_at || undefined
          }));
        }

        if (conversationsRes.data) {
          this.memoryStore.conversations = conversationsRes.data.map((r: any) => ({
            id: r.id,
            type: r.type,
            title: r.title || undefined,
            participantIds: r.participant_ids || [],
            participants: [],
            lastMessage: r.last_message || undefined,
            unreadCount: r.unread_count || 0,
            isMuted: Boolean(r.is_muted),
            isArchived: Boolean(r.is_archived),
            isPinned: Boolean(r.is_pinned),
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        }

        if (messagesRes.data) {
          this.memoryStore.messages = messagesRes.data.map((r: any) => ({
            id: r.id,
            conversationId: r.conversation_id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            senderAvatar: r.sender_avatar || undefined,
            text: r.text,
            encryptedPayload: r.encrypted_payload || undefined,
            replyToId: r.reply_to_id || undefined,
            replyPreview: r.reply_preview || undefined,
            mediaUrl: r.media_url || undefined,
            reactions: r.reactions || [],
            status: r.status,
            isDeleted: Boolean(r.is_deleted),
            deletedForMe: Boolean(r.deleted_for_me),
            createdAt: r.created_at
          }));
        }

        if (notificationsRes.data) {
          this.memoryStore.notifications = notificationsRes.data.map((r: any) => ({
            id: r.id,
            recipientId: r.recipient_id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            senderAvatar: r.sender_avatar,
            type: r.type,
            entityId: r.entity_id || undefined,
            text: r.text,
            read: Boolean(r.read),
            createdAt: r.created_at
          }));
        }

        if (reportsRes.data) {
          this.memoryStore.reports = reportsRes.data.map((r: any) => ({
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
          }));
        }

        if (bugReportsRes.data) {
          this.memoryStore.bugReports = bugReportsRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            username: r.username,
            category: r.category,
            description: r.description,
            errorIdentifier: r.error_identifier || undefined,
            screenshot: r.screenshot || undefined,
            deviceInfo: r.device_info || {},
            status: r.status,
            resolutionNote: r.resolution_note || undefined,
            createdAt: r.created_at
          }));
        }

        if (auditLogsRes.data) {
          this.memoryStore.auditLogs = auditLogsRes.data.map((r: any) => ({
            id: r.id,
            action: r.action,
            actorId: r.actor_id,
            actorUsername: r.actor_username,
            timestamp: r.timestamp,
            details: r.details || undefined
          }));
        }

        if (blocksRes.data) {
          this.memoryStore.blocks = blocksRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            blockedUserId: r.blocked_user_id,
            createdAt: r.created_at
          }));
        }

        if (mutesRes.data) {
          this.memoryStore.mutes = mutesRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            mutedUserId: r.muted_user_id,
            createdAt: r.created_at
          }));
        }

        if (sessionsRes.data) {
          this.memoryStore.sessions = sessionsRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            token: r.token,
            device: r.device,
            ip: r.ip,
            createdAt: r.created_at,
            lastActive: r.last_active
          }));
        }

        if (deviceKeysRes.data) {
          this.memoryStore.devicePublicKeys = deviceKeysRes.data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            deviceId: r.device_id,
            deviceName: r.device_name,
            publicKeyJwk: typeof r.public_key_jwk === 'string' ? r.public_key_jwk : JSON.stringify(r.public_key_jwk),
            fingerprint: r.fingerprint,
            isRevoked: Boolean(r.is_revoked),
            createdAt: r.created_at,
            lastSeen: r.last_seen
          }));
        }

        if (recoveryRes.data) {
          this.passwordRecoveryRequests = recoveryRes.data.map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            code_hash: r.code_hash,
            expires_at: r.expires_at,
            attempts: r.attempts,
            used: r.used ? 1 : 0,
            created_at: r.created_at
          }));
        }

        if (plansRes.data) {
          this.plansStore = plansRes.data.map((r: any) => ({
            id: r.id,
            creator_id: r.creator_id,
            title: r.title,
            emoji: r.emoji,
            scheduled_time: r.scheduled_time,
            location: r.location,
            rsvps: JSON.stringify(r.rsvps || []),
            created_at: r.created_at
          }));
        }

        if (capsulesRes.data) {
          this.capsulesStore = capsulesRes.data.map((r: any) => ({
            id: r.id,
            creator_id: r.creator_id,
            title: r.title,
            cover_emoji: r.cover_emoji,
            unlock_at: r.unlock_at,
            items: JSON.stringify(r.items || []),
            created_at: r.created_at
          }));
        }

        if (safetyRes.data) {
          this.verifiedSafetyNumbers = safetyRes.data.map((r: any) => ({
            userId: r.user_id,
            contactId: r.contact_id,
            verifiedAt: r.verified_at
          }));
        }

        if (otpsRes.data) {
          this.registrationOtps = otpsRes.data.map((r: any) => ({
            id: r.id,
            email: r.email,
            otp_hash: r.otp_hash,
            expires_at: r.expires_at,
            attempts: r.attempts,
            max_attempts: r.max_attempts,
            resend_available_at: r.resend_available_at,
            verified: r.verified ? 1 : 0,
            verification_token_hash: r.verification_token_hash,
            used: r.used ? 1 : 0,
            created_at: r.created_at
          }));
        }

        if (emailLogsRes.data) {
          this.emailLogs = emailLogsRes.data.map((r: any) => ({
            id: r.id,
            recipient: r.recipient,
            type: r.type,
            status: r.status,
            provider: r.provider,
            error: r.error,
            created_at: r.created_at
          }));
        }

        this.isInitialized = true;
        console.log(`[Supabase Database] Successfully loaded state from Supabase PostgreSQL (${this.memoryStore.users.length} users, ${this.memoryStore.devicePublicKeys.length} device keys).`);
      } catch (err: any) {
        console.error('[Supabase Database] Error loading state from Supabase:', err?.message || err);
      }
    })();

    return this.initPromise;
  }

  public get<K extends keyof DatabaseSchema>(table: K): DatabaseSchema[K] {
    return (this.memoryStore[table] || []) as DatabaseSchema[K];
  }

  public update<K extends keyof DatabaseSchema>(
    table: K,
    updater: (curr: DatabaseSchema[K]) => DatabaseSchema[K]
  ): void {
    const current = this.get(table);
    const updated = updater(current);
    this.memoryStore[table] = updated;

    // Persist changes to Supabase PostgreSQL asynchronously in the background
    this.persistTableChanges(table, current, updated).catch((err) => {
      console.error(`[Supabase Database] Failed to persist updates to table ${String(table)}:`, err?.message || err);
    });
  }

  private async persistTableChanges<K extends keyof DatabaseSchema>(
    table: K,
    previous: DatabaseSchema[K],
    next: DatabaseSchema[K]
  ): Promise<void> {
    const client = getServerSupabase();
    if (!client) return;

    try {
      switch (table) {
        case 'users': {
          const prevMap = new Map((previous as User[]).map(u => [u.id, u]));
          const nextList = next as User[];
          const nextIds = new Set(nextList.map(u => u.id));

          for (const u of nextList) {
            const p = prevMap.get(u.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(u)) {
              await safeExec(client.from('users').upsert({
                id: u.id,
                username: u.username,
                display_name: u.displayName,
                email: u.email,
                phone: u.phone || null,
                avatar_url: u.avatarUrl || null,
                bio: u.bio || '',
                city: u.city || null,
                birthday: u.birthday || null,
                workplace: u.workplace || null,
                is_private: Boolean(u.isPrivate),
                is_admin: Boolean(u.isAdmin),
                is_suspended: Boolean(u.isSuspended),
                availability: u.availability || {},
                privacy_settings: u.privacySettings || {},
                notification_settings: u.notificationSettings || {},
                password_hash: (u as any).passwordHash || '',
                created_at: u.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('users').delete().eq('id', id));
            }
          }
          break;
        }

        case 'connections': {
          const prevMap = new Map((previous as Connection[]).map(c => [c.id, c]));
          const nextList = next as Connection[];
          const nextIds = new Set(nextList.map(c => c.id));

          for (const c of nextList) {
            const p = prevMap.get(c.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(c)) {
              await safeExec(client.from('connections').upsert({
                id: c.id,
                requester_id: c.requesterId,
                target_id: c.targetId,
                status: c.status,
                created_at: c.createdAt,
                updated_at: c.updatedAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('connections').delete().eq('id', id));
            }
          }
          break;
        }

        case 'closeFriends': {
          const prevMap = new Map((previous as any[]).map(cf => [cf.id, cf]));
          const nextList = next as any[];
          const nextIds = new Set(nextList.map(cf => cf.id));

          for (const cf of nextList) {
            const p = prevMap.get(cf.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(cf)) {
              await safeExec(client.from('close_friends').upsert({
                id: cf.id,
                user_id: cf.userId,
                friend_id: cf.friendId,
                created_at: cf.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('close_friends').delete().eq('id', id));
            }
          }
          break;
        }

        case 'notes': {
          const prevMap = new Map((previous as Note[]).map(n => [n.id, n]));
          const nextList = next as Note[];
          const nextIds = new Set(nextList.map(n => n.id));

          for (const n of nextList) {
            const p = prevMap.get(n.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(n)) {
              await safeExec(client.from('notes').upsert({
                id: n.id,
                user_id: n.userId,
                author: n.author,
                emoji: n.emoji,
                category: n.category,
                category_label: n.categoryLabel,
                text: n.text,
                audience: n.audience,
                selected_user_ids: n.selectedUserIds || null,
                expires_at: n.expiresAt || null,
                scheduled_for: n.scheduledFor || null,
                status: n.status,
                is_pinned: Boolean(n.isPinned),
                is_draft: Boolean(n.isDraft),
                allow_replies: n.allowReplies !== false,
                allow_reactions: n.allowReactions !== false,
                reactions: n.reactions || [],
                replies: n.replies || [],
                created_at: n.createdAt,
                updated_at: n.updatedAt || null
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('notes').delete().eq('id', id));
            }
          }
          break;
        }

        case 'conversations': {
          const prevMap = new Map((previous as Conversation[]).map(c => [c.id, c]));
          const nextList = next as Conversation[];
          const nextIds = new Set(nextList.map(c => c.id));

          for (const c of nextList) {
            const p = prevMap.get(c.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(c)) {
              await safeExec(client.from('conversations').upsert({
                id: c.id,
                type: c.type,
                title: c.title || null,
                participant_ids: c.participantIds,
                last_message: c.lastMessage || null,
                unread_count: c.unreadCount || 0,
                is_muted: Boolean(c.isMuted),
                is_archived: Boolean(c.isArchived),
                is_pinned: Boolean(c.isPinned),
                created_at: c.createdAt,
                updated_at: c.updatedAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('conversations').delete().eq('id', id));
            }
          }
          break;
        }

        case 'messages': {
          const prevMap = new Map((previous as Message[]).map(m => [m.id, m]));
          const nextList = next as Message[];
          const nextIds = new Set(nextList.map(m => m.id));

          for (const m of nextList) {
            const p = prevMap.get(m.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(m)) {
              await safeExec(client.from('messages').upsert({
                id: m.id,
                conversation_id: m.conversationId,
                sender_id: m.senderId,
                sender_name: m.senderName,
                sender_avatar: m.senderAvatar || null,
                text: m.text,
                encrypted_payload: m.encryptedPayload || null,
                reply_to_id: m.replyToId || null,
                reply_preview: m.replyPreview || null,
                media_url: m.mediaUrl || null,
                reactions: m.reactions || [],
                status: m.status,
                is_deleted: Boolean(m.isDeleted),
                deleted_for_me: Boolean(m.deletedForMe),
                created_at: m.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('messages').delete().eq('id', id));
            }
          }
          break;
        }

        case 'notifications': {
          const prevMap = new Map((previous as AppNotification[]).map(n => [n.id, n]));
          const nextList = next as AppNotification[];
          const nextIds = new Set(nextList.map(n => n.id));

          for (const n of nextList) {
            const p = prevMap.get(n.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(n)) {
              await safeExec(client.from('notifications').upsert({
                id: n.id,
                recipient_id: n.recipientId,
                sender_id: n.senderId,
                sender_name: n.senderName,
                sender_avatar: n.senderAvatar || null,
                type: n.type,
                entity_id: n.entityId || null,
                text: n.text,
                read: Boolean(n.read),
                created_at: n.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('notifications').delete().eq('id', id));
            }
          }
          break;
        }

        case 'reports': {
          const prevMap = new Map((previous as Report[]).map(r => [r.id, r]));
          const nextList = next as Report[];
          const nextIds = new Set(nextList.map(r => r.id));

          for (const r of nextList) {
            const p = prevMap.get(r.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(r)) {
              await safeExec(client.from('reports').upsert({
                id: r.id,
                reporter_id: r.reporterId,
                reporter_username: r.reporterUsername,
                target_type: r.targetType,
                target_id: r.targetId,
                target_author_name: r.targetAuthorName || null,
                target_content_preview: r.targetContentPreview || null,
                reason: r.reason,
                details: r.details || null,
                status: r.status,
                action_taken: r.actionTaken || null,
                created_at: r.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('reports').delete().eq('id', id));
            }
          }
          break;
        }

        case 'bugReports': {
          const prevMap = new Map((previous as BugReport[]).map(b => [b.id, b]));
          const nextList = next as BugReport[];
          const nextIds = new Set(nextList.map(b => b.id));

          for (const b of nextList) {
            const p = prevMap.get(b.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(b)) {
              await safeExec(client.from('bug_reports').upsert({
                id: b.id,
                user_id: b.userId,
                username: b.username,
                category: b.category,
                description: b.description,
                error_identifier: b.errorIdentifier || null,
                screenshot: b.screenshot || null,
                device_info: b.deviceInfo || {},
                status: b.status,
                resolution_note: b.resolutionNote || null,
                created_at: b.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('bug_reports').delete().eq('id', id));
            }
          }
          break;
        }

        case 'blocks': {
          const prevMap = new Map((previous as any[]).map(b => [b.id, b]));
          const nextList = next as any[];
          const nextIds = new Set(nextList.map(b => b.id));

          for (const b of nextList) {
            const p = prevMap.get(b.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(b)) {
              await safeExec(client.from('blocks').upsert({
                id: b.id,
                user_id: b.userId,
                blocked_user_id: b.blockedUserId,
                created_at: b.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('blocks').delete().eq('id', id));
            }
          }
          break;
        }

        case 'mutes': {
          const prevMap = new Map((previous as any[]).map(m => [m.id, m]));
          const nextList = next as any[];
          const nextIds = new Set(nextList.map(m => m.id));

          for (const m of nextList) {
            const p = prevMap.get(m.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(m)) {
              await safeExec(client.from('mutes').upsert({
                id: m.id,
                user_id: m.userId,
                muted_user_id: m.mutedUserId,
                created_at: m.createdAt
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('mutes').delete().eq('id', id));
            }
          }
          break;
        }

        case 'sessions': {
          const prevMap = new Map((previous as any[]).map(s => [s.id, s]));
          const nextList = next as any[];
          const nextIds = new Set(nextList.map(s => s.id));

          for (const s of nextList) {
            const p = prevMap.get(s.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(s)) {
              await safeExec(client.from('sessions').upsert({
                id: s.id,
                user_id: s.userId,
                token: s.token,
                device: s.device,
                ip: s.ip,
                created_at: s.createdAt,
                last_active: s.lastActive
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('sessions').delete().eq('id', id));
            }
          }
          break;
        }

        case 'devicePublicKeys': {
          const prevMap = new Map((previous as DevicePublicKeyRecord[]).map(k => [k.id, k]));
          const nextList = next as DevicePublicKeyRecord[];
          const nextIds = new Set(nextList.map(k => k.id));

          for (const k of nextList) {
            const p = prevMap.get(k.id);
            if (!p || JSON.stringify(p) !== JSON.stringify(k)) {
              let jwk = k.publicKeyJwk;
              try {
                if (typeof jwk === 'string') jwk = JSON.parse(jwk);
              } catch {}

              await safeExec(client.from('device_public_keys').upsert({
                id: k.id,
                user_id: k.userId,
                device_id: k.deviceId,
                device_name: k.deviceName,
                public_key_jwk: jwk,
                fingerprint: k.fingerprint,
                is_revoked: Boolean(k.isRevoked),
                created_at: k.createdAt,
                last_seen: k.lastSeen
              }));
            }
          }

          for (const [id] of prevMap) {
            if (!nextIds.has(id)) {
              await safeExec(client.from('device_public_keys').delete().eq('id', id));
            }
          }
          break;
        }
      }
    } catch (err: any) {
      console.error(`[Supabase Database] Error in persistTableChanges for ${table}:`, err?.message || err);
    }
  }

  public logAudit(actorId: string, actorUsername: string, action: string, details?: string): void {
    const id = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();
    const entry = { id, action, actorId, actorUsername, timestamp, details: details || undefined };

    this.memoryStore.auditLogs = [entry, ...this.memoryStore.auditLogs];

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('audit_logs').insert({
        id,
        action,
        actor_id: actorId,
        actor_username: actorUsername,
        timestamp,
        details: details || null
      }));
    }
  }

  public backupDatabase(destinationPath: string): void {
    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const backupSnapshot = {
      timestamp: new Date().toISOString(),
      database: 'supabase-postgresql',
      schema: this.memoryStore,
      recovery: this.passwordRecoveryRequests,
      plans: this.plansStore,
      capsules: this.capsulesStore,
      safetyNumbers: this.verifiedSafetyNumbers,
      registrationOtps: this.registrationOtps,
      emailLogs: this.emailLogs
    };
    fs.writeFileSync(destinationPath, JSON.stringify(backupSnapshot, null, 2), 'utf8');
  }

  public resetToDefault(): void {
    this.memoryStore = {
      users: [],
      connections: [],
      closeFriends: [],
      notes: [],
      conversations: [],
      messages: [],
      notifications: [],
      reports: [],
      bugReports: [],
      auditLogs: [],
      blocks: [],
      mutes: [],
      sessions: [],
      devicePublicKeys: []
    };
  }

  // --- Session Management ---
  public createSession(userId: string, token: string, device: string, ip: string): void {
    const id = `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const sess = { id, userId, token, device, ip, createdAt: now, lastActive: now };

    this.memoryStore.sessions = [sess, ...this.memoryStore.sessions.filter(s => s.token !== token)];

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('sessions').upsert({
        id,
        user_id: userId,
        token,
        device,
        ip,
        created_at: now,
        last_active: now
      }));
    }
  }

  public getSessionByToken(token: string): { id: string; userId: string; device: string; ip: string; lastActive: string } | null {
    const s = this.memoryStore.sessions.find(x => x.token === token);
    if (!s) return null;
    return {
      id: s.id,
      userId: s.userId,
      device: s.device,
      ip: s.ip,
      lastActive: s.lastActive
    };
  }

  public touchSession(token: string): void {
    const now = new Date().toISOString();
    const s = this.memoryStore.sessions.find(x => x.token === token);
    if (s) {
      s.lastActive = now;
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('sessions').update({ last_active: now }).eq('token', token));
      }
    }
  }

  public deleteSessionByToken(token: string): void {
    this.memoryStore.sessions = this.memoryStore.sessions.filter(x => x.token !== token);
    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('sessions').delete().eq('token', token));
    }
  }

  public deleteSessionById(id: string, userId: string): void {
    this.memoryStore.sessions = this.memoryStore.sessions.filter(x => !(x.id === id && x.userId === userId));
    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('sessions').delete().eq('id', id).eq('user_id', userId));
    }
  }

  public deleteAllSessionsForUser(userId: string, exceptToken?: string): void {
    if (exceptToken) {
      this.memoryStore.sessions = this.memoryStore.sessions.filter(x => x.userId !== userId || x.token === exceptToken);
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('sessions').delete().eq('user_id', userId).neq('token', exceptToken));
      }
    } else {
      this.memoryStore.sessions = this.memoryStore.sessions.filter(x => x.userId !== userId);
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('sessions').delete().eq('user_id', userId));
      }
    }
  }

  public getUserSessions(userId: string, currentToken?: string): Array<{ id: string; device: string; ip: string; current: boolean; lastActive: string }> {
    return this.memoryStore.sessions
      .filter(s => s.userId === userId)
      .map(r => ({
        id: r.id,
        device: r.device,
        ip: r.ip,
        current: r.token === currentToken,
        lastActive: r.lastActive
      }));
  }

  // --- Password Recovery Requests ---
  public createPasswordRecovery(userId: string, codeHash: string, expiresInMinutes = 15): string {
    const id = `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    for (const r of this.passwordRecoveryRequests) {
      if (r.user_id === userId) r.used = 1;
    }

    const rec = { id, user_id: userId, code_hash: codeHash, expires_at: expiresAt, attempts: 0, used: 0, created_at: now };
    this.passwordRecoveryRequests.push(rec);

    const client = getServerSupabase();
    if (client) {
      (async () => {
        await client.from('password_recovery_requests').update({ used: true }).eq('user_id', userId);
        await client.from('password_recovery_requests').insert({
          id,
          user_id: userId,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
          used: false,
          created_at: now
        });
      })().catch((err: any) => {
        console.error('[Supabase Database] Error creating recovery request in Supabase:', err?.message || err);
      });
    }

    return id;
  }

  public getActiveRecoveryRequest(userId: string): any {
    const now = Date.now();
    return this.passwordRecoveryRequests
      .filter(r => r.user_id === userId && !r.used && new Date(r.expires_at).getTime() > now && r.attempts < 5)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }

  public incrementRecoveryAttempt(id: string): void {
    const r = this.passwordRecoveryRequests.find(x => x.id === id);
    if (r) {
      r.attempts = (r.attempts || 0) + 1;
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('password_recovery_requests').update({ attempts: r.attempts }).eq('id', id));
      }
    }
  }

  public markRecoveryUsed(id: string): void {
    const r = this.passwordRecoveryRequests.find(x => x.id === id);
    if (r) {
      r.used = 1;
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('password_recovery_requests').update({ used: true }).eq('id', id));
      }
    }
  }

  // --- Users Direct SQL Operations ---
  public updateUserPassword(userId: string, newPasswordHash: string): void {
    const u = this.memoryStore.users.find(x => x.id === userId);
    if (u) {
      (u as any).passwordHash = newPasswordHash;
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('users').update({ password_hash: newPasswordHash }).eq('id', userId));
      }
    }
  }

  public purgeUserData(userId: string): void {
    this.memoryStore.users = this.memoryStore.users.filter(x => x.id !== userId);
    this.memoryStore.notes = this.memoryStore.notes.filter(x => x.userId !== userId);
    this.memoryStore.connections = this.memoryStore.connections.filter(x => x.requesterId !== userId && x.targetId !== userId);
    this.memoryStore.closeFriends = this.memoryStore.closeFriends.filter(x => x.userId !== userId && x.friendId !== userId);
    this.memoryStore.sessions = this.memoryStore.sessions.filter(x => x.userId !== userId);
    this.memoryStore.devicePublicKeys = this.memoryStore.devicePublicKeys.filter(x => x.userId !== userId);
    this.memoryStore.blocks = this.memoryStore.blocks.filter(x => x.userId !== userId && x.blockedUserId !== userId);
    this.memoryStore.mutes = this.memoryStore.mutes.filter(x => x.userId !== userId && x.mutedUserId !== userId);
    this.passwordRecoveryRequests = this.passwordRecoveryRequests.filter(x => x.user_id !== userId);

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('users').delete().eq('id', userId));
    }
  }

  // --- Plans ---
  public getPlansForUser(userId: string): any[] {
    const acceptedConnections = this.memoryStore.connections
      .filter(c => c.status === 'ACCEPTED' && (c.requesterId === userId || c.targetId === userId))
      .map(c => c.requesterId === userId ? c.targetId : c.requesterId);
    
    const authorizedCreatorIds = new Set<string>([userId, ...acceptedConnections]);

    return this.plansStore
      .filter((r) => {
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
    const r = this.plansStore.find(x => x.id === planId);
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
    const now = new Date().toISOString();
    const newRecord = {
      id: plan.id,
      creator_id: plan.creatorId,
      title: plan.title,
      emoji: plan.emoji,
      scheduled_time: plan.scheduledTime,
      location: plan.location || null,
      rsvps: '[]',
      created_at: now
    };
    this.plansStore.push(newRecord);

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('plans').insert({
        id: plan.id,
        creator_id: plan.creatorId,
        title: plan.title,
        emoji: plan.emoji,
        scheduled_time: plan.scheduledTime,
        location: plan.location || null,
        rsvps: [],
        created_at: now
      }));
    }
  }

  public updatePlanRsvp(planId: string, userId: string, username: string, status: 'attending' | 'maybe' | 'declined'): boolean {
    const row = this.plansStore.find(x => x.id === planId);
    if (!row) return false;

    const isCreator = row.creator_id === userId;
    let isConnected = false;
    if (!isCreator) {
      isConnected = this.memoryStore.connections.some(c =>
        c.status === 'ACCEPTED' &&
        ((c.requesterId === userId && c.targetId === row.creator_id) ||
         (c.targetId === userId && c.requesterId === row.creator_id))
      );
    }

    if (!isCreator && !isConnected) return false;

    const rsvps = JSON.parse(row.rsvps || '[]');
    const existingIdx = rsvps.findIndex((r: any) => r.userId === userId);
    if (existingIdx >= 0) {
      rsvps[existingIdx].status = status;
      rsvps[existingIdx].updatedAt = new Date().toISOString();
    } else {
      rsvps.push({ userId, username, status, updatedAt: new Date().toISOString() });
    }
    row.rsvps = JSON.stringify(rsvps);

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('plans').update({ rsvps }).eq('id', planId));
    }

    return true;
  }

  // --- Memory Capsules ---
  public getMemoryCapsules(userId: string): any[] {
    const acceptedConnections = this.memoryStore.connections
      .filter(c => c.status === 'ACCEPTED' && (c.requesterId === userId || c.targetId === userId))
      .map(c => c.requesterId === userId ? c.targetId : c.requesterId);
    const circleMemberIds = new Set<string>([userId, ...acceptedConnections]);

    const now = Date.now();
    return this.capsulesStore
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
          items: isLocked ? [] : JSON.parse(r.items || '[]'),
          createdAt: r.created_at
        };
      });
  }

  public createMemoryCapsule(capsule: { id: string; creatorId: string; title: string; coverEmoji: string; unlockAt?: string; items: any[] }): void {
    const now = new Date().toISOString();
    const record = {
      id: capsule.id,
      creator_id: capsule.creatorId,
      title: capsule.title,
      cover_emoji: capsule.coverEmoji,
      unlock_at: capsule.unlockAt || null,
      items: JSON.stringify(capsule.items || []),
      created_at: now
    };
    this.capsulesStore.unshift(record);

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('memory_capsules').insert({
        id: capsule.id,
        creator_id: capsule.creatorId,
        title: capsule.title,
        cover_emoji: capsule.coverEmoji,
        unlock_at: capsule.unlockAt || null,
        items: capsule.items || [],
        created_at: now
      }));
    }
  }

  // --- Out-of-band Safety Numbers Verification ---
  public isSafetyNumberVerified(userId: string, contactId: string): boolean {
    return this.verifiedSafetyNumbers.some(x => x.userId === userId && x.contactId === contactId);
  }

  public setSafetyNumberVerified(userId: string, contactId: string, verified: boolean): void {
    if (verified) {
      const now = new Date().toISOString();
      this.verifiedSafetyNumbers = [
        ...this.verifiedSafetyNumbers.filter(x => !(x.userId === userId && x.contactId === contactId)),
        { userId, contactId, verifiedAt: now }
      ];
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('verified_safety_numbers').upsert({
          user_id: userId,
          contact_id: contactId,
          verified_at: now
        }));
      }
    } else {
      this.verifiedSafetyNumbers = this.verifiedSafetyNumbers.filter(x => !(x.userId === userId && x.contactId === contactId));
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('verified_safety_numbers').delete().eq('user_id', userId).eq('contact_id', contactId));
      }
    }
  }

  // --- Registration OTP Management ---
  public createRegistrationOtp(email: string, otpHash: string, expiresMinutes = 10, cooldownSeconds = 60): { id: string; expiresAt: string; cooldownUntil: string } {
    const id = `otp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();
    const expiresAt = new Date(now + expiresMinutes * 60 * 1000).toISOString();
    const resendAvailableAt = new Date(now + cooldownSeconds * 1000).toISOString();
    const createdAt = new Date(now).toISOString();

    for (const o of this.registrationOtps) {
      if (o.email.toLowerCase() === email.toLowerCase() && !o.verified) {
        o.used = 1;
      }
    }

    const rec = {
      id,
      email: email.toLowerCase(),
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: 5,
      resend_available_at: resendAvailableAt,
      verified: 0,
      verification_token_hash: null,
      used: 0,
      created_at: createdAt
    };
    this.registrationOtps.unshift(rec);

    const client = getServerSupabase();
    if (client) {
      (async () => {
        await client.from('registration_otps').update({ used: true }).eq('email', email.toLowerCase()).eq('verified', false);
        await client.from('registration_otps').insert({
          id,
          email: email.toLowerCase(),
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
          max_attempts: 5,
          resend_available_at: resendAvailableAt,
          verified: false,
          used: false,
          created_at: createdAt
        });
      })().catch((err: any) => {
        console.error('[Supabase Database] Error saving registration OTP to Supabase:', err?.message || err);
      });
    }

    return { id, expiresAt, cooldownUntil: resendAvailableAt };
  }

  public removeRegistrationOtp(id: string): void {
    this.registrationOtps = this.registrationOtps.filter(x => x.id !== id);
    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('registration_otps').delete().eq('id', id));
    }
  }

  public getLatestRegistrationOtp(email: string): any {
    const cleanEmail = email.toLowerCase();
    return this.registrationOtps
      .filter(x => x.email === cleanEmail && !x.used)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }

  public checkEmailCooldown(email: string): { inCooldown: boolean; secondsRemaining: number } {
    const cleanEmail = email.toLowerCase();
    const latest = this.getLatestRegistrationOtp(cleanEmail);
    if (!latest) return { inCooldown: false, secondsRemaining: 0 };
    const cooldownTime = new Date(latest.resend_available_at).getTime();
    const diff = cooldownTime - Date.now();
    if (diff > 0) {
      return { inCooldown: true, secondsRemaining: Math.ceil(diff / 1000) };
    }
    return { inCooldown: false, secondsRemaining: 0 };
  }

  public incrementOtpAttempts(id: string): number {
    const o = this.registrationOtps.find(x => x.id === id);
    if (o) {
      o.attempts = (o.attempts || 0) + 1;
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('registration_otps').update({ attempts: o.attempts }).eq('id', id));
      }
      return o.attempts;
    }
    return 0;
  }

  public markRegistrationOtpVerified(id: string, verificationTokenHash: string): void {
    const o = this.registrationOtps.find(x => x.id === id);
    if (o) {
      o.verified = 1;
      o.verification_token_hash = verificationTokenHash;
      const client = getServerSupabase();
      if (client) {
        safeExec(client.from('registration_otps').update({
          verified: true,
          verification_token_hash: verificationTokenHash
        }).eq('id', id));
      }
    }
  }

  public consumeRegistrationOtp(email: string, verificationTokenHash: string): boolean {
    const cleanEmail = email.toLowerCase();
    const o = this.registrationOtps.find(x => x.email === cleanEmail && x.verification_token_hash === verificationTokenHash && x.verified && !x.used);
    if (!o) return false;
    o.used = 1;

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('registration_otps').update({ used: true }).eq('id', o.id));
    }

    return true;
  }

  // --- Transactional Email Logs ---
  public logEmail(recipient: string, type: string, status: string, provider: string, error?: string): void {
    const id = `elog_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const entry = { id, recipient, type, status, provider, error: error || null, created_at: now };
    this.emailLogs.unshift(entry);

    const client = getServerSupabase();
    if (client) {
      safeExec(client.from('email_logs').insert({
        id,
        recipient,
        type,
        status,
        provider,
        error: error || null,
        created_at: now
      }));
    }
  }

  public getEmailLogs(limit = 100): any[] {
    return this.emailLogs.slice(0, limit);
  }
}

export const db = new SupabaseDatabaseManager();
