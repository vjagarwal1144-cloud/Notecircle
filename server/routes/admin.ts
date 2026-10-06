import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { db } from '../db.ts';
import { getAuthUser } from './auth.ts';

export const adminRouter = Router();

// Middleware: Admin check
function requireAdmin(req: any, res: any, next: any) {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });
  if (!viewer.isAdmin) return res.status(403).json({ error: 'Admin privileges required' });
  req.viewer = viewer;
  next();
}

// GET /api/admin/metrics
adminRouter.get('/metrics', requireAdmin, (_req, res) => {
  const users = db.get('users') || [];
  const notes = db.get('notes') || [];
  const messages = db.get('messages') || [];
  const reports = db.get('reports') || [];
  const bugReports = db.get('bugReports') || [];
  const connections = db.get('connections') || [];
  const deviceKeys = db.get('devicePublicKeys') || [];

  return res.json({
    metrics: {
      totalUsers: users.length,
      activeUsers: users.filter((u) => !u.isSuspended).length,
      suspendedUsers: users.filter((u) => u.isSuspended).length,
      totalNotes: notes.length,
      activeNotes: notes.filter((n) => n.status === 'ACTIVE').length,
      expiredNotes: notes.filter((n) => n.status === 'EXPIRED').length,
      totalMessages: messages.length,
      totalReports: reports.length,
      pendingReports: reports.filter((r) => r.status === 'PENDING').length,
      totalBugReports: bugReports.length,
      openBugReports: bugReports.filter((b) => b.status !== 'RESOLVED').length,
      totalConnections: connections.length,
      registeredE2EDevices: deviceKeys.filter((k) => !k.isRevoked).length
    }
  });
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', requireAdmin, (_req, res) => {
  const logs = (db.get('auditLogs') || []).slice(0, 100);
  return res.json({ logs });
});

// POST /api/admin/backup
// Creates an atomic SQLite snapshot backup using VACUUM INTO
adminRouter.post('/backup', requireAdmin, (req, res) => {
  const viewer = (req as any).viewer;
  try {
    const backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `notecircle_backup_${timestamp}.db`;
    const targetPath = path.resolve(backupDir, backupFilename);

    db.backupDatabase(targetPath);

    const stats = fs.statSync(targetPath);

    db.logAudit(viewer.id, viewer.username, 'DATABASE_BACKUP_CREATED', `File: ${backupFilename}, Size: ${stats.size} bytes`);

    return res.json({
      success: true,
      backupFile: backupFilename,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Backup failed:', err);
    return res.status(500).json({ error: 'Database backup failed: ' + err.message });
  }
});

// POST /api/admin/backup/verify
// Tests backup restoration integrity by opening the latest backup and verifying schema & row counts
adminRouter.post('/backup/verify', requireAdmin, (req, res) => {
  const viewer = (req as any).viewer;
  try {
    const backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.status(404).json({ error: 'No backups found' });
    }

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db')).sort().reverse();
    if (files.length === 0) {
      return res.status(404).json({ error: 'No backup files found to verify' });
    }

    const latest = files[0];
    const latestPath = path.resolve(backupDir, latest);

    // Open snapshot in read-only mode to verify integrity
    const testDb = new DatabaseSync(latestPath, { readOnly: true });
    const userCount = (testDb.prepare('SELECT count(*) as count FROM users;').get() as any)?.count || 0;
    const noteCount = (testDb.prepare('SELECT count(*) as count FROM notes;').get() as any)?.count || 0;
    const msgCount = (testDb.prepare('SELECT count(*) as count FROM messages;').get() as any)?.count || 0;
    const integrityResult = (testDb.prepare('PRAGMA integrity_check;').get() as any);
    testDb.close();

    db.logAudit(viewer.id, viewer.username, 'DATABASE_BACKUP_VERIFIED', `Verified: ${latest}`);

    return res.json({
      success: true,
      verifiedBackup: latest,
      integrityCheck: integrityResult?.integrity_check || 'ok',
      recordsFound: {
        users: userCount,
        notes: noteCount,
        messages: msgCount
      }
    });
  } catch (err: any) {
    console.error('Backup verification failed:', err);
    return res.status(500).json({ error: 'Backup verification failed: ' + err.message });
  }
});

// POST /api/admin/reset-database (Development only, strictly disallowed in production)
adminRouter.post('/reset-database', requireAdmin, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Database reset tool is strictly disabled in production environments.' });
  }
  const viewer = (req as any).viewer;
  db.resetToDefault();
  db.logAudit(viewer.id, viewer.username, 'DATABASE_RESET', 'Development database reset to clean baseline');
  return res.json({ success: true, message: 'Development database reset to clean baseline' });
});
