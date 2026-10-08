-- NoteCircle Production PostgreSQL Data Migration
-- Cleaned, validated production export from data/notecircle.db
-- Strictly restricted to valid users: [usr_1791450678272_b2t31, usr_1791457400815_q27pr]
-- All orphaned/deleted user references, old sessions, and old OTPs excluded

BEGIN;

-- ============================================================================
-- 1. USERS (2 valid users)
-- ============================================================================
INSERT INTO public.users (
  id, username, display_name, email, phone, avatar_url, bio, city, birthday, workplace,
  is_private, is_admin, is_suspended, availability, privacy_settings, notification_settings,
  password_hash, created_at
) VALUES (
  'usr_1791450678272_b2t31',
  'garg',
  'Garg',
  'vjagarwal1133@gmail.com',
  NULL,
  NULL,
  '',
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  FALSE,
  '{"code":"available","label":"Available","emoji":"🟢","strictDnd":false,"updatedAt":"2026-10-08T09:11:18.273Z"}'::jsonb,
  '{"whoCanMessageMe":"mutual","whoCanSeeOnlineStatus":"connections","whoCanSeeReadReceipts":"connections","whoCanSeeTyping":"connections","whoCanFollowMe":"require_approval","whoCanReply":"connections","whoCanReact":"connections","bioVisibility":"connections","cityVisibility":"connections","birthdayVisibility":"only_me","workplaceVisibility":"connections","followerCountsVisibility":"connections","dndModeStrict":false}'::jsonb,
  '{"messages":true,"messageRequests":true,"followRequests":true,"acceptedRequests":true,"reactions":true,"replies":true,"noteExpiration":true,"securityAlerts":true}'::jsonb,
  'scrypt:v1:b81f89704afa07097019779b13df285a:37b324faeacb2548f8e5d4fe50dfb03cc5634c7380fffefe8dc0ec00e584c9c0',
  '2026-10-08T09:11:18.273Z'::timestamptz
) ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  availability = EXCLUDED.availability,
  privacy_settings = EXCLUDED.privacy_settings,
  notification_settings = EXCLUDED.notification_settings,
  created_at = EXCLUDED.created_at;

INSERT INTO public.users (
  id, username, display_name, email, phone, avatar_url, bio, city, birthday, workplace,
  is_private, is_admin, is_suspended, availability, privacy_settings, notification_settings,
  password_hash, created_at
) VALUES (
  'usr_1791457400815_q27pr',
  'vijay',
  'Shibam',
  'vjagarwal1144@gmail.com',
  NULL,
  NULL,
  '',
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  FALSE,
  '{"code":"available","label":"Available","emoji":"🟢","strictDnd":false,"updatedAt":"2026-10-08T11:03:20.815Z"}'::jsonb,
  '{"whoCanMessageMe":"mutual","whoCanSeeOnlineStatus":"connections","whoCanSeeReadReceipts":"connections","whoCanSeeTyping":"connections","whoCanFollowMe":"require_approval","whoCanReply":"connections","whoCanReact":"connections","bioVisibility":"connections","cityVisibility":"connections","birthdayVisibility":"only_me","workplaceVisibility":"connections","followerCountsVisibility":"connections","dndModeStrict":false}'::jsonb,
  '{"messages":true,"messageRequests":true,"followRequests":true,"acceptedRequests":true,"reactions":true,"replies":true,"noteExpiration":true,"securityAlerts":true}'::jsonb,
  'scrypt:v1:1f6cd858e38e655f247aa31a42da11b7:3ffa0bc4744f75d7a31aedb5cc10c74ad076462572d990c530828fb300de7067',
  '2026-10-08T11:03:20.815Z'::timestamptz
) ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  availability = EXCLUDED.availability,
  privacy_settings = EXCLUDED.privacy_settings,
  notification_settings = EXCLUDED.notification_settings,
  created_at = EXCLUDED.created_at;


-- ============================================================================
-- 2. DEVICE PUBLIC KEYS (4 valid keys for existing users)
-- ============================================================================
INSERT INTO public.device_public_keys (
  id, user_id, device_id, device_name, public_key_jwk, fingerprint, is_revoked, created_at, last_seen
) VALUES (
  'devkey_1791455779166_9y61',
  'usr_1791450678272_b2t31',
  'dev_1791455779498_xv84',
  'NoteCircle Web Client',
  '{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"45Jis9_p0EY0YDAiIT73IwWIB8qxKN0rt9jhEQQi-1Y","y":"tH-zplT9ddEqZICRhnSNMXdc2ZoAN2epzNq4TfktMJY"}'::jsonb,
  '68F427069B6DBC6DC0F58FA06C7D2F9F',
  FALSE,
  '2026-10-08T10:36:19.166Z'::timestamptz,
  '2026-10-08T10:40:11.161Z'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.device_public_keys (
  id, user_id, device_id, device_name, public_key_jwk, fingerprint, is_revoked, created_at, last_seen
) VALUES (
  'devkey_1791450757873_ndul',
  'usr_1791450678272_b2t31',
  'dev_1791450758102_opgm',
  'NoteCircle Web Client',
  '{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"7D_lbgxj12HzyPlHOW9u0AzOZxmK1vsXDNSLXlb0icU","y":"arqKrY_zFBRYCMpIynVJmnRWUdXXtK2Usn3R8vUwy9A"}'::jsonb,
  '7BE20404F173198D6B0BFEE6A0203660',
  FALSE,
  '2026-10-08T09:12:37.872Z'::timestamptz,
  '2026-10-08T09:12:37.872Z'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.device_public_keys (
  id, user_id, device_id, device_name, public_key_jwk, fingerprint, is_revoked, created_at, last_seen
) VALUES (
  'devkey_1791450689503_xa5e',
  'usr_1791450678272_b2t31',
  'dev_1791450689718_2361',
  'NoteCircle Web Client',
  '{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"AjqhmDnUfeKhJ3VLE8aFSawAlALdu9atG631Fy09Pnc","y":"AHSN-hY1-F6_u_s2x0J7AMkx6AG_ahSn5X1HN05Iq9U"}'::jsonb,
  'B86770C189B690999C8392F89ABC8A92',
  FALSE,
  '2026-10-08T09:11:29.503Z'::timestamptz,
  '2026-10-08T09:11:29.503Z'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.device_public_keys (
  id, user_id, device_id, device_name, public_key_jwk, fingerprint, is_revoked, created_at, last_seen
) VALUES (
  'devkey_1791457652199_x13n',
  'usr_1791457400815_q27pr',
  'dev_1791455779498_xv84',
  'NoteCircle Web Client',
  '{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"45Jis9_p0EY0YDAiIT73IwWIB8qxKN0rt9jhEQQi-1Y","y":"tH-zplT9ddEqZICRhnSNMXdc2ZoAN2epzNq4TfktMJY"}'::jsonb,
  '68F427069B6DBC6DC0F58FA06C7D2F9F',
  FALSE,
  '2026-10-08T11:07:32.199Z'::timestamptz,
  '2026-10-08T11:07:32.199Z'::timestamptz
) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3. AUDIT LOGS (12 legitimate security & activity logs for valid users)
-- ============================================================================
INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791450678320',
  'REGISTER_SUCCESS',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T09:11:18.320Z'::timestamptz,
  'New account created: @garg'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791450689503',
  'CRYPTO_DEVICE_KEY_REGISTERED',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T09:11:29.503Z'::timestamptz,
  'Device: dev_1791450689718_2361, Fingerprint: B86770C189B690999C8392F89ABC8A92'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791450757553',
  'LOGIN_SUCCESS',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T09:12:37.553Z'::timestamptz,
  'Device: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791450757873',
  'CRYPTO_DEVICE_KEY_REGISTERED',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T09:12:37.873Z'::timestamptz,
  'Device: dev_1791450758102_opgm, Fingerprint: 7BE20404F173198D6B0BFEE6A0203660'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791455775872',
  'LOGIN_SUCCESS',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T10:36:15.872Z'::timestamptz,
  'Device: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791455779166',
  'CRYPTO_DEVICE_KEY_REGISTERED',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T10:36:19.166Z'::timestamptz,
  'Device: dev_1791455779498_xv84, Fingerprint: 68F427069B6DBC6DC0F58FA06C7D2F9F'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791456011162',
  'CRYPTO_DEVICE_KEY_REGISTERED',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T10:40:11.162Z'::timestamptz,
  'Device: dev_1791455779498_xv84, Fingerprint: 68F427069B6DBC6DC0F58FA06C7D2F9F'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791456948998',
  'AVATAR_UPLOADED',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T10:55:48.998Z'::timestamptz,
  'New avatar saved: /uploads/avatars/avatar_usr_1791450678272_b2t31_1791456948996_6e764a.png'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791456949014',
  'AVATAR_REMOVED',
  'usr_1791450678272_b2t31',
  'garg',
  '2026-10-08T10:55:49.014Z'::timestamptz,
  'Removed custom profile photo'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791457400887',
  'REGISTER_EMAIL_VERIFIED',
  'usr_1791457400815_q27pr',
  'vijay',
  '2026-10-08T11:03:20.887Z'::timestamptz,
  'Activated with email: vjagarwal1144@gmail.com'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791457652199',
  'CRYPTO_DEVICE_KEY_REGISTERED',
  'usr_1791457400815_q27pr',
  'vijay',
  '2026-10-08T11:07:32.199Z'::timestamptz,
  'Device: dev_1791455779498_xv84, Fingerprint: 68F427069B6DBC6DC0F58FA06C7D2F9F'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (
  id, action, actor_id, actor_username, timestamp, details
) VALUES (
  'audit_1791461872426',
  'LOGIN_SUCCESS',
  'usr_1791457400815_q27pr',
  'vijay',
  '2026-10-08T12:17:52.426Z'::timestamptz,
  'Device: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537'
) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4. EMAIL LOGS (2 verified production transaction logs)
-- ============================================================================
INSERT INTO public.email_logs (
  id, recipient, type, status, provider, error, created_at
) VALUES (
  'elog_1791457303821_b1ee2883',
  'vjagarwal1144@gmail.com',
  'REGISTRATION_OTP',
  'SENT',
  'resend',
  NULL,
  '2026-10-08T11:01:43.821Z'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.email_logs (
  id, recipient, type, status, provider, error, created_at
) VALUES (
  'elog_1791457401257_8d0b47d3',
  'vjagarwal1144@gmail.com',
  'WELCOME_EMAIL',
  'SENT',
  'resend',
  NULL,
  '2026-10-08T11:03:21.258Z'::timestamptz
) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 5. PRE-COMMIT VALIDATION & FOREIGN KEY INTEGRITY CHECKS
-- ============================================================================
DO $$
DECLARE
  v_user_count INT;
  v_device_keys_count INT;
  v_audit_logs_count INT;
  v_orphaned_keys INT;
BEGIN
  -- Count validation
  SELECT COUNT(*) INTO v_user_count FROM public.users;
  SELECT COUNT(*) INTO v_device_keys_count FROM public.device_public_keys;
  SELECT COUNT(*) INTO v_audit_logs_count FROM public.audit_logs;

  RAISE NOTICE 'Validation: users=%, device_keys=%, audit_logs=%', v_user_count, v_device_keys_count, v_audit_logs_count;

  -- FK Check: Device public keys must point to an existing user
  SELECT COUNT(*) INTO v_orphaned_keys
  FROM public.device_public_keys k
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = k.user_id);

  IF v_orphaned_keys > 0 THEN
    RAISE EXCEPTION 'FK Integrity Failure: % device_public_keys have orphaned user_id', v_orphaned_keys;
  END IF;

  IF v_user_count < 2 THEN
    RAISE EXCEPTION 'Validation Failure: Expected at least 2 users, found %', v_user_count;
  END IF;

  RAISE NOTICE 'Pre-commit integrity checks passed successfully.';
END $$;

COMMIT;
