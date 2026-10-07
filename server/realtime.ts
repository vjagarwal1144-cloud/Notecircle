import type { WebSocket } from 'ws';
import { db } from './db.ts';

export interface AuthenticatedClient {
  userId: string;
  deviceId?: string;
  ws: WebSocket;
  lastPing: number;
}

class RealtimeHub {
  private clients = new Map<string, Set<AuthenticatedClient>>();

  constructor() {
    this.startHeartbeat();
  }

  public register(userId: string, ws: WebSocket, deviceId?: string): AuthenticatedClient {
    const wasOnline = this.isUserOnline(userId);
    const client: AuthenticatedClient = {
      userId,
      deviceId,
      ws,
      lastPing: Date.now()
    };

    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(client);

    // If transitioned from offline to online, broadcast to mutual circle
    if (!wasOnline) {
      this.broadcastPresence(userId, 'online');
    }

    return client;
  }

  public unregister(client: AuthenticatedClient): void {
    const userClients = this.clients.get(client.userId);
    if (userClients) {
      userClients.delete(client);
      if (userClients.size === 0) {
        this.clients.delete(client.userId);
        // User has disconnected all sessions -> broadcast offline
        this.broadcastPresence(client.userId, 'offline');
      }
    }
  }

  public broadcastPresence(userId: string, status: 'online' | 'offline'): void {
    try {
      const allConnections = db.get('connections') || [];
      const userConnections = allConnections.filter(
        (c) => (c.requesterId === userId || c.targetId === userId) && c.status === 'ACCEPTED'
      );
      const mutualIds = userConnections.map((c) => (c.requesterId === userId ? c.targetId : c.requesterId));
      if (mutualIds.length > 0) {
        this.broadcastToUsers(mutualIds, 'presence_update', {
          userId,
          status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('Presence broadcast error:', err);
    }
  }

  public sendToUser(userId: string, event: string, payload: any): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    for (const client of userClients) {
      if (client.ws.readyState === 1 /* OPEN */) {
        try {
          client.ws.send(message);
        } catch (err) {
          console.error(`Failed to send WS message to user ${userId}:`, err);
        }
      }
    }
  }

  public broadcastToUsers(userIds: string[], event: string, payload: any): void {
    for (const id of userIds) {
      this.sendToUser(id, event, payload);
    }
  }

  public isUserOnline(userId: string): boolean {
    const userClients = this.clients.get(userId);
    if (!userClients) return false;
    for (const client of userClients) {
      if (client.ws.readyState === 1) return true;
    }
    return false;
  }

  private startHeartbeat(): void {
    setInterval(() => {
      for (const [, clientSet] of this.clients.entries()) {
        for (const client of clientSet) {
          if (client.ws.readyState === 1) {
            try {
              client.ws.ping();
            } catch {
              this.unregister(client);
            }
          } else {
            this.unregister(client);
          }
        }
      }
    }, 30000);
  }
}

export const realtimeHub = new RealtimeHub();
