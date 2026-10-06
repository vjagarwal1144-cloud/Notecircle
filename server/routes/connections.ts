import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';
import { getRedactedProfile } from '../privacy.ts';
import type { Connection, AppNotification } from '../../src/types/index.ts';

export const connectionsRouter = Router();

// GET /api/connections/list (Accepted connections for viewer)
connectionsRouter.get('/list', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const connections = db.get('connections') || [];
  const allUsers = db.get('users') || [];
  
  // Followed users or mutual connections
  const connectedUserIds = connections
    .filter((c) => (c.requesterId === viewer.id || c.targetId === viewer.id) && c.status === 'ACCEPTED')
    .map((c) => (c.requesterId === viewer.id ? c.targetId : c.requesterId));

  const uniqueIds = Array.from(new Set(connectedUserIds));
  const results = uniqueIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is typeof allUsers[0] => !!u)
    .map((target) => getRedactedProfile(viewer.id, target));

  return res.json({ connections: results });
});

// GET /api/connections/pending (Incoming and outgoing follow requests)
connectionsRouter.get('/pending', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const allConnections = db.get('connections');
  const allUsers = db.get('users');

  const incoming = allConnections
    .filter((c) => c.targetId === viewer.id && c.status === 'PENDING')
    .map((c) => {
      const requester = allUsers.find((u) => u.id === c.requesterId);
      return {
        id: c.id,
        requesterId: c.requesterId,
        createdAt: c.createdAt,
        requester: requester ? {
          id: requester.id,
          username: requester.username,
          displayName: requester.displayName,
          avatarUrl: requester.avatarUrl,
          bio: requester.bio
        } : undefined
      };
    });

  const outgoing = allConnections
    .filter((c) => c.requesterId === viewer.id && c.status === 'PENDING')
    .map((c) => {
      const target = allUsers.find((u) => u.id === c.targetId);
      return {
        id: c.id,
        targetId: c.targetId,
        createdAt: c.createdAt,
        target: target ? {
          id: target.id,
          username: target.username,
          displayName: target.displayName,
          avatarUrl: target.avatarUrl
        } : undefined
      };
    });

  return res.json({ incoming, outgoing });
});

// POST /api/connections/request/:targetUserId (Send follow request)
connectionsRouter.post('/request/:targetUserId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const targetUserId = req.params.targetUserId;
  if (viewer.id === targetUserId) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  const targetUser = db.get('users').find((u) => u.id === targetUserId);
  if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

  // Check if blocked
  const blocks = db.get('blocks');
  if (blocks.some((b) => (b.userId === viewer.id && b.blockedUserId === targetUserId) || (b.userId === targetUserId && b.blockedUserId === viewer.id))) {
    return res.status(403).json({ error: 'Unable to connect with this user' });
  }

  const connections = db.get('connections');
  const existing = connections.find(
    (c) => c.requesterId === viewer.id && c.targetId === targetUserId
  );

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Already following this user' });
    }
    if (existing.status === 'PENDING') {
      return res.status(400).json({ error: 'Follow request already pending' });
    }
    // If was rejected, allow re-requesting
    db.update('connections', (list) =>
      list.map((c) => (c.id === existing.id ? { ...c, status: 'PENDING', updatedAt: new Date().toISOString() } : c))
    );
  } else {
    const newConn: Connection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requesterId: viewer.id,
      targetId: targetUserId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.update('connections', (list) => [...list, newConn]);
  }

  // Create notification for target user
  const notif: AppNotification = {
    id: `notif_${Date.now()}`,
    recipientId: targetUserId,
    senderId: viewer.id,
    senderName: viewer.displayName,
    senderAvatar: viewer.avatarUrl,
    type: 'follow_request',
    entityId: viewer.id,
    text: `${viewer.displayName} (@${viewer.username}) requested to follow you.`,
    read: false,
    createdAt: new Date().toISOString()
  };
  db.update('notifications', (list) => [notif, ...list]);

  return res.json({ success: true, message: 'Follow request sent' });
});

// POST /api/connections/requests/:requestId/accept
connectionsRouter.post('/requests/:requestId/accept', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const requestId = req.params.requestId;
  const connections = db.get('connections');
  const conn = connections.find((c) => c.id === requestId && c.targetId === viewer.id);

  if (!conn) {
    return res.status(404).json({ error: 'Follow request not found' });
  }

  db.update('connections', (list) =>
    list.map((c) => (c.id === requestId ? { ...c, status: 'ACCEPTED', updatedAt: new Date().toISOString() } : c))
  );

  // Send acceptance notification to requester
  const notif: AppNotification = {
    id: `notif_${Date.now()}`,
    recipientId: conn.requesterId,
    senderId: viewer.id,
    senderName: viewer.displayName,
    senderAvatar: viewer.avatarUrl,
    type: 'follow_accept',
    entityId: viewer.id,
    text: `${viewer.displayName} accepted your follow request.`,
    read: false,
    createdAt: new Date().toISOString()
  };
  db.update('notifications', (list) => [notif, ...list]);

  return res.json({ success: true, message: 'Request accepted' });
});

// POST /api/connections/requests/:requestId/reject
connectionsRouter.post('/requests/:requestId/reject', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const requestId = req.params.requestId;
  db.update('connections', (list) =>
    list.map((c) =>
      c.id === requestId && c.targetId === viewer.id
        ? { ...c, status: 'REJECTED', updatedAt: new Date().toISOString() }
        : c
    )
  );

  return res.json({ success: true, message: 'Request rejected' });
});

// DELETE /api/connections/following/:targetUserId (Unfollow)
connectionsRouter.delete('/following/:targetUserId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const targetUserId = req.params.targetUserId;
  db.update('connections', (list) =>
    list.filter((c) => !(c.requesterId === viewer.id && c.targetId === targetUserId))
  );

  return res.json({ success: true, message: 'Unfollowed' });
});

// DELETE /api/connections/followers/:followerId (Remove follower)
connectionsRouter.delete('/followers/:followerId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const followerId = req.params.followerId;
  db.update('connections', (list) =>
    list.filter((c) => !(c.requesterId === followerId && c.targetId === viewer.id))
  );
  // Also remove from close friends if present
  db.update('closeFriends', (list) =>
    list.filter((cf) => !(cf.userId === viewer.id && cf.friendId === followerId))
  );

  return res.json({ success: true, message: 'Follower removed' });
});

// GET /api/connections/close-friends (List close friends)
connectionsRouter.get('/close-friends', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const closeFriends = db.get('closeFriends').filter((cf) => cf.userId === viewer.id);
  const allUsers = db.get('users');

  const friends = closeFriends.map((cf) => {
    const friend = allUsers.find((u) => u.id === cf.friendId);
    return {
      id: cf.id,
      friendId: cf.friendId,
      createdAt: cf.createdAt,
      friend: friend ? {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl
      } : undefined
    };
  }).filter((cf) => !!cf.friend);

  return res.json({ closeFriends: friends });
});

// POST /api/connections/close-friends/:friendId (Toggle Close Friend)
connectionsRouter.post('/close-friends/:friendId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const friendId = req.params.friendId;
  const current = db.get('closeFriends');
  const exists = current.find((cf) => cf.userId === viewer.id && cf.friendId === friendId);

  if (exists) {
    db.update('closeFriends', (list) => list.filter((cf) => cf.id !== exists.id));
    return res.json({ success: true, isCloseFriend: false });
  } else {
    const newEntry = {
      id: `cf_${Date.now()}`,
      userId: viewer.id,
      friendId,
      createdAt: new Date().toISOString()
    };
    db.update('closeFriends', (list) => [...list, newEntry]);
    return res.json({ success: true, isCloseFriend: true });
  }
});

// POST /api/connections/block/:userId
connectionsRouter.post('/block/:userId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const blockedUserId = req.params.userId;
  if (viewer.id === blockedUserId) return res.status(400).json({ error: 'Cannot block yourself' });

  // Add block
  const blocks = db.get('blocks');
  if (!blocks.some((b) => b.userId === viewer.id && b.blockedUserId === blockedUserId)) {
    db.update('blocks', (list) => [...list, { id: `blk_${Date.now()}`, userId: viewer.id, blockedUserId, createdAt: new Date().toISOString() }]);
  }

  // Sever connections in both directions
  db.update('connections', (list) =>
    list.filter(
      (c) => !( (c.requesterId === viewer.id && c.targetId === blockedUserId) ||
                (c.requesterId === blockedUserId && c.targetId === viewer.id) )
    )
  );

  // Remove close friends
  db.update('closeFriends', (list) =>
    list.filter(
      (cf) => !( (cf.userId === viewer.id && cf.friendId === blockedUserId) ||
                 (cf.userId === blockedUserId && cf.friendId === viewer.id) )
    )
  );

  return res.json({ success: true, message: 'User blocked' });
});

// POST /api/connections/unblock/:userId
connectionsRouter.post('/unblock/:userId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const targetId = req.params.userId;
  db.update('blocks', (list) => list.filter((b) => !(b.userId === viewer.id && b.blockedUserId === targetId)));

  return res.json({ success: true, message: 'User unblocked' });
});

// POST /api/connections/mute/:userId
connectionsRouter.post('/mute/:userId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const targetId = req.params.userId;
  const mutes = db.get('mutes');
  const existing = mutes.find((m) => m.userId === viewer.id && m.mutedUserId === targetId);

  if (existing) {
    db.update('mutes', (list) => list.filter((m) => m.id !== existing.id));
    return res.json({ success: true, isMuted: false });
  } else {
    db.update('mutes', (list) => [...list, { id: `mute_${Date.now()}`, userId: viewer.id, mutedUserId: targetId, createdAt: new Date().toISOString() }]);
    return res.json({ success: true, isMuted: true });
  }
});
