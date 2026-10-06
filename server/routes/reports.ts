import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';
import type { Report } from '../../src/types/index.ts';

export const reportsRouter = Router();

// POST /api/reports (Submit report)
reportsRouter.post('/', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { targetType, targetId, reason, details } = req.body;
  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: 'targetType, targetId and reason are required' });
  }

  let targetAuthorName = 'Unknown';
  let targetContentPreview = '';

  if (targetType === 'user') {
    const target = db.get('users').find((u) => u.id === targetId);
    if (target) {
      targetAuthorName = target.displayName;
      targetContentPreview = `@${target.username} profile`;
    }
  } else if (targetType === 'note') {
    const note = db.get('notes').find((n) => n.id === targetId);
    if (note) {
      targetAuthorName = note.author.displayName;
      targetContentPreview = `Note: "${note.text.substring(0, 60)}"`;
    }
  } else if (targetType === 'message') {
    const msg = db.get('messages').find((m) => m.id === targetId);
    if (msg) {
      targetAuthorName = msg.senderName;
      targetContentPreview = `Message: "${msg.text.substring(0, 60)}"`;
    }
  }

  const report: Report = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reporterId: viewer.id,
    reporterUsername: viewer.username,
    targetType,
    targetId,
    targetAuthorName,
    targetContentPreview,
    reason,
    details: details?.trim() || undefined,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  db.update('reports', (list) => [report, ...list]);

  return res.status(201).json({ success: true, message: 'Report received. Our moderation team will review it.' });
});

// Admin endpoints
// GET /api/admin/reports
reportsRouter.get('/admin/reports', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer || !viewer.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const reports = db.get('reports');
  return res.json({ reports });
});

// POST /api/admin/reports/:id/action
reportsRouter.post('/admin/reports/:id/action', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer || !viewer.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const reportId = req.params.id;
  const { action, resolutionNote } = req.body;
  // actions: 'suspend_user' | 'delete_content' | 'dismiss' | 'warn'

  const reports = db.get('reports');
  const report = reports.find((r) => r.id === reportId);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  if (action === 'suspend_user') {
    const userIdToSuspend = report.targetType === 'user' ? report.targetId : undefined;
    if (userIdToSuspend) {
      db.update('users', (users) =>
        users.map((u) => (u.id === userIdToSuspend ? { ...u, isSuspended: true } : u))
      );
    }
  } else if (action === 'delete_content') {
    if (report.targetType === 'note') {
      db.update('notes', (notes) =>
        notes.map((n) => (n.id === report.targetId ? { ...n, status: 'DELETED' as const } : n))
      );
    } else if (report.targetType === 'message') {
      db.update('messages', (msgs) =>
        msgs.map((m) => (m.id === report.targetId ? { ...m, isDeleted: true, text: 'This message was removed by moderation.' } : m))
      );
    }
  }

  db.update('reports', (list) =>
    list.map((r) =>
      r.id === reportId
        ? {
            ...r,
            status: action === 'dismiss' ? ('DISMISSED' as const) : ('RESOLVED' as const),
            actionTaken: `${action}: ${resolutionNote || 'Handled by admin'}`
          }
        : r
    )
  );

  return res.json({ success: true, message: `Report ${action} processed` });
});

// GET /api/admin/metrics
reportsRouter.get('/admin/metrics', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer || !viewer.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const users = db.get('users');
  const notes = db.get('notes');
  const connections = db.get('connections');
  const messages = db.get('messages');
  const reports = db.get('reports');

  return res.json({
    metrics: {
      totalUsers: users.length,
      activeNotes: notes.filter((n) => n.status === 'ACTIVE').length,
      acceptedConnections: connections.filter((c) => c.status === 'ACCEPTED').length,
      pendingRequests: connections.filter((c) => c.status === 'PENDING').length,
      totalMessages: messages.length,
      pendingReports: reports.filter((r) => r.status === 'PENDING').length
    }
  });
});
