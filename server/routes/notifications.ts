import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const notifications = db.get('notifications')
    .filter((n) => n.recipientId === viewer.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = notifications.filter((n) => !n.read).length;

  return res.json({ notifications, unreadCount });
});

// POST /api/notifications/:id/read
notificationsRouter.post('/:id/read', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const notifId = req.params.id;
  db.update('notifications', (list) =>
    list.map((n) => (n.id === notifId && n.recipientId === viewer.id ? { ...n, read: true } : n))
  );

  return res.json({ success: true });
});

// POST /api/notifications/read-all
notificationsRouter.post('/read-all', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  db.update('notifications', (list) =>
    list.map((n) => (n.recipientId === viewer.id ? { ...n, read: true } : n))
  );

  return res.json({ success: true });
});
