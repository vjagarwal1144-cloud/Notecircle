import type { 
  User, 
  PublicUserProfile, 
  Note, 
  Conversation, 
  Message, 
  AppNotification, 
  Report,
  BugReport,
  UserPrivacySettings,
  UserAvailability,
  NotificationSettings
} from '../types/index.ts';

let inMemoryToken: string | null = null;

// Purge any legacy localStorage tokens for security
try {
  localStorage.removeItem('notecircle_auth_token');
  localStorage.removeItem('notecircle_token');
} catch {}

export function getStoredToken(): string | null {
  return inMemoryToken;
}

export function setStoredToken(token: string | null) {
  inMemoryToken = token;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  async getCurrentUser() {
    return request<{ user: User }>('/api/auth/me');
  },
  async login(identifier: string, password: string) {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
  },
  async sendRegisterOtp(email: string) {
    return request<{ success: boolean; message: string; email: string; expiresAt: string; cooldownUntil: string; emailConfigured: boolean }>('/api/auth/register/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },
  async verifyRegisterOtp(email: string, otp: string) {
    return request<{ success: boolean; message: string; verificationToken: string }>('/api/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },
  async completeRegistration(data: {
    email: string;
    verificationToken: string;
    username: string;
    displayName: string;
    password: string;
    city?: string;
    bio?: string;
    avatarUrl?: string;
  }) {
    return request<{ token: string; user: User }>('/api/auth/register/complete', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async register(data: {
    username: string;
    displayName: string;
    email?: string;
    phone?: string;
    password: string;
    city?: string;
    bio?: string;
  }) {
    return request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async logout() {
    return request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
  },
  async forgotPassword(identifier: string) {
    return request<{ success: boolean; message: string; userId?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
  },
  async requestPasswordRecovery(identifier: string) {
    return request<{ success: boolean; message: string; userId: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
  },
  async resetPassword(data: { userId: string; code: string; newPassword: string }) {
    return request<{ success: boolean; message: string; token: string; user: User }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async resetPasswordWithRecoveryCode(userId: string, code: string, newPassword: string) {
    return request<{ success: boolean; message: string; token: string; user: User }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, code, newPassword })
    });
  },

  // Users & Profiles & Availability
  async searchUsers(query: string) {
    return request<{ users: PublicUserProfile[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
  },
  async getProfile(username: string) {
    return request<{ profile: PublicUserProfile }>(`/api/users/profile/${encodeURIComponent(username)}`);
  },
  async updateProfile(data: Partial<User>) {
    return request<{ user: User }>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async uploadAvatar(dataUrl: string) {
    return request<{ success: boolean; avatarUrl: string; user: User }>('/api/users/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ dataUrl })
    });
  },
  async removeAvatar() {
    return request<{ success: boolean; avatarUrl: null; user: User }>('/api/users/me/avatar', {
      method: 'DELETE'
    });
  },
  async updateAvailability(availability: Partial<UserAvailability>) {
    return request<{ availability: UserAvailability; user: User }>('/api/users/me/availability', {
      method: 'PUT',
      body: JSON.stringify(availability)
    });
  },
  async updatePrivacySettings(settings: Partial<UserPrivacySettings>) {
    return request<{ user: User }>('/api/users/me/privacy', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },
  async updateNotificationSettings(settings: Partial<NotificationSettings>) {
    return request<{ user: User }>('/api/users/me/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },
  async updateCredentials(data: { currentPassword?: string; newPassword?: string; newEmail?: string; newPhone?: string }) {
    return request<{ success: boolean; user: User }>('/api/users/me/credentials', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async getSessions() {
    return request<{ sessions: Array<{ id: string; device: string; browser: string; ip: string; current: boolean; lastActive: string }> }>('/api/users/me/sessions');
  },
  async revokeSession(sessionId: string) {
    return request<{ success: boolean; message: string }>(`/api/users/me/sessions/${sessionId}`, { method: 'DELETE' });
  },
  async logoutAllDevices() {
    return request<{ success: boolean; message: string }>('/api/users/me/logout-all-devices', { method: 'POST' });
  },
  exportPersonalDataUrl() {
    const token = getStoredToken();
    return `/api/users/me/export-data${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  async deleteAccount() {
    return request<{ success: boolean }>('/api/users/me', { method: 'DELETE' });
  },

  // Connections
  async getConnectionsList() {
    return request<{ connections: PublicUserProfile[] }>('/api/connections/list');
  },
  async getPendingRequests() {
    return request<{
      incoming: Array<{ id: string; requesterId: string; createdAt: string; requester?: User }>;
      outgoing: Array<{ id: string; targetId: string; createdAt: string; target?: User }>;
    }>('/api/connections/pending');
  },
  async sendFollowRequest(targetUserId: string) {
    return request<{ success: boolean; message: string }>(`/api/connections/request/${targetUserId}`, { method: 'POST' });
  },
  async acceptFollowRequest(requestId: string) {
    return request<{ success: boolean; message: string }>(`/api/connections/requests/${requestId}/accept`, { method: 'POST' });
  },
  async rejectFollowRequest(requestId: string) {
    return request<{ success: boolean; message: string }>(`/api/connections/requests/${requestId}/reject`, { method: 'POST' });
  },
  async unfollow(targetUserId: string) {
    return request<{ success: boolean }>(`/api/connections/following/${targetUserId}`, { method: 'DELETE' });
  },
  async removeFollower(followerId: string) {
    return request<{ success: boolean }>(`/api/connections/followers/${followerId}`, { method: 'DELETE' });
  },
  async getCloseFriends() {
    return request<{ closeFriends: Array<{ id: string; friendId: string; createdAt: string; friend: User }> }>('/api/connections/close-friends');
  },
  async toggleCloseFriend(friendId: string) {
    return request<{ success: boolean; isCloseFriend: boolean }>(`/api/connections/close-friends/${friendId}`, { method: 'POST' });
  },
  async blockUser(userId: string) {
    return request<{ success: boolean; message: string }>(`/api/connections/block/${userId}`, { method: 'POST' });
  },
  async unblockUser(userId: string) {
    return request<{ success: boolean; message: string }>(`/api/connections/unblock/${userId}`, { method: 'POST' });
  },
  async toggleMute(userId: string) {
    return request<{ success: boolean; isMuted: boolean }>(`/api/connections/mute/${userId}`, { method: 'POST' });
  },

  // Notes
  async getFeed() {
    return request<{ notes: Note[] }>('/api/notes/feed');
  },
  async getMyNotes() {
    return request<{ activeNotes: Note[]; scheduledNotes: Note[]; draftNotes: Note[]; pastNotes: Note[] }>('/api/notes/mine');
  },
  async getNote(noteId: string) {
    return request<{ note: Note }>(`/api/notes/${noteId}`);
  },
  async createNote(data: {
    text: string;
    emoji: string;
    category: string;
    audience: string;
    duration: string;
    scheduledFor?: string | null;
    isDraft?: boolean;
    isPinned?: boolean;
    allowReplies?: boolean;
    allowReactions?: boolean;
    selectedUserIds?: string[];
  }) {
    return request<{ note: Note }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateNote(noteId: string, data: Partial<Note>) {
    return request<{ note: Note }>(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteNote(noteId: string) {
    return request<{ success: boolean }>(`/api/notes/${noteId}`, { method: 'DELETE' });
  },
  async toggleReaction(noteId: string, emoji: string) {
    return request<{ note: Note }>(`/api/notes/${noteId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  },
  async addReply(noteId: string, text: string) {
    return request<{ reply: any; note: Note }>(`/api/notes/${noteId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  // Chat
  async getConversations() {
    return request<{ conversations: Conversation[] }>('/api/chat/conversations');
  },
  async startConversation(targetUserId: string) {
    return request<{ conversation: Conversation }>('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
  },
  async createGroupConversation(title: string, participantIds: string[]) {
    return request<{ conversation: Conversation }>('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'group', title, participantIds })
    });
  },
  async getMessages(conversationId: string) {
    return request<{ messages: Message[] }>(`/api/chat/conversations/${conversationId}/messages`);
  },
  async ackMessageDelivery(conversationId: string, messageIds: string[]) {
    return request<{ success: boolean }>(`/api/chat/conversations/${conversationId}/ack-delivery`, {
      method: 'POST',
      body: JSON.stringify({ messageIds })
    });
  },
  async sendMessage(conversationId: string, text: string, encryptedPayload?: string, replyToId?: string) {
    return request<{ message: Message }>(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, encryptedPayload, replyToId })
    });
  },
  async deleteMessage(messageId: string, deleteForEveryone: boolean = false) {
    return request<{ success: boolean }>(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteForEveryone })
    });
  },
  async reactToMessage(messageId: string, emoji: string) {
    return request<{ message: Message }>(`/api/chat/messages/${messageId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  },

  // Notifications
  async getNotifications() {
    return request<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications');
  },
  async markNotificationRead(id: string) {
    return request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' });
  },
  async markAllNotificationsRead() {
    return request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' });
  },

  // Bug Reports & Feedback
  async submitBug(data: { category: string; description: string; errorIdentifier?: string; deviceInfo?: any; screenshot?: string }) {
    return request<{ success: boolean; bug: BugReport }>('/api/bugs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async getMyBugs() {
    return request<{ bugs: BugReport[] }>('/api/bugs/mine');
  },
  async getAdminBugs() {
    return request<{ bugs: BugReport[] }>('/api/bugs/admin');
  },
  async updateAdminBug(id: string, status: string, resolutionNote?: string) {
    return request<{ success: boolean; bug: BugReport }>(`/api/bugs/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, resolutionNote })
    });
  },

  // Support & FAQs & Policies
  async getFaqs() {
    return request<{ faqs: Array<{ q: string; a: string }> }>('/api/support/faqs');
  },
  async getPolicies() {
    return request<{ policies: { terms: string; privacyPolicy: string; communityGuidelines: string } }>('/api/support/policies');
  },
  async submitSupportTicket(subject: string, message: string, email?: string) {
    return request<{ success: boolean; ticket: any }>('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ subject, message, email })
    });
  },

  // Reports & Admin
  async submitReport(data: {
    targetType: 'user' | 'note' | 'message';
    targetId: string;
    reason: string;
    details?: string;
  }) {
    return request<{ success: boolean; message: string }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async getAdminReports() {
    return request<{ reports: Report[] }>('/api/reports/admin/reports');
  },
  async handleReportAction(reportId: string, action: string, resolutionNote?: string) {
    return request<{ success: boolean; message: string }>(`/api/reports/admin/reports/${reportId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, resolutionNote })
    });
  },
  async getAdminMetrics() {
    return request<{ metrics: any }>('/api/reports/admin/metrics');
  },

  // Cryptographic Public Key Registry & Safety Numbers
  async registerDevicePublicKey(deviceId: string, deviceName: string, publicKeyJwk: any) {
    return request<{ success: boolean; fingerprint: string }>('/api/crypto/keys/register', {
      method: 'POST',
      body: JSON.stringify({ deviceId, deviceName, publicKeyJwk })
    });
  },
  async getUserPublicKeys(userId: string) {
    return request<{
      userId: string;
      username: string;
      keys: Array<{
        deviceId: string;
        deviceName: string;
        publicKeyJwk: string;
        fingerprint: string;
        createdAt: string;
      }>;
    }>(`/api/crypto/keys/${userId}`);
  },
  async getMyDevices() {
    return request<{ devices: Array<{ deviceId: string; deviceName: string; fingerprint: string; isRevoked: boolean; lastSeen: string }> }>('/api/crypto/devices');
  },
  async revokeDevice(deviceId: string) {
    return request<{ success: boolean; message: string }>(`/api/crypto/devices/${deviceId}`, { method: 'DELETE' });
  },
  async getSafetyNumber(otherUserId: string) {
    return request<{ userIds: string[]; safetyNumber: string; verified: boolean }>(`/api/crypto/safety-numbers/${otherUserId}`);
  },
  async verifySafetyNumber(otherUserId: string, verified: boolean) {
    return request<{ success: boolean; userId: string; verified: boolean }>(`/api/crypto/safety-numbers/${otherUserId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verified })
    });
  },

  // Production Database Backup & Verification
  async createDatabaseBackup() {
    return request<{ success: boolean; backupFile: string; sizeBytes: number; createdAt: string }>('/api/admin/backup', { method: 'POST' });
  },
  async verifyDatabaseBackup() {
    return request<{ success: boolean; verifiedBackup: string; integrityCheck: string; recordsFound: any }>('/api/admin/backup/verify', { method: 'POST' });
  },
  async getAdminAuditLogs() {
    return request<{ logs: any[] }>('/api/admin/audit-logs');
  },

  // Circle Signature Features
  async getCircleStatus() {
    return request<{ circleMembers: any[] }>('/api/features/circle-status');
  },
  async getPlans() {
    return request<{ plans: any[] }>('/api/features/plans');
  },
  async createPlan(data: { title: string; emoji?: string; scheduledTime: string; location?: string }) {
    return request<{ plan: any }>('/api/features/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async rsvpPlan(planId: string, status: 'attending' | 'maybe' | 'declined') {
    return request<{ success: boolean; message: string }>(`/api/features/plans/${planId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },
  async getMemoryCapsules() {
    return request<{ capsules: any[] }>('/api/features/capsules');
  },
  async createMemoryCapsule(data: { title: string; coverEmoji?: string; unlockAt?: string; items?: any[] }) {
    return request<{ capsule: any }>('/api/features/capsules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
