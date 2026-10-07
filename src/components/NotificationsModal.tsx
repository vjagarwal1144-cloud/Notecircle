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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl shadow-[6px_6px_0px_#121217] overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
      >
        <div className="p-4 px-5 border-b-2 border-stone-900 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-stone-900 flex items-center justify-center text-stone-950 font-bold shadow-[2px_2px_0px_#121217]">
              <Bell className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">Notifications</span>
          </div>

          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-black flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Mark read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y-2 divide-stone-100 dark:divide-stone-800">
          {isLoading ? (
            <p className="text-xs font-bold text-stone-400 text-center py-8">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Bell className="w-8 h-8 mx-auto mb-2 text-stone-400 stroke-[2.5]" />
              <p className="text-xs font-black text-stone-900 dark:text-stone-100">No notifications yet</p>
              <p className="text-[11px] font-bold text-stone-500 mt-1">You're all caught up!</p>
            </div>
          ) : (
            notifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 px-5 flex items-start gap-3 transition-colors cursor-pointer ${
                    notif.read ? 'hover:bg-stone-50 dark:hover:bg-[#1A1A28]' : 'bg-amber-100/60 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                  }`}
                >
                  <UserAvatar name={notif.senderName} src={notif.senderAvatar} size="sm" />
                  <div className="flex-1 text-xs">
                    <p className={`text-stone-900 dark:text-stone-100 ${notif.read ? 'font-medium' : 'font-black'}`}>
                      {notif.text}
                    </p>
                    <span className="text-[10px] font-bold text-stone-400 mt-0.5 block">
                      {new Date(notif.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {!notif.read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-stone-900 shrink-0 mt-1.5 shadow-xs" />
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
