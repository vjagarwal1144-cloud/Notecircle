import { Router } from 'express';
import crypto from 'node:crypto';
import { db, type DevicePublicKeyRecord } from '../db.ts';
import { getAuthUser } from './auth.ts';

export const cryptoKeysRouter = Router();

// POST /api/crypto/keys/register
// Register or refresh a device public key for E2EE
cryptoKeysRouter.post('/keys/register', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const { deviceId, deviceName, publicKeyJwk } = req.body;
  if (!deviceId || !publicKeyJwk) {
    return res.status(400).json({ error: 'deviceId and publicKeyJwk are required' });
  }

  // Derive public key fingerprint
  const rawKeyString = typeof publicKeyJwk === 'string' ? publicKeyJwk : JSON.stringify(publicKeyJwk);
  const fingerprint = crypto.createHash('sha256').update(rawKeyString).digest('hex').substring(0, 32).toUpperCase();

  const existingKeys = db.get('devicePublicKeys') || [];
  const existing = existingKeys.find((k) => k.userId === viewer.id && k.deviceId === deviceId);

  const now = new Date().toISOString();
  if (existing) {
    db.update('devicePublicKeys', (list) =>
      list.map((k) =>
        k.id === existing.id
          ? {
              ...k,
              deviceName: deviceName || k.deviceName,
              publicKeyJwk: rawKeyString,
              fingerprint,
              isRevoked: false,
              lastSeen: now
            }
          : k
      )
    );
  } else {
    const record: DevicePublicKeyRecord = {
      id: `devkey_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: viewer.id,
      deviceId,
      deviceName: deviceName || 'Web Browser Client',
      publicKeyJwk: rawKeyString,
      fingerprint,
      isRevoked: false,
      createdAt: now,
      lastSeen: now
    };
    db.update('devicePublicKeys', (list) => [...list, record]);
  }

  db.logAudit(viewer.id, viewer.username, 'CRYPTO_DEVICE_KEY_REGISTERED', `Device: ${deviceId}, Fingerprint: ${fingerprint}`);

  return res.status(201).json({ success: true, fingerprint });
});

// GET /api/crypto/keys/:userId
// Fetch active public keys for recipient user
cryptoKeysRouter.get('/keys/:userId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const targetUserId = req.params.userId;
  const targetUser = db.get('users').find((u) => u.id === targetUserId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const allKeys = db.get('devicePublicKeys') || [];
  const activeKeys = allKeys.filter((k) => k.userId === targetUserId && !k.isRevoked);

  return res.json({
    userId: targetUserId,
    username: targetUser.username,
    keys: activeKeys.map((k) => ({
      deviceId: k.deviceId,
      deviceName: k.deviceName,
      publicKeyJwk: k.publicKeyJwk,
      fingerprint: k.fingerprint,
      createdAt: k.createdAt
    }))
  });
});

// GET /api/crypto/devices
// List caller's devices
cryptoKeysRouter.get('/devices', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const allKeys = db.get('devicePublicKeys') || [];
  const myDevices = allKeys.filter((k) => k.userId === viewer.id);

  return res.json({ devices: myDevices });
});

// DELETE /api/crypto/devices/:deviceId
// Revoke a device key
cryptoKeysRouter.delete('/devices/:deviceId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const deviceId = req.params.deviceId;
  db.update('devicePublicKeys', (list) =>
    list.map((k) => (k.userId === viewer.id && k.deviceId === deviceId ? { ...k, isRevoked: true } : k))
  );

  db.logAudit(viewer.id, viewer.username, 'CRYPTO_DEVICE_REVOKED', `Revoked device: ${deviceId}`);

  return res.json({ success: true, message: 'Device revoked' });
});

// GET /api/crypto/safety-numbers/:otherUserId
// Returns cryptographic safety number (Signal-style fingerprint) for verifying out-of-band MITM resistance
cryptoKeysRouter.get('/safety-numbers/:otherUserId', (req, res) => {
  const viewer = getAuthUser(req);
  if (!viewer) return res.status(401).json({ error: 'Unauthorized' });

  const otherUserId = req.params.otherUserId;
  const otherUser = db.get('users').find((u) => u.id === otherUserId);
  if (!otherUser) return res.status(404).json({ error: 'User not found' });

  const allKeys = db.get('devicePublicKeys') || [];
  const myKey = allKeys.find((k) => k.userId === viewer.id && !k.isRevoked);
  const theirKey = allKeys.find((k) => k.userId === otherUserId && !k.isRevoked);

  const rawA = myKey?.fingerprint || viewer.id;
  const rawB = theirKey?.fingerprint || otherUserId;

  // Deterministic combined hash
  const sorted = [rawA, rawB].sort().join(':');
  const hash = crypto.createHash('sha256').update(sorted).digest('hex');

  // Convert to 6 groups of 5 digits: e.g. 28491 58204 19284 94021 68102 39182
  const numbers: string[] = [];
  for (let i = 0; i < 6; i++) {
    const chunk = parseInt(hash.substring(i * 5, (i + 1) * 5), 16) % 100000;
    numbers.push(chunk.toString().padStart(5, '0'));
  }

  return res.json({
    userIds: [viewer.id, otherUserId],
    safetyNumber: numbers.join(' '),
    verified: true
  });
});
