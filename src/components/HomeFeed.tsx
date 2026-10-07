import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MessageSquare, 
  Heart, 
  Send, 
  MoreHorizontal, 
  VolumeX, 
  Trash2, 
  Lock, 
  MessageCircle, 
  Plus, 
  Moon, 
  Sparkles, 
  Edit2, 
  Check, 
  Shield, 
  WifiOff, 
  UserCheck,
  Calendar,
  Zap,
  MapPin
} from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import type { Note } from '../types/index.ts';

interface HomeFeedProps {
  onOpenCreateNote: () => void;
  onOpenAvailability?: () => void;
  onOpenChatWithUser?: (userId: string) => void;
  onOpenProfile?: (username: string) => void;
}

const QUICK_REACTION_EMOJIS = ['❤️', '👏', '☕', '🏕️', '🔥', '🫂', '📚'];

export const HomeFeed: React.FC<HomeFeedProps> = ({
  onOpenCreateNote,
  onOpenAvailability,
  onOpenChatWithUser,
  onOpenProfile
}) => {
  const { currentUser, isOnline, updateAvailability, isUserOnline } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [myActiveNote, setMyActiveNote] = useState<Note | null>(null);
  const [circleMembers, setCircleMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'close_friends'>('all');
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyInput, setReplyInput] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanTime, setNewPlanTime] = useState('');
  const [newPlanLocation, setNewPlanLocation] = useState('');

  const fetchFeed = async () => {
    try {
      if (navigator.onLine) {
        const res = await api.getFeed();
        setNotes(res.notes);
        // Cache feed notes in local DB
        for (const n of res.notes) {
          await localDb.saveNote(n);
        }
      } else {
        // Offline: load from local DB
        if (currentUser) {
          const cached = await localDb.getNotesByUser(currentUser.id);
          setNotes(cached);
        }
      }

      // Check current user's active note
      if (currentUser) {
        const myRes = await api.getMyNotes();
        setMyActiveNote(myRes.activeNotes[0] || null);

        // Fetch Live Circle & Plans
        try {
          const [circleRes, plansRes] = await Promise.all([
            api.getCircleStatus(),
            api.getPlans()
          ]);
          setCircleMembers(circleRes.circleMembers || []);
          setPlans(plansRes.plans || []);
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [currentUser, isOnline]);

  useEffect(() => {
    const handlePresenceUpdate = (e: any) => {
      const { userId, status } = e.detail || {};
      if (!userId) return;
      setCircleMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, isOnline: status === 'online' } : m))
      );
    };

    const handleNoteCreated = () => {
      fetchFeed();
    };

    window.addEventListener('notecircle:presence_update', handlePresenceUpdate);
    window.addEventListener('notecircle:note_created', handleNoteCreated);
    return () => {
      window.removeEventListener('notecircle:presence_update', handlePresenceUpdate);
      window.removeEventListener('notecircle:note_created', handleNoteCreated);
    };
  }, []);

  const handleToggleReaction = async (noteId: string, emoji: string) => {
    try {
      const res = await api.toggleReaction(noteId, emoji);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? res.note : n)));
      await localDb.saveNote(res.note);
    } catch (err: any) {
      alert(err.message || 'Failed to update reaction');
    }
  };

  const handleSendReply = async (noteId: string) => {
    const text = (replyInput[noteId] || '').trim();
    if (!text) return;

    setSubmittingReply((prev) => ({ ...prev, [noteId]: true }));
    try {
      const res = await api.addReply(noteId, text);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? res.note : n)));
      setReplyInput((prev) => ({ ...prev, [noteId]: '' }));
      await localDb.saveNote(res.note);
    } catch (err: any) {
      alert(err.message || 'Failed to post reply');
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [noteId]: false }));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note? It will disappear from your circle.')) return;
    try {
      await api.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (myActiveNote?.id === noteId) setMyActiveNote(null);
      await localDb.deleteNote(noteId);
      setActiveMenuNoteId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleMuteAuthor = async (authorId: string) => {
    try {
      await api.toggleMute(authorId);
      await fetchFeed();
      setActiveMenuNoteId(null);
      alert('Author muted from your feed.');
    } catch (err: any) {
      alert(err.message || 'Failed to mute');
    }
  };

  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return 'Permanent';
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (hours < 1) return 'Expires soon';
    if (hours === 1) return 'Expires in 1h';
    if (hours < 24) return `Expires in ${hours}h`;
    const days = Math.round(hours / 24);
    return `Expires in ${days}d`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const displayedNotes = notes.filter((n) => {
    if (filterMode === 'close_friends') {
      return n.audience === 'close_friends';
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-3.5 sm:px-4 py-5 space-y-6">
      
      {/* Offline Alert */}
      {!isOnline && (
        <div className="p-3 bg-amber-300 border-2.5 border-stone-900 rounded-2xl flex items-center gap-2.5 text-xs font-black text-stone-950 shadow-[3px_3px_0px_0px_#121217]">
          <WifiOff className="w-4 h-4 text-stone-950 shrink-0" />
          <span>Offline Mode: Notes cached locally. Everything will sync when back online.</span>
        </div>
      )}

      {/* Top Section: Neo-Brutalist Collar Card for Your Status & Your Active Note */}
      <div className="neo-card overflow-hidden bg-white dark:bg-[#161622] transition-all">
        
        {/* Card Collar Header */}
        <div className="bg-amber-400 dark:bg-amber-400/90 border-b-2.5 border-stone-900 px-4 sm:px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-950 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-stone-950">Circle Signal · Live Radar</span>
          </div>
          <button
            onClick={onOpenAvailability}
            className="text-[11px] font-black uppercase text-stone-950 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Tune Status</span>
            <span className="text-xs">↗</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Availability Status Header */}
          <div className="flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-800 pb-3.5">
            <div 
              onClick={onOpenAvailability}
              className="flex items-center gap-3 cursor-pointer group"
              title="Click to tune your availability status"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border-2 border-stone-900 dark:border-stone-700 flex items-center justify-center text-2xl select-none shadow-[2px_2px_0px_0px_#121217] dark:shadow-[2px_2px_0px_0px_#000] group-hover:rotate-6 transition-transform">
                {currentUser?.availability?.emoji || '🟢'}
              </div>
              <div>
                <p className="text-sm font-black text-stone-950 dark:text-stone-50 flex items-center gap-2">
                  <span>{currentUser?.availability?.label || 'Available'}</span>
                  {currentUser?.availability?.code === 'other' && (
                    <span className="text-[9.5px] bg-amber-400 text-stone-950 border border-stone-900 font-black px-1.5 py-0.5 rounded-md uppercase">
                      Other
                    </span>
                  )}
                  {currentUser?.availability?.strictDnd && (
                    <span className="text-[9.5px] bg-rose-500 text-white border border-stone-900 font-black px-1.5 py-0.5 rounded-md uppercase">
                      Strict DND
                    </span>
                  )}
                </p>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 truncate max-w-[240px] sm:max-w-[320px] mt-0.5">
                  {currentUser?.availability?.customStatus || 'Tap to let your people know your current vibe'}
                </p>
              </div>
            </div>

            <button
              onClick={onOpenAvailability}
              className="px-3.5 py-1.5 neo-btn text-xs font-black text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] hover:bg-amber-100 whitespace-nowrap cursor-pointer"
            >
              Update
            </button>
          </div>

          {/* Your Current Note Box or Quick Post Input */}
          {myActiveNote ? (
            <div className="p-3.5 sm:p-4 bg-amber-50 dark:bg-[#1F1C16] rounded-2xl border-2 border-stone-900 dark:border-amber-500/80 shadow-[3px_3px_0px_0px_#FF9F1C] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-stone-850 border-2 border-stone-900 text-2xl flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#121217]">
                  {myActiveNote.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-stone-950 dark:text-stone-50">{myActiveNote.categoryLabel}</span>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-950 dark:text-amber-200 bg-amber-300 dark:bg-amber-900/60 border border-stone-900 px-1.5 py-0.2 rounded-md">
                      Your Broadcast
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200 mt-1 line-clamp-2">
                    "{myActiveNote.text}"
                  </p>
                  <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-stone-500 dark:text-stone-400 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatExpiration(myActiveNote.expiresAt)}</span>
                    </span>
                    <span>·</span>
                    <span>{myActiveNote.reactions.length} reactions</span>
                    <span>·</span>
                    <span>{myActiveNote.replies.length} replies</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteNote(myActiveNote.id)}
                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg shrink-0 cursor-pointer"
                title="Delete current note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {currentUser && (
                <UserAvatar name={currentUser.displayName} src={currentUser.avatarUrl} size="md" />
              )}
              <button
                onClick={onOpenCreateNote}
                className="flex-1 text-left px-4 py-3 bg-stone-100 dark:bg-[#1A1A26] hover:bg-white dark:hover:bg-[#222232] rounded-2xl text-xs font-bold text-stone-600 dark:text-stone-400 transition-all border-2 border-stone-900 dark:border-stone-700 shadow-[2px_2px_0px_0px_#121217] dark:shadow-[2px_2px_0px_0px_#050508] cursor-pointer"
              >
                Drop a quick note for your circle...
              </button>
              <button
                onClick={onOpenCreateNote}
                className="p-3 neo-btn-primary rounded-2xl cursor-pointer"
                title="Post note"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
              </button>
            </div>
          )}

          {/* Quick Life Actions (One-Tap Neo Chips) */}
          <div className="pt-2 border-t-2 border-stone-100 dark:border-stone-800 space-y-2">
            <p className="text-[10px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest">
              Instant Vibe Actions
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { emoji: '👋', label: "I'm here", code: 'available' },
                { emoji: '🚗', label: 'On my way', code: 'busy' },
                { emoji: '📞', label: 'Call me', code: 'available' },
                { emoji: '🍕', label: "Let's eat", code: 'available' },
                { emoji: '🎮', label: "Gaming", code: 'available' },
                { emoji: '⛔', label: 'Busy now', code: 'busy', strict: true },
                { emoji: '✨', label: 'Free now', code: 'available' },
                { emoji: '💭', label: 'Other', code: 'other', openModal: true }
              ].map((action, idx) => (
                <button
                  key={idx}
                  onClick={async () => {
                    if ((action as any).openModal && onOpenAvailability) {
                      onOpenAvailability();
                      return;
                    }
                    try {
                      await updateAvailability({
                        code: action.code as any,
                        label: action.label,
                        emoji: action.emoji,
                        strictDnd: !!action.strict
                      });
                    } catch {}
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A1A26] hover:bg-amber-300 dark:hover:bg-amber-400 hover:text-stone-950 border-2 border-stone-900 dark:border-stone-700 text-xs font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_0px_#121217] dark:shadow-[2px_2px_0px_0px_#050508] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                >
                  <span className="text-sm select-none">{action.emoji}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Circle: People & Presence Radar Strip */}
      {circleMembers.length > 0 && (
        <div className="neo-card p-4 sm:p-5 bg-white dark:bg-[#161622] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-stone-950 dark:text-stone-100 flex items-center gap-2 uppercase tracking-wider font-display">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Circle Live Radar</span>
            </h3>
            <span className="text-[11px] font-black text-stone-500 dark:text-stone-400">
              {circleMembers.length} Connections
            </span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
            {circleMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenProfile?.(m.username)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-amber-50 dark:hover:bg-[#1F1F2E] border-2 border-transparent hover:border-stone-900 transition-all shrink-0 w-22 text-center cursor-pointer group"
                title={`${m.displayName}: ${m.activeNote ? m.activeNote.text : (m.availability?.label || 'Available')}`}
              >
                <div className="relative">
                  <div className="border-2 border-stone-900 rounded-full p-0.5 shadow-[2px_2px_0px_0px_#121217] bg-white dark:bg-stone-850 group-hover:rotate-3 transition-transform">
                    <UserAvatar name={m.displayName} src={m.avatarUrl} size="md" isOnline={isUserOnline(m.id)} />
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-xs select-none bg-white dark:bg-[#161622] rounded-full border-1.5 border-stone-900 p-0.5 shadow-[1px_1px_0px_0px_#121217]">
                    {m.availability?.emoji || '🟢'}
                  </span>
                </div>
                <p className="text-[11px] font-black text-stone-950 dark:text-stone-100 truncate w-full">
                  {m.displayName.split(' ')[0]}
                </p>
                <p className="text-[9.5px] font-bold text-stone-500 dark:text-stone-400 truncate w-full">
                  {m.activeNote ? `${m.activeNote.emoji} note` : (m.availability?.label || 'Available')}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circle Plans & Meetups Card */}
      <div className="neo-card p-4 sm:p-5 bg-white dark:bg-[#161622] space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-stone-950 dark:text-stone-100 uppercase tracking-wider flex items-center gap-2 font-display">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Circle Meetups & Plans</span>
          </h3>
          <button
            onClick={() => setShowCreatePlanModal(true)}
            className="px-2.5 py-1 rounded-xl bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217] text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            <span>New Plan</span>
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 italic py-1">
            No upcoming circle plans yet. Tap 'New Plan' to propose dinner, games, or a road trip.
          </p>
        ) : (
          <div className="space-y-2.5">
            {plans.map((p) => {
              const myRsvp = p.rsvps?.find((r: any) => r.userId === currentUser?.id)?.status;
              return (
                <div key={p.id} className="p-3.5 bg-stone-50 dark:bg-[#1D1D2B] rounded-2xl border-2 border-stone-900 dark:border-stone-700 shadow-[2.5px_2.5px_0px_0px_#121217] dark:shadow-[2.5px_2.5px_0px_0px_#050508] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl select-none">{p.emoji || '📅'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-stone-950 dark:text-stone-50 truncate">{p.title}</p>
                      <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2 mt-0.5">
                        <span>{p.scheduledTime}</span>
                        {p.location && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.location}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={async () => {
                        await api.rsvpPlan(p.id, 'attending');
                        const res = await api.getPlans();
                        setPlans(res.plans);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black border-2 border-stone-900 cursor-pointer transition-all ${
                        myRsvp === 'attending'
                          ? 'bg-emerald-400 text-stone-950 shadow-[2px_2px_0px_0px_#121217]'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      Going
                    </button>
                    <button
                      onClick={async () => {
                        await api.rsvpPlan(p.id, 'maybe');
                        const res = await api.getPlans();
                        setPlans(res.plans);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black border-2 border-stone-900 cursor-pointer transition-all ${
                        myRsvp === 'maybe'
                          ? 'bg-amber-400 text-stone-950 shadow-[2px_2px_0px_0px_#121217]'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      Maybe
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Circle Feed Filter Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 p-1 bg-stone-200 dark:bg-[#161622] rounded-2xl border-2 border-stone-900 dark:border-stone-700 shadow-[2px_2px_0px_0px_#121217]">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217]'
                : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 border-2 border-transparent'
            }`}
          >
            All Circle
          </button>
          <button
            onClick={() => setFilterMode('close_friends')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              filterMode === 'close_friends'
                ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217]'
                : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 border-2 border-transparent'
            }`}
          >
            <span>Close Friends</span>
            <span className="text-[9px] bg-rose-500 text-white px-1 py-0.2 rounded font-black">Inner</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs font-black text-stone-600 dark:text-stone-400">
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          <span>Zero-Telemetry Feed</span>
        </div>
      </div>

      {/* Feed Notes Stream */}
      {isLoading ? (
        <div className="space-y-4 py-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse neo-card p-5 bg-white dark:bg-[#161622] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-200 dark:bg-stone-700 rounded-2xl border-2 border-stone-900" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-28 h-3.5 bg-stone-200 dark:bg-stone-700 rounded" />
                  <div className="w-16 h-2 bg-stone-200 dark:bg-stone-700 rounded" />
                </div>
              </div>
              <div className="h-14 bg-stone-100 dark:bg-stone-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : displayedNotes.length === 0 ? (
        <div className="text-center py-16 px-6 neo-card bg-white dark:bg-[#161622] my-4 shadow-[6px_6px_0px_0px_#121217] dark:shadow-[6px_6px_0px_0px_#050508]">
          <div className="w-14 h-14 bg-amber-300 text-stone-950 rounded-2xl border-2.5 border-stone-900 flex items-center justify-center mx-auto mb-3.5 shadow-[3px_3px_0px_0px_#121217]">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-lg font-black text-stone-950 dark:text-stone-50 font-display">Your circle is calm</h3>
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            No active broadcasts. Only your approved connections can share notes with you.
          </p>
          <div className="mt-5">
            <button
              onClick={onOpenCreateNote}
              className="px-5 py-2.5 neo-btn-primary text-xs font-black cursor-pointer"
            >
              Post a Note to Circle
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {displayedNotes.map((note) => {
            const isOwner = note.userId === currentUser?.id;
            const hasUserReacted = (emoji: string) =>
              note.reactions.some((r) => r.userId === currentUser?.id && r.emoji === emoji);

            const reactionCounts = note.reactions.reduce<Record<string, number>>((acc, curr) => {
              acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
              return acc;
            }, {});

            const isRepliesOpen = expandedReplies[note.id] || false;

            return (
              <article
                key={note.id}
                className="neo-card overflow-hidden bg-white dark:bg-[#161622] transition-all hover:translate-y-[-2px] shadow-[5px_5px_0px_0px_#121217] dark:shadow-[5px_5px_0px_0px_#050508]"
              >
                {/* Note Top Collar Ribbon */}
                <div className="bg-stone-100 dark:bg-[#1D1D2B] border-b-2.5 border-stone-900 dark:border-stone-750 px-4 sm:px-5 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base select-none">{note.emoji}</span>
                    <span className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                      {note.categoryLabel}
                    </span>
                    {note.audience === 'close_friends' && (
                      <span className="text-[9px] font-black uppercase bg-rose-500 text-white border border-stone-900 px-1.5 py-0.2 rounded-md">
                        Close Friends Only
                      </span>
                    )}
                    {note.isPinned && (
                      <span className="text-[9px] font-black uppercase bg-amber-400 text-stone-950 border border-stone-900 px-1.5 py-0.2 rounded-md">
                        Pinned
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] font-black text-stone-500 dark:text-stone-400">
                    <Clock className="w-3 h-3 text-stone-500" />
                    <span>{formatExpiration(note.expiresAt)}</span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-3.5">
                  {/* Note Author Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => onOpenProfile?.(note.author.username)}
                        className="cursor-pointer border-2 border-stone-900 rounded-full p-0.5 shadow-[2px_2px_0px_0px_#121217] bg-white dark:bg-stone-850"
                      >
                        <UserAvatar
                          name={note.author.displayName}
                          src={note.author.avatarUrl}
                          size="md"
                          isOnline={isUserOnline(note.author.id)}
                        />
                      </button>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => onOpenProfile?.(note.author.username)}
                            className="text-xs sm:text-sm font-black text-stone-950 dark:text-stone-50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            {note.author.displayName}
                          </button>
                          <span className="text-[11px] font-bold text-stone-400">@{note.author.username}</span>
                          <span aria-hidden="true" className="text-stone-300 dark:text-stone-700">·</span>
                          <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400">{formatRelativeTime(note.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuNoteId(activeMenuNoteId === note.id ? null : note.id)
                        }
                        className="p-1.5 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26]"
                        title="Note options"
                      >
                        <MoreHorizontal className="w-4 h-4 stroke-[2.5]" />
                      </button>

                      {activeMenuNoteId === note.id && (
                        <div 
                          className="absolute right-0 mt-1 w-48 neo-card p-1 z-20 text-xs font-bold text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] shadow-[4px_4px_0px_0px_#121217] animate-in fade-in zoom-in-95 duration-100"
                          onClick={() => setActiveMenuNoteId(null)}
                        >
                          {!isOwner && onOpenChatWithUser && (
                            <button
                              onClick={() => onOpenChatWithUser(note.author.id)}
                              className="w-full text-left px-3 py-2 hover:bg-amber-100 dark:hover:bg-stone-800 rounded-lg flex items-center gap-2 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Message {note.author.displayName.split(' ')[0]}</span>
                            </button>
                          )}
                          {!isOwner && (
                            <button
                              onClick={() => handleMuteAuthor(note.author.id)}
                              className="w-full text-left px-3 py-2 hover:bg-amber-100 dark:hover:bg-stone-800 rounded-lg flex items-center gap-2 cursor-pointer"
                            >
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>Mute author</span>
                            </button>
                          )}
                          {(isOwner || currentUser?.isAdmin) && (
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="w-full text-left px-3 py-2 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete note</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Note Body Text */}
                  <p className="text-sm sm:text-base text-stone-950 dark:text-stone-50 leading-relaxed whitespace-pre-wrap font-bold break-words font-display">
                    {note.text}
                  </p>

                  {/* Reactions and Reply Bar */}
                  <div className="pt-3 border-t-2 border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {note.allowReactions && (
                        <>
                          {Object.entries(reactionCounts).map(([emoji, count]) => {
                            const userHas = hasUserReacted(emoji);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(note.id, emoji)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-black border-2 border-stone-900 flex items-center gap-1.5 transition-all cursor-pointer ${
                                  userHas
                                    ? 'bg-amber-400 text-stone-950 shadow-[2px_2px_0px_0px_#121217]'
                                    : 'bg-white dark:bg-[#1A1A26] text-stone-900 dark:text-stone-100 shadow-[1.5px_1.5px_0px_0px_#121217]'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="tabular-nums">{count}</span>
                              </button>
                            );
                          })}

                          <div className="flex items-center gap-1 ml-0.5">
                            {QUICK_REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(note.id, emoji)}
                                className="w-7 h-7 rounded-lg border border-transparent hover:border-stone-900 hover:bg-amber-200 dark:hover:bg-stone-700 flex items-center justify-center text-sm transition-transform active:scale-125 cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {note.allowReplies && (
                      <button
                        onClick={() =>
                          setExpandedReplies((prev) => ({ ...prev, [note.id]: !prev[note.id] }))
                        }
                        className="text-xs font-black text-stone-700 dark:text-stone-300 hover:text-stone-950 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border-2 border-stone-900 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 shadow-[1.5px_1.5px_0px_0px_#121217] cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{note.replies.length} replies</span>
                      </button>
                    )}
                  </div>

                  {/* Expanded Replies Section */}
                  {isRepliesOpen && note.allowReplies && (
                    <div className="mt-3 pt-3 border-t-2 border-stone-200 dark:border-stone-750 space-y-2.5 bg-stone-50 dark:bg-[#1A1A26] p-3 rounded-2xl border-2 border-stone-900">
                      {note.replies.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {note.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <UserAvatar name={reply.displayName} src={reply.avatarUrl} size="xs" />
                              <div className="flex-1 bg-white dark:bg-stone-850 p-2.5 rounded-xl border-2 border-stone-900 text-xs shadow-[2px_2px_0px_0px_#121217]">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="font-black text-stone-950 dark:text-stone-50">{reply.displayName}</span>
                                  <span className="text-[10px] font-bold text-stone-400">
                                    {formatRelativeTime(reply.createdAt)}
                                  </span>
                                </div>
                                <p className="text-stone-800 dark:text-stone-200 font-medium leading-snug">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-stone-400 text-center py-1">
                          No replies yet. Be the first to reply in private.
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {currentUser && (
                          <UserAvatar name={currentUser.displayName} src={currentUser.avatarUrl} size="xs" />
                        )}
                        <input
                          type="text"
                          value={replyInput[note.id] || ''}
                          onChange={(e) =>
                            setReplyInput((prev) => ({ ...prev, [note.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendReply(note.id);
                          }}
                          placeholder="Write a private reply..."
                          className="flex-1 px-3 py-2 text-xs font-bold neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                        />
                        <button
                          onClick={() => handleSendReply(note.id)}
                          disabled={submittingReply[note.id] || !(replyInput[note.id] || '').trim()}
                          className="p-2 neo-btn-primary disabled:opacity-40 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="neo-card bg-white dark:bg-[#161622] w-full max-w-md p-6 shadow-[8px_8px_0px_0px_#121217] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-stone-950 dark:text-stone-50 flex items-center gap-2 font-display">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>Create Circle Plan</span>
            </h3>

            <div>
              <label className="text-xs font-black text-stone-900 dark:text-stone-100 block mb-1">Plan Title</label>
              <input
                type="text"
                value={newPlanTitle}
                onChange={(e) => setNewPlanTitle(e.target.value)}
                placeholder="e.g. Saturday Dinner, Coorg Trip, Badminton"
                className="w-full text-xs p-3 neo-input text-stone-950 dark:text-stone-100 font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-black text-stone-900 dark:text-stone-100 block mb-1">Date & Time</label>
              <input
                type="text"
                value={newPlanTime}
                onChange={(e) => setNewPlanTime(e.target.value)}
                placeholder="e.g. This Saturday at 7:30 PM"
                className="w-full text-xs p-3 neo-input text-stone-950 dark:text-stone-100 font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-black text-stone-900 dark:text-stone-100 block mb-1">Location (Optional)</label>
              <input
                type="text"
                value={newPlanLocation}
                onChange={(e) => setNewPlanLocation(e.target.value)}
                placeholder="e.g. Olive Beach / Discord"
                className="w-full text-xs p-3 neo-input text-stone-950 dark:text-stone-100 font-bold"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-stone-900 dark:border-stone-750">
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(false)}
                className="px-4 py-2 neo-btn text-xs font-black"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newPlanTitle.trim() || !newPlanTime.trim()}
                onClick={async () => {
                  try {
                    await api.createPlan({
                      title: newPlanTitle.trim(),
                      scheduledTime: newPlanTime.trim(),
                      location: newPlanLocation.trim() || undefined
                    });
                    const res = await api.getPlans();
                    setPlans(res.plans);
                    setShowCreatePlanModal(false);
                    setNewPlanTitle('');
                    setNewPlanTime('');
                    setNewPlanLocation('');
                  } catch (err: any) {
                    alert(err.message || 'Failed to create plan');
                  }
                }}
                className="px-5 py-2 neo-btn-primary disabled:opacity-40 text-xs font-black cursor-pointer"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
