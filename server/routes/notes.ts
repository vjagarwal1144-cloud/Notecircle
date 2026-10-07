import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';
import { canViewNote, getFeedNotesForUser } from '../privacy.ts';
import type { Note, NoteCategory, PrivacyAudience, AppNotification } from '../../src/types/index.ts';

export const notesRouter = Router();

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  family: 'Family Trip',
  study: 'Study Mode',
  work: 'Focus Session',
  travel: 'Travelling',
  vacation: 'On Vacation',
  gaming: 'Gaming',
  sleep: 'Sleeping',
  dnd: 'Do Not Disturb',
  break: 'Taking a Break',
  custom: 'Personal Note',
  other: 'Other'
};

// GET /api/notes/feed (Circle Feed - only authorized notes)
notesRouter.get('/feed', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  // Release scheduled notes whose schedule time has passed
  const now = Date.now();
  db.update('notes', (list) =>
    (list || []).map((n) => {
      if (n.status === 'SCHEDULED' && n.scheduledFor && new Date(n.scheduledFor).getTime() <= now) {
        return { ...n, status: 'ACTIVE' as const };
      }
      return n;
    })
  );

  const notes = getFeedNotesForUser(viewer.id);
  return res.json({ notes });
});

// GET /api/notes/mine and GET /api/notes/my-notes (User's own notes: active, scheduled, drafts, history)
const getMyNotesHandler = (req: any, res: any) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const allNotes = db.get('notes') || [];
  const now = Date.now();

  const userNotes = allNotes
    .filter((n) => n.userId === viewer.id && n.status !== 'DELETED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((n) => {
      const isExpired = n.expiresAt ? new Date(n.expiresAt).getTime() <= now : false;
      const isScheduledNow = n.status === 'SCHEDULED' && n.scheduledFor && new Date(n.scheduledFor).getTime() > now;
      return {
        ...n,
        isOwner: true,
        status: isScheduledNow ? ('SCHEDULED' as const) : isExpired ? ('EXPIRED' as const) : n.status,
        isCloseFriendOnly: n.audience === 'close_friends'
      };
    });

  const activeNotes = userNotes.filter((n) => n.status === 'ACTIVE');
  const scheduledNotes = userNotes.filter((n) => n.status === 'SCHEDULED');
  const draftNotes = userNotes.filter((n) => n.status === 'DRAFT');
  const pastNotes = userNotes.filter((n) => n.status === 'EXPIRED');

  return res.json({ notes: activeNotes, activeNotes, scheduledNotes, draftNotes, pastNotes });
};

notesRouter.get('/mine', getMyNotesHandler);
notesRouter.get('/my-notes', getMyNotesHandler);

// GET /api/notes/:id
notesRouter.get('/:id', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const noteId = req.params.id;
  const note = (db.get('notes') || []).find((n) => n.id === noteId);

  if (!note || note.status === 'DELETED') {
    return res.status(404).json({ error: 'Note not found' });
  }

  // Strict privacy enforcement
  if (!canViewNote(viewer.id, note)) {
    return res.status(403).json({ error: 'This note is private and not accessible.' });
  }

  return res.json({
    note: {
      ...note,
      isOwner: note.userId === viewer.id,
      isCloseFriendOnly: note.audience === 'close_friends'
    }
  });
});

// POST /api/notes (Create Note / Schedule / Draft)
notesRouter.post('/', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const {
    text,
    emoji = '💬',
    category = 'custom',
    audience = 'followers',
    selectedUserIds,
    duration = '1_day',
    scheduledFor,
    isDraft = false,
    allowReplies = true,
    allowReactions = true,
    isPinned = false
  } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Note text cannot be empty' });
  }

  const now = Date.now();
  let expiresAt: string | null = null;
  switch (duration) {
    case '1_hour':
      expiresAt = new Date(now + 1 * 60 * 60 * 1000).toISOString();
      break;
    case '3_hours':
      expiresAt = new Date(now + 3 * 60 * 60 * 1000).toISOString();
      break;
    case '6_hours':
      expiresAt = new Date(now + 6 * 60 * 60 * 1000).toISOString();
      break;
    case '12_hours':
      expiresAt = new Date(now + 12 * 60 * 60 * 1000).toISOString();
      break;
    case '1_day':
      expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      break;
    case '3_days':
      expiresAt = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case '1_week':
      expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'never':
      expiresAt = null;
      break;
    default:
      expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }

  const status = isDraft
    ? 'DRAFT'
    : scheduledFor && new Date(scheduledFor).getTime() > now
    ? 'SCHEDULED'
    : 'ACTIVE';

  const categoryKey = (category as NoteCategory) || 'custom';
  const newNote: Note = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: viewer.id,
    author: {
      id: viewer.id,
      username: viewer.username,
      displayName: viewer.displayName,
      avatarUrl: viewer.avatarUrl
    },
    emoji,
    category: categoryKey,
    categoryLabel: CATEGORY_LABELS[categoryKey] || 'Personal Note',
    text: text.trim(),
    audience: audience as PrivacyAudience,
    selectedUserIds: Array.isArray(selectedUserIds) ? selectedUserIds : undefined,
    expiresAt,
    scheduledFor: scheduledFor || null,
    status,
    isPinned: !!isPinned,
    isDraft: !!isDraft,
    allowReplies: !!allowReplies,
    allowReactions: !!allowReactions,
    reactions: [],
    replies: [],
    isOwner: true,
    isCloseFriendOnly: audience === 'close_friends',
    createdAt: new Date().toISOString()
  };

  db.update('notes', (list) => [newNote, ...(list || [])]);
  db.logAudit(viewer.id, viewer.username, 'NOTE_CREATED', `Note ${newNote.id} (${status})`);

  return res.status(201).json({ note: newNote });
});

// PUT /api/notes/:id (Edit Note / Update Audience / Pin)
notesRouter.put('/:id', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const noteId = req.params.id;
  const note = (db.get('notes') || []).find((n) => n.id === noteId);

  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.userId !== viewer.id) return res.status(403).json({ error: 'Unauthorized' });

  const { text, audience, isPinned, allowReplies, allowReactions, status } = req.body;

  let updatedNote: Note = note;
  db.update('notes', (list) =>
    (list || []).map((n) => {
      if (n.id === noteId) {
        updatedNote = {
          ...n,
          text: text !== undefined ? text.trim() : n.text,
          audience: audience !== undefined ? audience : n.audience,
          isPinned: isPinned !== undefined ? !!isPinned : n.isPinned,
          allowReplies: allowReplies !== undefined ? !!allowReplies : n.allowReplies,
          allowReactions: allowReactions !== undefined ? !!allowReactions : n.allowReactions,
          status: status !== undefined ? status : n.status,
          updatedAt: new Date().toISOString()
        };
        return updatedNote;
      }
      return n;
    })
  );

  return res.json({ note: updatedNote });
});

// DELETE /api/notes/:id
notesRouter.delete('/:id', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const noteId = req.params.id;
  const note = (db.get('notes') || []).find((n) => n.id === noteId);

  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.userId !== viewer.id && !viewer.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.update('notes', (list) =>
    (list || []).map((n) => (n.id === noteId ? { ...n, status: 'DELETED' as const } : n))
  );

  db.logAudit(viewer.id, viewer.username, 'NOTE_DELETED', `Deleted note ${noteId}`);
  return res.json({ success: true, message: 'Note deleted' });
});

// POST /api/notes/:id/reaction
notesRouter.post('/:id/reaction', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const noteId = req.params.id;
  const { emoji = '❤️' } = req.body;
  const note = (db.get('notes') || []).find((n) => n.id === noteId);

  if (!note || note.status === 'DELETED') return res.status(404).json({ error: 'Note not found' });
  if (!canViewNote(viewer.id, note)) return res.status(403).json({ error: 'Not authorized' });
  if (!note.allowReactions) return res.status(400).json({ error: 'Reactions are disabled' });

  let updatedNote = note;
  db.update('notes', (list) =>
    (list || []).map((n) => {
      if (n.id === noteId) {
        const existingIdx = n.reactions.findIndex((r) => r.userId === viewer.id && r.emoji === emoji);
        let newReactions = [...n.reactions];

        if (existingIdx >= 0) {
          newReactions.splice(existingIdx, 1);
        } else {
          newReactions.push({
            id: `rx_${Date.now()}`,
            noteId,
            userId: viewer.id,
            username: viewer.username,
            displayName: viewer.displayName,
            emoji,
            createdAt: new Date().toISOString()
          });

          if (note.userId !== viewer.id) {
            const notif: AppNotification = {
              id: `notif_${Date.now()}`,
              recipientId: note.userId,
              senderId: viewer.id,
              senderName: viewer.displayName,
              senderAvatar: viewer.avatarUrl,
              type: 'note_reaction',
              entityId: note.id,
              text: `${viewer.displayName} reacted ${emoji} to your note.`,
              read: false,
              createdAt: new Date().toISOString()
            };
            db.update('notifications', (notifs) => [notif, ...(notifs || [])]);
          }
        }

        updatedNote = { ...n, reactions: newReactions };
        return updatedNote;
      }
      return n;
    })
  );

  return res.json({ note: { ...updatedNote, isOwner: updatedNote.userId === viewer.id } });
});

// POST /api/notes/:id/reply
notesRouter.post('/:id/reply', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const noteId = req.params.id;
  const { text } = req.body;

  if (!text || !text.trim()) return res.status(400).json({ error: 'Reply text cannot be empty' });

  const note = (db.get('notes') || []).find((n) => n.id === noteId);
  if (!note || note.status === 'DELETED') return res.status(404).json({ error: 'Note not found' });
  if (!canViewNote(viewer.id, note)) return res.status(403).json({ error: 'Not authorized' });
  if (!note.allowReplies) return res.status(400).json({ error: 'Replies are disabled' });

  const newReply = {
    id: `rep_${Date.now()}`,
    noteId,
    userId: viewer.id,
    username: viewer.username,
    displayName: viewer.displayName,
    avatarUrl: viewer.avatarUrl,
    text: text.trim(),
    createdAt: new Date().toISOString()
  };

  let updatedNote = note;
  db.update('notes', (list) =>
    (list || []).map((n) => {
      if (n.id === noteId) {
        updatedNote = { ...n, replies: [...n.replies, newReply] };
        return updatedNote;
      }
      return n;
    })
  );

  if (note.userId !== viewer.id) {
    const notif: AppNotification = {
      id: `notif_${Date.now()}`,
      recipientId: note.userId,
      senderId: viewer.id,
      senderName: viewer.displayName,
      senderAvatar: viewer.avatarUrl,
      type: 'note_reply',
      entityId: note.id,
      text: `${viewer.displayName} replied: "${text.trim().substring(0, 50)}"`,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.update('notifications', (notifs) => [notif, ...(notifs || [])]);
  }

  return res.json({ reply: newReply, note: updatedNote });
});
