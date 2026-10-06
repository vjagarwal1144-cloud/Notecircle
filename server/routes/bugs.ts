import { Router } from 'express';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';
import type { BugReport } from '../../src/types/index.ts';

export const bugsRouter = Router();

// POST /api/bugs
bugsRouter.post('/', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { category, description, errorIdentifier, deviceInfo, screenshot } = req.body;
  if (!category || !description) {
    return res.status(400).json({ error: 'Category and description are required' });
  }

  const newBug: BugReport = {
    id: `bug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: viewer.id,
    username: viewer.username,
    category: category || 'other',
    description: description.trim(),
    errorIdentifier: errorIdentifier || undefined,
    screenshot: screenshot || undefined,
    deviceInfo: deviceInfo || {
      browser: 'Web Browser',
      os: 'Unknown',
      viewport: 'Responsive',
      isAndroidFrame: false
    },
    status: 'SUBMITTED',
    createdAt: new Date().toISOString()
  };

  db.update('bugReports', (reports) => [newBug, ...(reports || [])]);
  db.logAudit(viewer.id, viewer.username, 'BUG_REPORTED', `Reported bug: ${category}`);

  return res.status(201).json({ success: true, bug: newBug });
});

// GET /api/bugs/mine
bugsRouter.get('/mine', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const bugs = (db.get('bugReports') || []).filter((b) => b.userId === viewer.id);
  return res.json({ bugs });
});

// Admin endpoints
// GET /api/admin/bugs
bugsRouter.get('/admin', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer || !viewer.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const bugs = db.get('bugReports') || [];
  return res.json({ bugs });
});

// PUT /api/admin/bugs/:id
bugsRouter.put('/admin/:id', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer || !viewer.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const bugId = req.params.id;
  const { status, resolutionNote } = req.body;

  let updatedBug: BugReport | null = null;
  db.update('bugReports', (reports) =>
    (reports || []).map((b) => {
      if (b.id === bugId) {
        updatedBug = {
          ...b,
          status: status || b.status,
          resolutionNote: resolutionNote !== undefined ? resolutionNote : b.resolutionNote
        };
        return updatedBug;
      }
      return b;
    })
  );

  if (!updatedBug) return res.status(404).json({ error: 'Bug report not found' });
  db.logAudit(viewer.id, viewer.username, 'BUG_RESOLVED', `Updated bug ${bugId} to ${status}`);

  return res.json({ success: true, bug: updatedBug });
});
