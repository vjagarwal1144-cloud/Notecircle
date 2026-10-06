import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCheck, Clock, Heart, MessageCircle, UserPlus, MessageSquare } from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import type { AppNotification } from '../types/index.ts';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction?: (notif: AppNotification) => void;
  onOpenChat?: (userId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  const { refreshNotifications } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await api.markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      await refreshNotifications();
    }
    onSelectAction?.(notif);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div 
        className="bg-white dark:bg-[#1C1A18] w-full max-w-md rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-100"
        role="dialog"
      >
        <div className="p-4 px-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100 font-display">Notifications</span>
          </div>

          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800/80">
          {isLoading ? (
            <p className="text-xs text-stone-400 text-center py-8">Loading...</p>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Bell className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
              <p className="text-xs">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 px-5 flex items-start gap-3 transition-colors cursor-pointer ${
                    notif.read ? 'hover:bg-stone-50 dark:hover:bg-stone-850' : 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50/80 dark:hover:bg-amber-950/30'
                  }`}
                >
                  <UserAvatar name={notif.senderName} src={notif.senderAvatar} size="sm" />
                  <div className="flex-1 text-xs">
                    <p className={`text-stone-900 dark:text-stone-100 ${notif.read ? 'font-normal' : 'font-semibold'}`}>
                      {notif.text}
                    </p>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      {new Date(notif.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
