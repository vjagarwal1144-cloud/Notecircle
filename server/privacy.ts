import { db } from './db.ts';
import type { Note, User, PublicUserProfile } from '../src/types/index.ts';

/**
 * Checks if two users have a block relationship in either direction.
 */
export function isBlocked(userA: string, userB: string): boolean {
  const blocks = db.get('blocks');
  return blocks.some(
    (b) => (b.userId === userA && b.blockedUserId === userB) || 
           (b.userId === userB && b.blockedUserId === userA)
  );
}

/**
 * Checks if userA has muted userB
 */
export function isMuted(viewerId: string, authorId: string): boolean {
  const mutes = db.get('mutes');
  return mutes.some((m) => m.userId === viewerId && m.mutedUserId === authorId);
}

/**
 * Checks if viewer is an approved follower of author.
 * NoteCircle Model:
 * Author is private. Viewer must have an ACCEPTED connection where viewer is requester,
 * OR if mutual. In this system, connection:
 * requesterId: viewerId, targetId: authorId, status: 'ACCEPTED'
 */
export function isApprovedFollower(viewerId: string, authorId: string): boolean {
  if (viewerId === authorId) return true;
  if (isBlocked(viewerId, authorId)) return false;

  const connections = db.get('connections');
  return connections.some(
    (c) => ((c.requesterId === viewerId && c.targetId === authorId) ||
            (c.requesterId === authorId && c.targetId === viewerId)) &&
           c.status === 'ACCEPTED'
  );
}

/**
 * Checks if viewer is in author's Close Friends list.
 */
export function isCloseFriend(viewerId: string, authorId: string): boolean {
  if (viewerId === authorId) return true;
  if (isBlocked(viewerId, authorId)) return false;

  const closeFriends = db.get('closeFriends');
  return closeFriends.some((cf) => cf.userId === authorId && cf.friendId === viewerId);
}

/**
 * Checks if a note has expired according to UTC time.
 */
export function isNoteExpired(note: Note): boolean {
  if (!note.expiresAt) return false;
  return new Date(note.expiresAt).getTime() <= Date.now();
}

/**
 * Decides whether viewerId is authorized to read the given note.
 */
export function canViewNote(viewerId: string, note: Note): boolean {
  // If user is owner, they can always view their own note (even expired)
  if (note.userId === viewerId) {
    return note.status !== 'DELETED';
  }

  // If deleted, nobody can see it
  if (note.status === 'DELETED') {
    return false;
  }

  // Blocked users can never see notes
  if (isBlocked(viewerId, note.userId)) {
    return false;
  }

  // Check connection status: viewer MUST be an approved follower
  if (!isApprovedFollower(viewerId, note.userId)) {
    return false;
  }

  // Check audience:
  if (note.audience === 'close_friends') {
    return isCloseFriend(viewerId, note.userId);
  }

  if (note.audience === 'selected') {
    const selected = (note as any).selectedUserIds || [];
    return selected.includes(viewerId);
  }

  // Default: 'followers'
  return true;
}

/**
 * Filters the active home feed for a user.
 * - Only active notes from approved connections (and self)
 * - Audience must match
 * - Expiration must be in the future
 * - Author must not be blocked or muted
 */
export function getFeedNotesForUser(viewerId: string): Note[] {
  const allNotes = db.get('notes');
  const now = Date.now();

  return allNotes
    .filter((note) => {
      // Must not be deleted or expired
      if (note.status === 'DELETED') return false;
      if (note.expiresAt && new Date(note.expiresAt).getTime() <= now) return false;

      // Cannot be muted or blocked
      if (isMuted(viewerId, note.userId)) return false;
      if (isBlocked(viewerId, note.userId)) return false;

      // Check permission
      return canViewNote(viewerId, note);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((note) => ({
      ...note,
      isOwner: note.userId === viewerId,
      isCloseFriendOnly: note.audience === 'close_friends'
    }));
}

/**
 * Returns a public user profile with strict privacy redaction:
 * If viewer is NOT an approved connection, private details (notes, bio, city, birthday, workplace, etc.) are stripped.
 */
export function getRedactedProfile(viewerId: string, targetUser: User): PublicUserProfile {
  const isSelf = viewerId === targetUser.id;
  const isConn = isSelf || isApprovedFollower(viewerId, targetUser.id);
  const connections = db.get('connections');
  const blocks = db.get('blocks');
  const mutes = db.get('mutes');

  const isPending = connections.some(
    (c) => c.requesterId === viewerId && c.targetId === targetUser.id && c.status === 'PENDING'
  );

  const hasIncoming = connections.some(
    (c) => c.requesterId === targetUser.id && c.targetId === viewerId && c.status === 'PENDING'
  );

  const isBlockedUser = blocks.some(
    (b) => (b.userId === viewerId && b.blockedUserId === targetUser.id) ||
           (b.userId === targetUser.id && b.blockedUserId === viewerId)
  );

  const isMutedUser = mutes.some((m) => m.userId === viewerId && m.mutedUserId === targetUser.id);
  const isCf = isCloseFriend(viewerId, targetUser.id);

  // Calculate follower / following counts
  const followersCount = connections.filter((c) => c.targetId === targetUser.id && c.status === 'ACCEPTED').length;
  const followingCount = connections.filter((c) => c.requesterId === targetUser.id && c.status === 'ACCEPTED').length;

  // Active note for profile (only shown if viewer is authorized!)
  let activeNoteSummary = undefined;
  if (isConn && !isBlockedUser) {
    const userNotes = db.get('notes').filter(
      (n) => n.userId === targetUser.id && n.status === 'ACTIVE' && (!n.expiresAt || new Date(n.expiresAt).getTime() > Date.now())
    );
    if (userNotes.length > 0) {
      const topNote = userNotes[userNotes.length - 1];
      if (canViewNote(viewerId, topNote)) {
        activeNoteSummary = {
          id: topNote.id,
          emoji: topNote.emoji,
          category: topNote.category,
          categoryLabel: topNote.categoryLabel,
          text: topNote.text,
          expiresAt: topNote.expiresAt,
          isDnd: topNote.category === 'dnd' || topNote.category === 'sleep' || topNote.category === 'family'
        };
      }
    }
  }

  // Field privacy checks
  const pSettings = targetUser.privacySettings || {
    bioVisibility: 'connections',
    cityVisibility: 'connections',
    birthdayVisibility: 'only_me',
    workplaceVisibility: 'connections',
    followerCountsVisibility: 'connections'
  };

  const showBio = isSelf || (isConn && pSettings.bioVisibility === 'connections');
  const showCity = isSelf || (isConn && pSettings.cityVisibility === 'connections');
  const showBday = isSelf || (isConn && pSettings.birthdayVisibility === 'connections');
  const showWork = isSelf || (isConn && pSettings.workplaceVisibility === 'connections');
  const showCounts = isSelf || (isConn && pSettings.followerCountsVisibility !== 'only_me');

  return {
    id: targetUser.id,
    username: targetUser.username,
    displayName: targetUser.displayName,
    avatarUrl: targetUser.avatarUrl,
    isPrivate: true,
    isConnection: isConn,
    isPendingRequest: isPending,
    hasIncomingRequest: hasIncoming,
    isCloseFriend: isCf,
    isBlocked: isBlockedUser,
    isMuted: isMutedUser,
    availability: (isConn || isSelf) ? targetUser.availability : undefined,
    bio: showBio ? targetUser.bio : undefined,
    city: showCity ? targetUser.city : undefined,
    birthday: showBday ? targetUser.birthday : undefined,
    workplace: showWork ? targetUser.workplace : undefined,
    followersCount: showCounts ? followersCount : undefined,
    followingCount: showCounts ? followingCount : undefined,
    activeNote: activeNoteSummary
  };
}

/**
 * Decides if sender can message recipient based on recipient's privacy settings.
 */
export function canMessage(senderId: string, recipientId: string): { allowed: boolean; reason?: string } {
  if (senderId === recipientId) return { allowed: true };
  if (isBlocked(senderId, recipientId)) return { allowed: false, reason: 'You cannot message this user.' };

  const recipient = db.get('users').find((u) => u.id === recipientId);
  if (!recipient) return { allowed: false, reason: 'User not found' };

  const rule = recipient.privacySettings?.whoCanMessageMe || 'mutual';

  if (rule === 'nobody') {
    return { allowed: false, reason: `${recipient.displayName} has disabled private messaging.` };
  }

  const isFollower = isApprovedFollower(senderId, recipientId);
  const isFollowing = isApprovedFollower(recipientId, senderId);
  const isMutual = isFollower && isFollowing;

  if (rule === 'mutual' && !isMutual) {
    return { allowed: false, reason: `${recipient.displayName} only accepts messages from mutual connections.` };
  }

  if (rule === 'followers' && !isFollower) {
    return { allowed: false, reason: `${recipient.displayName} only accepts messages from approved followers.` };
  }

  if (rule === 'people_i_follow' && !isFollowing) {
    return { allowed: false, reason: `${recipient.displayName} only accepts messages from people they follow.` };
  }

  return { allowed: true };
}
