import type { WebSocket } from 'ws';

export interface AuthenticatedClient {
  userId: string;
  deviceId?: string;
  ws: WebSocket;
  lastPing: number;
}

class RealtimeHub {
  private clients = new Map<string, Set<AuthenticatedClient>>();

  public register(userId: string, ws: WebSocket, deviceId?: string): AuthenticatedClient {
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
    return client;
  }

  public unregister(client: AuthenticatedClient): void {
    const userClients = this.clients.get(client.userId);
    if (userClients) {
      userClients.delete(client);
      if (userClients.size === 0) {
        this.clients.delete(client.userId);
      }
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
}

export const realtimeHub = new RealtimeHub();
