import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setStoredToken, getStoredToken } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import type { User, UserAvailability } from '../types/index.ts';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  isOnline: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  login: (identifier: string, pass: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  completeRegistration: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  unreadNotifsCount: number;
  refreshNotifications: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateAvailability: (availability: Partial<UserAvailability>) => Promise<void>;
  androidPreview: boolean;
  toggleAndroidPreview: () => void;
  syncOfflineQueue: () => Promise<void>;
  onlineUserIds: Set<string>;
  isUserOnline: (userId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [androidPreview, setAndroidPreview] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('notecircle_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('notecircle_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('notecircle_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Monitor network connectivity for local-first reliability
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const pending = await localDb.getPendingSyncActions();
      for (const item of pending) {
        try {
          if (item.type === 'CREATE_NOTE') {
            await api.createNote(item.payload);
          } else if (item.type === 'SEND_MESSAGE') {
            await api.sendMessage(item.payload.conversationId, item.payload.text, item.payload.encryptedPayload);
          }
          await localDb.removeSyncAction(item.id);
        } catch (err) {
          console.warn('Sync item failed:', err);
        }
      }
    } catch (err) {
      console.error('Offline queue sync error:', err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser || !navigator.onLine) return;
    try {
      const res = await api.getNotifications();
      setUnreadNotifsCount(res.unreadCount);
    } catch {
      // ignore
    }
  }, [currentUser]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getCurrentUser();
      setCurrentUser(res.user);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        // Authenticate with server-side HttpOnly session cookie or in-memory token
        const res = await api.getCurrentUser();
        setCurrentUser(res.user);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 15000);

      // Establish realtime presence and notifications WebSocket
      let ws: WebSocket | null = null;
      let reconnectTimer: any = null;

      function connectWs() {
        if (!currentUser) return;
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const token = getStoredToken();
          const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
          ws = new WebSocket(wsUrl);

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.event === 'presence_update') {
                const { userId, status } = data.payload || {};
                if (userId) {
                  setOnlineUserIds((prev) => {
                    const next = new Set(prev);
                    if (status === 'online') next.add(userId);
                    else next.delete(userId);
                    return next;
                  });
                }
                window.dispatchEvent(new CustomEvent('notecircle:presence_update', { detail: data.payload }));
              } else if (data.event === 'new_message') {
                window.dispatchEvent(new CustomEvent('notecircle:new_message', { detail: data.payload }));
                refreshNotifications();
              } else if (data.event === 'message_deleted') {
                window.dispatchEvent(new CustomEvent('notecircle:message_deleted', { detail: data.payload }));
              } else if (data.event === 'message_reaction') {
                window.dispatchEvent(new CustomEvent('notecircle:message_reaction', { detail: data.payload }));
              } else if (data.event === 'notification') {
                window.dispatchEvent(new CustomEvent('notecircle:notification', { detail: data.payload }));
                refreshNotifications();
              }
            } catch {}
          };

          ws.onclose = () => {
            reconnectTimer = setTimeout(connectWs, 3000);
          };

          ws.onerror = () => {
            try { ws?.close(); } catch {}
          };
        } catch {}
      }

      connectWs();

      return () => {
        clearInterval(interval);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        try { ws?.close(); } catch {}
      };
    }
  }, [currentUser, refreshNotifications]);

  const login = async (identifier: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(identifier, pass);
      setStoredToken(res.token);
      setCurrentUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      setStoredToken(res.token);
      setCurrentUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await api.completeRegistration(data);
      setStoredToken(res.token);
      setCurrentUser(res.user);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      await localDb.clearAllLocalData();
    } catch {}
    setStoredToken(null);
    setCurrentUser(null);
  };

  const updateAvailability = async (availData: Partial<UserAvailability>) => {
    const res = await api.updateAvailability(availData);
    setCurrentUser(res.user);
  };

  const toggleAndroidPreview = () => {
    setAndroidPreview((prev) => !prev);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isOnline,
        isDarkMode,
        toggleDarkMode,
        login,
        register,
        completeRegistration,
        logout,
        unreadNotifsCount,
        refreshNotifications,
        refreshUser,
        updateAvailability,
        androidPreview,
        toggleAndroidPreview,
        syncOfflineQueue,
        onlineUserIds,
        isUserOnline: (uid: string) => onlineUserIds.has(uid)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
