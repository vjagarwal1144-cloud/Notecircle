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
  const { currentUser, isOnline, updateAvailability } = useAuth();
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      
      {/* Offline Alert */}
      {!isOnline && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 shadow-xs">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
          <span>You are currently offline. Notes are cached locally and drafts will sync automatically when back online.</span>
        </div>
      )}

      {/* Top Section: Your Status & Your Active Note */}
      <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4">
        
        {/* Availability Status Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl select-none">{currentUser?.availability?.emoji || '🟢'}</span>
            <div>
              <p className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>{currentUser?.availability?.label || 'Available'}</span>
                {currentUser?.availability?.strictDnd && (
                  <span className="text-[9px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold px-1.5 py-0.2 rounded-full">
                    Strict DND
                  </span>
                )}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-[260px]">
                {currentUser?.availability?.customStatus || 'Tap to let your people know your availability'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAvailability}
            className="px-3 py-1.5 rounded-xl neu-button text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-amber-700 whitespace-nowrap"
          >
            Update Status
          </button>
        </div>

        {/* Your Current Note Box or Create Trigger */}
        {myActiveNote ? (
          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <span className="text-2xl shrink-0 select-none mt-0.5">{myActiveNote.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{myActiveNote.categoryLabel}</span>
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-1.5 py-0.2 rounded-full font-semibold">
                    Your Active Note
                  </span>
                </div>
                <p className="text-xs text-stone-700 dark:text-stone-300 mt-0.5 line-clamp-2">"{myActiveNote.text}"</p>
                <div className="flex items-center gap-3 text-[10px] text-stone-400 mt-1">
                  <span>{formatExpiration(myActiveNote.expiresAt)}</span>
                  <span>·</span>
                  <span>{myActiveNote.reactions.length} reactions</span>
                  <span>·</span>
                  <span>{myActiveNote.replies.length} replies</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDeleteNote(myActiveNote.id)}
              className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg shrink-0"
              title="Delete current note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {currentUser && (
              <UserAvatar name={currentUser.displayName} src={currentUser.avatarUrl} size="md" />
            )}
            <button
              onClick={onOpenCreateNote}
              className="flex-1 text-left px-4 py-3 bg-white dark:bg-stone-800/80 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-2xl text-xs text-stone-500 dark:text-stone-400 transition-all border border-stone-200/80 dark:border-stone-700 neu-inset"
            >
              Let your circle know what you're doing today...
            </button>
            <button
              onClick={onOpenCreateNote}
              className="p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Post note"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Life Actions (One-Tap Status / Activity Updates) */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-1.5">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Quick Life Actions</p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { emoji: '👋', label: "I'm here", code: 'available' },
              { emoji: '🚗', label: 'On my way', code: 'busy' },
              { emoji: '📞', label: 'Call me', code: 'available' },
              { emoji: '🍕', label: "Let's eat", code: 'available' },
              { emoji: '🎮', label: "Let's play", code: 'available' },
              { emoji: '⛔', label: 'Busy now', code: 'busy', strict: true },
              { emoji: '✨', label: 'Free now', code: 'available' }
            ].map((action, idx) => (
              <button
                key={idx}
                onClick={async () => {
                  try {
                    await updateAvailability({
                      code: action.code as any,
                      label: action.label,
                      emoji: action.emoji,
                      strictDnd: !!action.strict
                    });
                  } catch {}
                }}
                className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-stone-200/80 dark:border-stone-700/80 text-xs text-stone-700 dark:text-stone-300 flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 font-medium cursor-pointer"
              >
                <span>{action.emoji}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Circle: People & Presence */}
      {circleMembers.length > 0 && (
        <div className="glass-card rounded-3xl p-4 shadow-xs space-y-3 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center gap-1.5 font-display">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Live Circle Status</span>
            </h3>
            <span className="text-[10px] text-stone-400 font-semibold">{circleMembers.length} connected</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {circleMembers.map((m) => (
              <div
                key={m.id}
                onClick={() => onOpenProfile?.(m.username)}
                className="p-2.5 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/60 dark:border-stone-750 flex items-center gap-2 cursor-pointer hover:border-amber-400 transition-colors"
              >
                <div className="relative">
                  <UserAvatar name={m.displayName} src={m.avatarUrl} size="sm" />
                  <span className="absolute -bottom-1 -right-1 text-xs">{m.availability?.emoji || '🟢'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{m.displayName}</p>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                    {m.activeNote ? `"${m.activeNote.text}"` : (m.availability?.label || 'Available')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Circle Plans */}
      <div className="glass-card rounded-3xl p-4 shadow-xs space-y-3 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center gap-1.5 font-display">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Circle Plans</span>
          </h3>
          <button
            onClick={() => setShowCreatePlanModal(true)}
            className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>New Plan</span>
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="text-xs text-stone-400 dark:text-stone-500 italic py-1">
            No upcoming group plans. Tap 'New Plan' to plan dinner, weekend trip or hangout.
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => {
              const myRsvp = p.rsvps?.find((r: any) => r.userId === currentUser?.id)?.status;
              return (
                <div key={p.id} className="p-3 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/60 dark:border-stone-750 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl">{p.emoji || '📅'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{p.title}</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2">
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

                  <div className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        await api.rsvpPlan(p.id, 'attending');
                        const res = await api.getPlans();
                        setPlans(res.plans);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        myRsvp === 'attending'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
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
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        myRsvp === 'maybe'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
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
        <div className="flex items-center gap-1 p-1 neu-inset rounded-xl">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterMode === 'all'
                ? 'neu-button text-amber-900 dark:text-amber-200 font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Your Circle
          </button>
          <button
            onClick={() => setFilterMode('close_friends')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              filterMode === 'close_friends'
                ? 'neu-button text-amber-900 dark:text-amber-200 font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <span>Close Friends</span>
            <span className="text-[9px] bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1 py-0.2 rounded font-bold">Only</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 font-medium">
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>Local-First Private Feed</span>
        </div>
      </div>

      {/* Feed Notes List */}
      {isLoading ? (
        <div className="space-y-4 py-6">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse glass-card p-5 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-200 dark:bg-stone-700 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-28 h-3 bg-stone-200 dark:bg-stone-700 rounded" />
                  <div className="w-16 h-2 bg-stone-200 dark:bg-stone-700 rounded" />
                </div>
              </div>
              <div className="h-10 bg-stone-100 dark:bg-stone-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : displayedNotes.length === 0 ? (
        <div className="text-center py-16 px-6 glass-card rounded-3xl border border-stone-200/80 dark:border-stone-800 my-4 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-200 dark:border-amber-800">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Your circle is quiet</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            Nothing new right now. Only approved connections can share notes with you.
          </p>
          <div className="mt-5">
            <button
              onClick={onOpenCreateNote}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs transition-transform active:scale-98 cursor-pointer"
            >
              Post a note to your circle
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
                className="glass-card glass-card-hover rounded-3xl p-5 shadow-xs border border-slate-200/70"
              >
                {/* Note Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onOpenProfile?.(note.author.username)}
                      className="cursor-pointer"
                    >
                      <UserAvatar
                        name={note.author.displayName}
                        src={note.author.avatarUrl}
                        size="md"
                      />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenProfile?.(note.author.username)}
                          className="text-xs font-bold text-stone-900 dark:text-stone-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                        >
                          {note.author.displayName}
                        </button>
                        <span className="text-[11px] text-stone-400">@{note.author.username}</span>
                        {note.audience === 'close_friends' && (
                          <span className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full font-semibold border border-amber-200 dark:border-amber-800">
                            Close Friends
                          </span>
                        )}
                        {note.isPinned && (
                          <span className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.2 rounded font-semibold">
                            Pinned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                        <span>{formatRelativeTime(note.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1 text-stone-500 font-medium">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {formatExpiration(note.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenuNoteId(activeMenuNoteId === note.id ? null : note.id)
                      }
                      className="p-1.5 rounded-xl neu-button text-stone-400 hover:text-stone-700"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {activeMenuNoteId === note.id && (
                      <div 
                        className="absolute right-0 mt-1 w-44 glass-panel rounded-2xl py-1 z-20 text-xs text-stone-700 dark:text-stone-300 animate-in fade-in zoom-in-95 duration-100"
                        onClick={() => setActiveMenuNoteId(null)}
                      >
                        {!isOwner && onOpenChatWithUser && (
                          <button
                            onClick={() => onOpenChatWithUser(note.author.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center gap-2"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-stone-500" />
                            <span>Message {note.author.displayName.split(' ')[0]}</span>
                          </button>
                        )}
                        {!isOwner && (
                          <button
                            onClick={() => handleMuteAuthor(note.author.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center gap-2"
                          >
                            <VolumeX className="w-3.5 h-3.5 text-stone-500" />
                            <span>Mute this author</span>
                          </button>
                        )}
                        {(isOwner || currentUser?.isAdmin) && (
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete note</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Note Content */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100/80 dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700">
                    <span className="text-base select-none">{note.emoji}</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{note.categoryLabel}</span>
                  </div>

                  <p className="text-sm sm:text-base text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap font-normal">
                    {note.text}
                  </p>
                </div>

                {/* Reactions and Reply Bar */}
                <div className="pt-3 mt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {note.allowReactions && (
                      <>
                        {Object.entries(reactionCounts).map(([emoji, count]) => {
                          const userHas = hasUserReacted(emoji);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(note.id, emoji)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                                userHas
                                  ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-600 shadow-xs'
                                  : 'neu-button text-stone-700 dark:text-stone-300'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="tabular-nums">{count}</span>
                            </button>
                          );
                        })}

                        <div className="flex items-center gap-0.5 ml-1">
                          {QUICK_REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(note.id, emoji)}
                              className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-sm transition-transform active:scale-125"
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
                      className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-semibold px-2 py-1 rounded-lg transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{note.replies.length} replies</span>
                    </button>
                  )}
                </div>

                {/* Expanded Replies */}
                {isRepliesOpen && note.allowReplies && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                    {note.replies.length > 0 ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {note.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <UserAvatar name={reply.displayName} src={reply.avatarUrl} size="xs" />
                            <div className="flex-1 bg-white p-2.5 rounded-2xl border border-slate-200 text-xs">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-slate-900">{reply.displayName}</span>
                                <span className="text-[10px] text-slate-400">
                                  {formatRelativeTime(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-700 leading-snug">{reply.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-1">
                        No replies yet.
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
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-500"
                      />
                      <button
                        onClick={() => handleSendReply(note.id)}
                        disabled={submittingReply[note.id] || !(replyInput[note.id] || '').trim()}
                        className="p-1.5 text-amber-600 hover:text-amber-700 disabled:opacity-40 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1C1A18] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200/80 dark:border-stone-800 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 font-display">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Create Circle Plan</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Plan Title</label>
              <input
                type="text"
                value={newPlanTitle}
                onChange={(e) => setNewPlanTitle(e.target.value)}
                placeholder="e.g. Saturday Dinner, Coorg Trip, Badminton"
                className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Date & Time</label>
              <input
                type="text"
                value={newPlanTime}
                onChange={(e) => setNewPlanTime(e.target.value)}
                placeholder="e.g. This Saturday at 7:30 PM"
                className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Location (Optional)</label>
              <input
                type="text"
                value={newPlanLocation}
                onChange={(e) => setNewPlanLocation(e.target.value)}
                placeholder="e.g. Olive Beach / Discord"
                className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(false)}
                className="px-3.5 py-2 text-xs text-stone-600 dark:text-stone-400"
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
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
