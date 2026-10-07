import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';
import { isApprovedFollower, canViewNote } from '../privacy.ts';

export const featuresRouter = Router();

// GET /api/features/circle-status
// Real-time circle presence with active status and notes for authorized mutuals
featuresRouter.get('/circle-status', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const allConnections = db.get('connections') || [];
  const allUsers = db.get('users') || [];
  const allNotes = db.get('notes') || [];
  const now = Date.now();

  const connectedIds = allConnections
    .filter((c) => (c.requesterId === viewer.id || c.targetId === viewer.id) && c.status === 'ACCEPTED')
    .map((c) => (c.requesterId === viewer.id ? c.targetId : c.requesterId));

  const uniqueIds = Array.from(new Set(connectedIds));

  const circleMembers = uniqueIds.map((id) => {
    const user = allUsers.find((u) => u.id === id);
    if (!user) return null;

    const activeNote = allNotes.find(
      (n) => n.userId === id && n.status === 'ACTIVE' && (!n.expiresAt || new Date(n.expiresAt).getTime() > now)
    );

    // CRITICAL FIX: Prevent note leakage!
    // Check if viewer has explicit permission to see this specific note (audience, close_friends, selected)
    const isAuthorizedForNote = activeNote ? canViewNote(viewer.id, activeNote) : false;

    // Respect user privacy settings for status visibility
    const canSeeStatus = user.privacySettings?.whoCanSeeOnlineStatus !== 'nobody';

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      availability: canSeeStatus ? user.availability : undefined,
      activeNote: isAuthorizedForNote && activeNote ? {
        emoji: activeNote.emoji,
        text: activeNote.text,
        category: activeNote.category,
        categoryLabel: activeNote.categoryLabel
      } : undefined
    };
  }).filter(Boolean);

  return res.json({ circleMembers });
});

// GET /api/features/plans
featuresRouter.get('/plans', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const plans = db.getPlansForUser(viewer.id);
  return res.json({ plans });
});

// POST /api/features/plans
featuresRouter.post('/plans', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { title, emoji = '📅', scheduledTime, location } = req.body;
  if (!title || !scheduledTime) {
    return res.status(400).json({ error: 'Title and scheduled time are required' });
  }

  const newPlan = {
    id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    creatorId: viewer.id,
    title: title.trim(),
    emoji,
    scheduledTime,
    location: location?.trim()
  };

  db.createPlan(newPlan);
  // Creator auto-attends
  db.updatePlanRsvp(newPlan.id, viewer.id, viewer.displayName, 'attending');

  return res.status(201).json({ plan: newPlan });
});

// POST /api/features/plans/:id/rsvp
featuresRouter.post('/plans/:id/rsvp', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { status } = req.body;
  if (!status || !['attending', 'maybe', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Status must be attending, maybe, or declined' });
  }

  const success = db.updatePlanRsvp(req.params.id, viewer.id, viewer.displayName, status as any);
  if (!success) {
    return res.status(403).json({ error: 'You are not authorized to RSVP to this plan' });
  }

  return res.json({ success: true, message: `RSVP updated to ${status}` });
});

// GET /api/features/capsules
featuresRouter.get('/capsules', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const capsules = db.getMemoryCapsules(viewer.id);
  return res.json({ capsules });
});

// POST /api/features/capsules
featuresRouter.post('/capsules', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { title, coverEmoji = '✨', unlockAt, items } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (unlockAt && isNaN(Date.parse(unlockAt))) {
    return res.status(400).json({ error: 'Invalid unlockAt date format' });
  }

  const capsule = {
    id: `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    creatorId: viewer.id,
    title: title.trim(),
    coverEmoji,
    unlockAt: unlockAt || undefined,
    items: Array.isArray(items) ? items : []
  };

  db.createMemoryCapsule(capsule);
  return res.status(201).json({ capsule });
});
