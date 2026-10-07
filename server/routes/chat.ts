import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';
import { canMessage, isBlocked } from '../privacy.ts';
import { realtimeHub } from '../realtime.ts';
import type { Conversation, Message, AppNotification } from '../../src/types/index.ts';

export const chatRouter = Router();

// GET /api/chat/conversations
chatRouter.get('/conversations', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const allConversations = db.get('conversations');
  const allUsers = db.get('users');
  const allNotes = db.get('notes');
  const now = Date.now();

  const userConversations = allConversations
    .filter((c) => c.participantIds.includes(viewer.id) && !c.isArchived)
    .map((c) => {
      // Hydrate participants
      const participants = c.participantIds.map((pId) => {
        const u = allUsers.find((user) => user.id === pId);
        if (!u) {
          return { id: pId, username: 'unknown', displayName: 'User', avatarUrl: '' };
        }

        const activeNote = allNotes.find(
          (n) => n.userId === pId && n.status === 'ACTIVE' && (!n.expiresAt || new Date(n.expiresAt).getTime() > now)
        );

        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          availability: u.availability,
          activeNote: activeNote ? {
            id: activeNote.id,
            emoji: activeNote.emoji,
            category: activeNote.category,
            categoryLabel: activeNote.categoryLabel,
            text: activeNote.text,
            expiresAt: activeNote.expiresAt,
            isDnd: activeNote.category === 'dnd' || activeNote.category === 'sleep' || activeNote.category === 'family'
          } : undefined,
          onlineStatus: u.privacySettings?.whoCanSeeOnlineStatus === 'nobody' ? undefined : (realtimeHub.isUserOnline(u.id) ? ('online' as const) : undefined)
        };
      });

      const messages = (db.get('messages') || []).filter(
        (m) => m.conversationId === c.id && !(m.deletedForMe && m.senderId === viewer.id)
      );
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : undefined;

      const unreadCount = messages.filter(
        (m) => m.senderId !== viewer.id && m.status !== 'READ'
      ).length;

      return {
        ...c,
        participants,
        lastMessage: lastMsg,
        unreadCount
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json({ conversations: userConversations });
});

// POST /api/chat/conversations (Open or create 1:1 or Group conversation with strict validation)
chatRouter.post('/conversations', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { targetUserId, participantIds, title, type = 'direct' } = req.body;

  if (type === 'group') {
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      return res.status(400).json({ error: 'Group chat requires at least 2 other participants' });
    }

    // Validate that every invited participant exists, is not blocked, and allows communication
    const validatedMembers: string[] = [viewer.id];
    for (const pId of participantIds) {
      if (pId === viewer.id) continue;
      const user = db.get('users').find((u) => u.id === pId);
      if (!user) {
        return res.status(400).json({ error: `User ${pId} not found` });
      }
      if (isBlocked(viewer.id, pId)) {
        return res.status(403).json({ error: `Cannot add blocked user ${user.displayName} to group` });
      }
      const perm = canMessage(viewer.id, pId);
      if (!perm.allowed) {
        return res.status(403).json({ error: `Cannot add ${user.displayName}: ${perm.reason}` });
      }
      validatedMembers.push(pId);
    }

    const uniqueMembers = Array.from(new Set(validatedMembers));
    const newGroupConv: Conversation = {
      id: `conv_grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'group',
      title: title?.trim() || 'Private Circle',
      participantIds: uniqueMembers,
      participants: [],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.update('conversations', (list) => [newGroupConv, ...list]);
    return res.status(201).json({ conversation: newGroupConv });
  }

  // 1:1 Direct
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });
  if (viewer.id === targetUserId) {
    return res.status(400).json({ error: 'Cannot create conversation with yourself' });
  }

  const check = canMessage(viewer.id, targetUserId);
  if (!check.allowed) {
    return res.status(403).json({ error: check.reason });
  }

  const allConversations = db.get('conversations');
  const existing = allConversations.find(
    (c) => c.type === 'direct' &&
           c.participantIds.length === 2 &&
           c.participantIds.includes(viewer.id) &&
           c.participantIds.includes(targetUserId)
  );

  if (existing) {
    return res.json({ conversation: existing });
  }

  const newConv: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'direct',
    participantIds: [viewer.id, targetUserId],
    participants: [],
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.update('conversations', (list) => [newConv, ...list]);
  return res.status(201).json({ conversation: newConv });
});

// GET /api/chat/conversations/:id/messages
chatRouter.get('/conversations/:id/messages', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const convId = req.params.id;
  const conv = db.get('conversations').find((c) => c.id === convId);

  if (!conv || !conv.participantIds.includes(viewer.id)) {
    return res.status(404).json({ error: 'Conversation not found or access denied' });
  }

  const messages = (db.get('messages') || [])
    .filter((m) => m.conversationId === convId && !(m.deletedForMe && m.senderId === viewer.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Mark messages from other participants as READ
  db.update('messages', (list) =>
    (list || []).map((m) => {
      if (m.conversationId === convId && m.senderId !== viewer.id && m.status !== 'READ') {
        return { ...m, status: 'READ' as const };
      }
      return m;
    })
  );

  return res.json({ messages });
});

// POST /api/chat/conversations/:id/messages (Send message with client-side encryption enforcement)
chatRouter.post('/conversations/:id/messages', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const convId = req.params.id;
  const { text, encryptedPayload, replyToId, mediaUrl, clientMessageId } = req.body;
  const idempotencyKey = (req.headers['idempotency-key'] as string) || clientMessageId;

  // Requirement 5: Enforce encrypted chat payloads.
  // Reject unencrypted messages. A valid encrypted wire envelope is strictly mandatory.
  if (!encryptedPayload || typeof encryptedPayload !== 'string' || !encryptedPayload.trim()) {
    return res.status(400).json({
      error: 'End-to-end encrypted payload is strictly required. Plaintext messages are rejected for zero-knowledge privacy.'
    });
  }

  // Validate that encryptedPayload is a structured envelope with ciphertext and IV
  try {
    const parsedEnvelope = JSON.parse(encryptedPayload);
    if (!parsedEnvelope.ct || !parsedEnvelope.iv) {
      return res.status(400).json({ error: 'Malformed encrypted payload: missing ciphertext or IV' });
    }
  } catch {
    return res.status(400).json({ error: 'Malformed encrypted payload: must be valid JSON envelope' });
  }

  const conv = db.get('conversations').find((c) => c.id === convId);
  if (!conv || !conv.participantIds.includes(viewer.id)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  // Idempotency check: prevent duplicate insertion on network retry
  if (idempotencyKey) {
    const existing = (db.get('messages') || []).find(
      (m) => (m.id === idempotencyKey || (m as any).clientMessageId === idempotencyKey) && m.conversationId === convId
    );
    if (existing) {
      return res.status(200).json({ message: existing, idempotent: true });
    }
  }

  // Check recipients availability for DND strict mode
  const otherParticipantIds = conv.participantIds.filter((id) => id !== viewer.id);
  for (const recipientId of otherParticipantIds) {
    if (isBlocked(viewer.id, recipientId)) {
      return res.status(403).json({ error: 'You cannot message this user' });
    }

    const recipient = db.get('users').find((u) => u.id === recipientId);
    if (recipient) {
      // Check recipient availability status
      if (recipient.availability?.strictDnd && (recipient.availability.code === 'dnd' || recipient.availability.code === 'sleeping')) {
        return res.status(403).json({
          error: `${recipient.displayName} has Strict Do Not Disturb active (${recipient.availability.label}). Messages cannot be delivered until their status expires.`
        });
      }
    }
  }

  // Reply preview
  let replyPreview = undefined;
  if (replyToId) {
    const parent = db.get('messages').find((m) => m.id === replyToId && m.conversationId === convId);
    if (parent) {
      replyPreview = {
        id: parent.id,
        senderName: parent.senderName,
        text: parent.text.substring(0, 60)
      };
    }
  }

  const newMsg: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId: convId,
    senderId: viewer.id,
    senderName: viewer.displayName,
    senderAvatar: viewer.avatarUrl,
    // Strict privacy-first: Backend never stores readable plaintext for end-to-end encrypted chats
    text: '[End-to-End Encrypted Message]',
    encryptedPayload: encryptedPayload.trim(),
    replyToId,
    replyPreview,
    mediaUrl,
    reactions: [],
    status: 'SENT',
    createdAt: new Date().toISOString()
  };

  db.update('messages', (list) => [...(list || []), newMsg]);

  db.update('conversations', (list) =>
    list.map((c) =>
      c.id === convId
        ? { ...c, lastMessage: newMsg, updatedAt: new Date().toISOString() }
        : c
    )
  );

  // Realtime WebSocket broadcast to all online participants in this conversation
  realtimeHub.broadcastToUsers(conv.participantIds, 'new_message', {
    conversationId: convId,
    message: newMsg
  });

  // Notify other participants (Never expose private message content in notification metadata)
  for (const recipientId of otherParticipantIds) {
    const recipient = db.get('users').find((u) => u.id === recipientId);
    if (recipient?.notificationSettings?.messages !== false) {
      const notif: AppNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        recipientId,
        senderId: viewer.id,
        senderName: viewer.displayName,
        senderAvatar: viewer.avatarUrl,
        type: 'message',
        entityId: convId,
        text: `${viewer.displayName} sent you a private message.`,
        read: false,
        createdAt: new Date().toISOString()
      };
      db.update('notifications', (notifs) => [notif, ...(notifs || [])]);
      realtimeHub.sendToUser(recipientId, 'new_notification', notif);
    }
  }

  return res.status(201).json({ message: newMsg });
});

// DELETE /api/chat/messages/:id (Delete for me OR delete for everyone)
chatRouter.delete('/messages/:id', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const msgId = req.params.id;
  const deleteForEveryone = Boolean(
    req.body?.deleteForEveryone ||
    req.query?.deleteForEveryone === 'true' ||
    req.query?.forEveryone === 'true'
  );
  const msg = db.get('messages').find((m) => m.id === msgId);

  if (!msg) return res.status(404).json({ error: 'Message not found' });

  // Verify conversation membership
  const conv = db.get('conversations').find((c) => c.id === msg.conversationId);
  if (!conv || !conv.participantIds.includes(viewer.id)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  if (deleteForEveryone) {
    if (msg.senderId !== viewer.id && !viewer.isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own messages for everyone' });
    }
    db.update('messages', (list) =>
      list.map((m) =>
        m.id === msgId
          ? {
              ...m,
              text: 'This message was deleted.',
              encryptedPayload: undefined,
              mediaUrl: undefined,
              isDeleted: true
            }
          : m
      )
    );
    realtimeHub.broadcastToUsers(conv.participantIds, 'message_deleted', {
      conversationId: msg.conversationId,
      messageId: msgId,
      forEveryone: true
    });
  } else {
    // Delete for me
    db.update('messages', (list) =>
      list.map((m) => (m.id === msgId && m.senderId === viewer.id ? { ...m, deletedForMe: true } : m))
    );
  }

  return res.json({ success: true, message: 'Message deleted' });
});

// POST /api/chat/messages/:id/reaction
chatRouter.post('/messages/:id/reaction', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const msgId = req.params.id;
  const { emoji = '❤️' } = req.body;
  const msg = db.get('messages').find((m) => m.id === msgId);

  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const conv = db.get('conversations').find((c) => c.id === msg.conversationId);
  if (!conv || !conv.participantIds.includes(viewer.id)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  let updatedMsg = msg;
  db.update('messages', (list) =>
    list.map((m) => {
      if (m.id === msgId) {
        const existingIdx = m.reactions.findIndex((r) => r.userId === viewer.id && r.emoji === emoji);
        let newRx = [...m.reactions];
        if (existingIdx >= 0) {
          newRx.splice(existingIdx, 1);
        } else {
          newRx.push({ userId: viewer.id, username: viewer.username, emoji });
        }
        updatedMsg = { ...m, reactions: newRx };
        return updatedMsg;
      }
      return m;
    })
  );

  realtimeHub.broadcastToUsers(conv.participantIds, 'message_reaction', {
    conversationId: msg.conversationId,
    messageId: msgId,
    reactions: updatedMsg.reactions
  });

  return res.json({ message: updatedMsg });
});

// POST /api/chat/conversations/:id/ack-delivery
// Recipients acknowledge local storage in device IndexedDB
chatRouter.post('/conversations/:id/ack-delivery', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const convId = req.params.id;
  const { messageIds } = req.body;

  const conv = db.get('conversations').find((c) => c.id === convId);
  if (!conv || !conv.participantIds.includes(viewer.id)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    db.update('messages', (list) =>
      list.map((m) => {
        if (m.conversationId === convId && messageIds.includes(m.id) && m.senderId !== viewer.id) {
          return { ...m, status: 'READ' as const };
        }
        return m;
      })
    );
    realtimeHub.broadcastToUsers(conv.participantIds, 'messages_read', {
      conversationId: convId,
      messageIds,
      readerId: viewer.id
    });
  }

  return res.json({ success: true, message: 'Messages acknowledged and synced to device' });
});
