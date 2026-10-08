import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { authRouter } from './server/routes/auth.ts';
import { usersRouter } from './server/routes/users.ts';
import { connectionsRouter } from './server/routes/connections.ts';
import { notesRouter } from './server/routes/notes.ts';
import { chatRouter } from './server/routes/chat.ts';
import { notificationsRouter } from './server/routes/notifications.ts';
import { reportsRouter } from './server/routes/reports.ts';
import { bugsRouter } from './server/routes/bugs.ts';
import { supportRouter } from './server/routes/support.ts';
import { cryptoKeysRouter } from './server/routes/cryptoKeys.ts';
import { adminRouter } from './server/routes/admin.ts';
import { featuresRouter } from './server/routes/features.ts';
import { realtimeHub } from './server/realtime.ts';
import { parseToken, db } from './server/db.ts';
import { checkSupabaseHealth } from './server/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Rate Limiter (sliding window per IP/endpoint)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl || ''}:${ip}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Rate limit exceeded, please retry shortly.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      });
    }

    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  // Production Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure persistent uploads storage directory exists
  const uploadsDir = path.resolve(__dirname, 'data/uploads');
  const avatarsDir = path.resolve(uploadsDir, 'avatars');
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Rate limiters for sensitive endpoints
  const authLimiter = createRateLimiter(60, 60 * 1000); // 60 req/min for auth
  const chatLimiter = createRateLimiter(180, 60 * 1000); // 180 req/min for chat

  // Mount API routers
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/connections', connectionsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/chat', chatLimiter, chatRouter);
  app.use('/api/crypto', cryptoKeysRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/bugs', bugsRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/features', featuresRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'NoteCircle API', time: new Date().toISOString() });
  });

  // Supabase connection health check
  app.get('/api/health/supabase', async (_req, res) => {
    const health = await checkSupabaseHealth();
    return res.status(health.connected ? 200 : 503).json(health);
  });

  // WebSocket Server Setup with authenticated handshake
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: any, req: http.IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host || '127.0.0.1'}`);
    let token = url.searchParams.get('token');
    const deviceId = url.searchParams.get('deviceId') || undefined;

    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      for (const c of cookies) {
        const trimmed = c.trim();
        if (trimmed.startsWith('nc_session_token=')) {
          token = decodeURIComponent(trimmed.substring('nc_session_token='.length));
          break;
        }
      }
    }

    if (!token) {
      ws.close(4001, 'Unauthorized: Token required');
      return;
    }

    const userId = parseToken(token);
    const session = db.getSessionByToken(token);
    if (!userId || !session) {
      ws.close(4001, 'Unauthorized: Invalid session');
      return;
    }

    const client = realtimeHub.register(userId, ws, deviceId);

    ws.on('message', (data: any) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on('close', () => {
      realtimeHub.unregister(client);
    });

    ws.on('error', () => {
      realtimeHub.unregister(client);
    });

    // Send initial handshake acknowledgement
    ws.send(JSON.stringify({
      event: 'connected',
      payload: { userId, status: 'online' },
      timestamp: new Date().toISOString()
    }));
  });

  // Vite integration
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`NoteCircle full-stack server running with WebSocket on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
