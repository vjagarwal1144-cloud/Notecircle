-- NoteCircle Complete Production PostgreSQL Schema for Supabase
-- Phase 1: Tables, Constraints, Indexes, and Row Level Security (RLS)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  city TEXT,
  birthday TEXT,
  workplace TEXT,
  is_private BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  availability JSONB NOT NULL DEFAULT '{"code":"available","label":"Available","emoji":"🟢","strictDnd":false}'::jsonb,
  privacy_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Connections Table
CREATE TABLE IF NOT EXISTS public.connections (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_connection_pair UNIQUE(requester_id, target_id)
);

-- 3. Close Friends Table
CREATE TABLE IF NOT EXISTS public.close_friends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_close_friend_pair UNIQUE(user_id, friend_id)
);

-- 4. Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  text TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('followers', 'close_friends', 'selected')),
  selected_user_ids JSONB DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SCHEDULED', 'DRAFT', 'EXPIRED', 'DELETED')),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT FALSE,
  allow_replies BOOLEAN DEFAULT TRUE,
  allow_reactions BOOLEAN DEFAULT TRUE,
  reactions JSONB DEFAULT '[]'::jsonb,
  replies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 5. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  title TEXT,
  participant_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_message JSONB,
  unread_count INTEGER DEFAULT 0,
  is_muted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Messages Table (Stores client-side E2EE ciphertext only)
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  text TEXT NOT NULL,
  encrypted_payload TEXT,
  reply_to_id TEXT,
  reply_preview JSONB,
  media_url TEXT,
  reactions JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'DELIVERED', 'READ')),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_for_me BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  type TEXT NOT NULL,
  entity_id TEXT,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reporter_username TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_author_name TEXT,
  target_content_preview TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Bug Reports Table
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  error_identifier TEXT,
  screenshot TEXT,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details TEXT
);

-- 11. Blocks Table
CREATE TABLE IF NOT EXISTS public.blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_block_pair UNIQUE(user_id, blocked_user_id)
);

-- 12. Mutes Table
CREATE TABLE IF NOT EXISTS public.mutes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  muted_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_mute_pair UNIQUE(user_id, muted_user_id)
);

-- 13. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  device TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Password Recovery Requests
CREATE TABLE IF NOT EXISTS public.password_recovery_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  rsvps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Memory Capsules Table
CREATE TABLE IF NOT EXISTS public.memory_capsules (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_emoji TEXT NOT NULL,
  unlock_at TIMESTAMPTZ,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Device Public Keys Table (E2EE device key registry)
CREATE TABLE IF NOT EXISTS public.device_public_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  public_key_jwk JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_device UNIQUE(user_id, device_id)
);

-- 18. Verified Safety Numbers Table
CREATE TABLE IF NOT EXISTS public.verified_safety_numbers (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_id)
);

-- 19. Registration OTPs Table
CREATE TABLE IF NOT EXISTS public.registration_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  resend_available_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verification_token_hash TEXT,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. Email Logs Table (Resend transaction audit)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Fast Query Performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_connections_users ON public.connections(requester_id, target_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_status ON public.notes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_expires ON public.notes(expires_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifs_recip ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_device_keys_user ON public.device_public_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_email ON public.registration_otps(email);

-- Enable Row Level Security (RLS) on Every Exposed Table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_safety_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Least-Privilege RLS Policies
-- Users: Public can read non-suspended profile fields; users can update own profile
DROP POLICY IF EXISTS "Public can view active profiles" ON public.users;
CREATE POLICY "Public can view active profiles" ON public.users
  FOR SELECT USING (is_suspended = FALSE);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid()::text = id);

-- Notes: Visible to author, or connections if audience='followers', or close friends
DROP POLICY IF EXISTS "Author can do all on notes" ON public.notes;
CREATE POLICY "Author can do all on notes" ON public.notes
  FOR ALL USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Circle can read notes" ON public.notes;
CREATE POLICY "Circle can read notes" ON public.notes
  FOR SELECT USING (
    status = 'ACTIVE' AND
    (
      audience = 'followers' AND EXISTS (
        SELECT 1 FROM public.connections WHERE status = 'ACCEPTED' AND (
          (requester_id = auth.uid()::text AND target_id = notes.user_id) OR
          (target_id = auth.uid()::text AND requester_id = notes.user_id)
        )
      )
      OR
      audience = 'close_friends' AND EXISTS (
        SELECT 1 FROM public.close_friends WHERE user_id = notes.user_id AND friend_id = auth.uid()::text
      )
    )
  );

-- Conversations: Accessible only by participants
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT USING (participant_ids ? auth.uid()::text);

-- Messages: Accessible only by conversation participants
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND participant_ids ? auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()::text AND
    EXISTS (
      SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND participant_ids ? auth.uid()::text
    )
  );

-- Notifications: Only recipient can view/update
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL USING (recipient_id = auth.uid()::text);

-- Device Public Keys: Anyone in circle can read public keys for E2EE; owner can insert/revoke
DROP POLICY IF EXISTS "Public can read device keys" ON public.device_public_keys;
CREATE POLICY "Public can read device keys" ON public.device_public_keys
  FOR SELECT USING (is_revoked = FALSE);

DROP POLICY IF EXISTS "Owner can manage device keys" ON public.device_public_keys;
CREATE POLICY "Owner can manage device keys" ON public.device_public_keys
  FOR ALL USING (user_id = auth.uid()::text);
