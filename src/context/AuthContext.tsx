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
  logout: () => Promise<void>;
  switchUser: (username: string) => Promise<void>;
  unreadNotifsCount: number;
  refreshNotifications: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateAvailability: (availability: Partial<UserAvailability>) => Promise<void>;
  androidPreview: boolean;
  toggleAndroidPreview: () => void;
  syncOfflineQueue: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [androidPreview, setAndroidPreview] = useState(false);
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

      const existingToken = getStoredToken();
      const userLoggedOut = localStorage.getItem('notecircle_logged_out') === 'true';

      if (existingToken) {
        try {
          const res = await api.getCurrentUser();
          setCurrentUser(res.user);
        } catch {
          // Token expired or revoked; attempt automatic demo sign-in if not explicitly logged out
          if (!userLoggedOut) {
            try {
              const res = await api.login('rahul', 'password123');
              setStoredToken(res.token);
              setCurrentUser(res.user);
            } catch {
              setStoredToken(null);
              setCurrentUser(null);
            }
          } else {
            setStoredToken(null);
            setCurrentUser(null);
          }
        }
      } else if (!userLoggedOut) {
        // First-time visit: default seamlessly to Rahul Sharma so full circle experience is active
        try {
          const res = await api.login('rahul', 'password123');
          setStoredToken(res.token);
          setCurrentUser(res.user);
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }

      setIsLoading(false);
    }

    init();
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser, refreshNotifications]);

  const login = async (identifier: string, pass: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('notecircle_logged_out');
      const res = await api.login(identifier, pass);
      setStoredToken(res.token);
      setCurrentUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const switchUser = async (username: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('notecircle_logged_out');
      const res = await api.login(username, 'password123');
      setStoredToken(res.token);
      setCurrentUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('notecircle_logged_out');
      const res = await api.register(data);
      setStoredToken(res.token);
      setCurrentUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.setItem('notecircle_logged_out', 'true');
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
        logout,
        switchUser,
        unreadNotifsCount,
        refreshNotifications,
        refreshUser,
        updateAvailability,
        androidPreview,
        toggleAndroidPreview,
        syncOfflineQueue
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
