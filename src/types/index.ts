export type PrivacyAudience = 'followers' | 'close_friends' | 'selected';

export type NoteCategory = 
  | 'family'
  | 'study'
  | 'work'
  | 'travel'
  | 'vacation'
  | 'gaming'
  | 'sleep'
  | 'dnd'
  | 'break'
  | 'custom';

export type FollowStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

export type NoteStatus = 'ACTIVE' | 'SCHEDULED' | 'DRAFT' | 'EXPIRED' | 'DELETED';

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export type VisibilityLevel = 'connections' | 'only_me';

export type AvailabilityCode = 
  | 'available'
  | 'dnd'
  | 'busy'
  | 'sleeping'
  | 'travelling'
  | 'studying'
  | 'family'
  | 'offline';

export interface UserAvailability {
  code: AvailabilityCode;
  label: string;
  emoji: string;
  customStatus?: string;
  expiresAt?: string | null;
  strictDnd: boolean;
  updatedAt: string;
}

export interface UserPrivacySettings {
  whoCanMessageMe: 'followers' | 'people_i_follow' | 'mutual' | 'nobody';
  whoCanSeeOnlineStatus: 'connections' | 'nobody';
  whoCanSeeReadReceipts: 'connections' | 'nobody';
  whoCanSeeTyping: 'connections' | 'nobody';
  whoCanFollowMe: 'anyone' | 'require_approval';
  whoCanReply: 'connections' | 'close_friends' | 'nobody';
  whoCanReact: 'connections' | 'close_friends' | 'nobody';
  bioVisibility: VisibilityLevel;
  cityVisibility: VisibilityLevel;
  birthdayVisibility: VisibilityLevel;
  workplaceVisibility: VisibilityLevel;
  followerCountsVisibility: VisibilityLevel;
  dndModeStrict: boolean;
}

export interface NotificationSettings {
  messages: boolean;
  messageRequests: boolean;
  followRequests: boolean;
  acceptedRequests: boolean;
  reactions: boolean;
  replies: boolean;
  noteExpiration: boolean;
  securityAlerts: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  avatarUrl: string;
  bio: string;
  city?: string;
  birthday?: string;
  workplace?: string;
  isPrivate: true;
  isAdmin?: boolean;
  isSuspended?: boolean;
  availability: UserAvailability;
  privacySettings: UserPrivacySettings;
  notificationSettings: NotificationSettings;
  createdAt: string;
  lastActiveAt?: string;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: true;
  isConnection: boolean;
  isPendingRequest: boolean;
  hasIncomingRequest: boolean;
  isCloseFriend: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  availability?: UserAvailability;
  bio?: string;
  city?: string;
  birthday?: string;
  workplace?: string;
  followersCount?: number;
  followingCount?: number;
  activeNote?: NoteSummary;
}

export interface Connection {
  id: string;
  requesterId: string;
  targetId: string;
  status: FollowStatus;
  createdAt: string;
  updatedAt: string;
  requester?: User;
  target?: User;
}

export interface NoteReaction {
  id: string;
  noteId: string;
  userId: string;
  username: string;
  displayName: string;
  emoji: string;
  createdAt: string;
}

export interface NoteReply {
  id: string;
  noteId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
}

export interface NoteSummary {
  id: string;
  emoji: string;
  category: NoteCategory;
  categoryLabel: string;
  text: string;
  expiresAt: string | null;
  isDnd: boolean;
}

export interface Note {
  id: string;
  userId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  emoji: string;
  category: NoteCategory;
  categoryLabel: string;
  text: string;
  audience: PrivacyAudience;
  selectedUserIds?: string[];
  expiresAt: string | null;
  scheduledFor?: string | null;
  status: NoteStatus;
  isPinned?: boolean;
  isDraft?: boolean;
  templateName?: string;
  allowReplies: boolean;
  allowReactions: boolean;
  reactions: NoteReaction[];
  replies: NoteReply[];
  isOwner: boolean;
  isCloseFriendOnly: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  emoji: string;
  category: NoteCategory;
  text: string;
  duration: string;
  audience: PrivacyAudience;
}

export interface MessageReaction {
  userId: string;
  username: string;
  emoji: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string; // Plaintext on local device; relayed encrypted over wire
  encryptedPayload?: string; // Encrypted ciphertext for wire relay
  replyToId?: string;
  replyPreview?: {
    id: string;
    senderName: string;
    text: string;
  };
  mediaUrl?: string;
  mediaType?: 'image' | 'file';
  reactions: MessageReaction[];
  status: MessageStatus;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedForMe?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title?: string;
  participantIds: string[];
  participants: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    availability?: UserAvailability;
    activeNote?: NoteSummary;
    onlineStatus?: 'online' | 'offline';
  }[];
  lastMessage?: Message;
  unreadCount: number;
  isMuted?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: 
    | 'follow_request' 
    | 'follow_accept' 
    | 'note_reaction' 
    | 'note_reply' 
    | 'message' 
    | 'note_expiring' 
    | 'security_alert'
    | 'system';
  entityId?: string;
  text: string;
  read: boolean;
  createdAt: string;
}

export interface BugReport {
  id: string;
  userId: string;
  username: string;
  category: 'ui' | 'privacy' | 'notes' | 'chat' | 'sync' | 'other';
  description: string;
  errorIdentifier?: string;
  screenshot?: string;
  deviceInfo: {
    browser: string;
    os: string;
    viewport: string;
    isAndroidFrame: boolean;
  };
  status: 'SUBMITTED' | 'REVIEWING' | 'IN_PROGRESS' | 'RESOLVED';
  resolutionNote?: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterUsername: string;
  targetType: 'user' | 'note' | 'message';
  targetId: string;
  targetAuthorName?: string;
  targetContentPreview?: string;
  reason: 'spam' | 'harassment' | 'impersonation' | 'abuse' | 'sexual' | 'violence' | 'fraud' | 'other';
  details?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  actionTaken?: string;
  createdAt: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  current: boolean;
  lastActive: string;
}
