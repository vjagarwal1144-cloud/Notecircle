import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MessageSquare, 
  Heart, 
  Send, 
  Trash2, 
  Plus, 
  Bell, 
  Settings, 
  Calendar, 
  MapPin, 
  WifiOff, 
  Wifi, 
  Battery, 
  Signal, 
  Zap, 
  UserCheck 
} from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { Note } from '../types/index.ts';

interface HomeFeedProps {
  onOpenCreateNote: () => void;
  onOpenAvailability?: () => void;
  onOpenChatWithUser?: (userId: string) => void;
  onOpenProfile?: (username: string) => void;
  onNavigate?: (tab: string) => void;
  onOpenNotifications?: () => void;
  onOpenSettings?: () => void;
}

const QUICK_REACTION_EMOJIS = ['❤️', '🔥', '👏', '☕', '🏕️', '💡'];

export const HomeFeed: React.FC<HomeFeedProps> = ({
  onOpenCreateNote,
  onOpenAvailability,
  onOpenChatWithUser,
  onOpenProfile,
  onNavigate,
  onOpenNotifications,
  onOpenSettings
}) => {
  const { currentUser, isOnline, updateAvailability, isUserOnline, unreadNotifsCount } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [myActiveNote, setMyActiveNote] = useState<Note | null>(null);
  const [circleMembers, setCircleMembers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyInput, setReplyInput] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanTime, setNewPlanTime] = useState('');
  const [newPlanLocation, setNewPlanLocation] = useState('');

  const fetchFeed = async () => {
    try {
      if (navigator.onLine) {
        const [feedRes, myRes, circleRes, plansRes, chatRes] = await Promise.all([
          api.getFeed(),
          currentUser ? api.getMyNotes() : Promise.resolve({ activeNotes: [] }),
          currentUser ? api.getCircleStatus() : Promise.resolve({ circleMembers: [] }),
          currentUser ? api.getPlans() : Promise.resolve({ plans: [] }),
          currentUser ? api.getConversations() : Promise.resolve({ conversations: [] })
        ]);

        setNotes(feedRes.notes || []);
        setMyActiveNote(myRes.activeNotes?.[0] || null);
        setCircleMembers(circleRes.circleMembers || []);
        setPlans(plansRes.plans || []);
        setConversations(chatRes.conversations || []);

        for (const n of feedRes.notes || []) {
          await localDb.saveNote(n);
        }
      } else {
        if (currentUser) {
          const cached = await localDb.getNotesByUser(currentUser.id);
          setNotes(cached);
        }
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
      if (myActiveNote?.id === noteId) {
        setMyActiveNote(res.note);
      }
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
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return 'Permanent';
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d left`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const userInitial = (currentUser?.displayName || 'L')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#FBF9F4] dark:bg-[#0E0E14] text-stone-950 dark:text-stone-50 pb-28 sm:pb-16 font-sans">
      <div className="max-w-md sm:max-w-xl mx-auto px-4 sm:px-6 pt-3 space-y-4">
        {/* Offline Alert */}
        {!isOnline && (
          <div className="p-2.5 bg-[#FFC72C] border-2.5 border-black rounded-2xl flex items-center gap-2 text-xs font-black text-black shadow-[3px_3px_0px_#000]">
            <WifiOff className="w-4 h-4 text-black shrink-0" />
            <span>Offline: Notes and messages cached locally.</span>
          </div>
        )}

        {/* Main Header matching reference image */}
        <div className="flex items-start justify-between pt-1">
          <div>
            <h1 
              className="text-4xl sm:text-5xl font-black text-black dark:text-white tracking-tight font-display select-none leading-none"
              style={{
                textShadow: '3.5px 3.5px 0px #FFC72C'
              }}
            >
              NoteCircle
            </h1>
            <h2 className="text-2xl sm:text-3xl font-black text-black dark:text-white font-display mt-1.5 leading-none">
              Home
            </h2>
          </div>

          {/* Top Right: Double-Ringed Avatar & Neo-Brutalist Bell & Settings Button */}
          <div className="flex items-center gap-2 pt-1">
            {/* Double-Ring Avatar */}
            <button
              onClick={() => onNavigate?.('profile')}
              className="w-11 h-11 rounded-full border-3 border-black p-0.5 bg-[#FFC72C] flex items-center justify-center font-black text-black text-base shadow-[2px_2px_0px_#000] cursor-pointer hover:scale-105 transition-transform"
              title="My Profile"
            >
              <div className="w-full h-full rounded-full border-2 border-black flex items-center justify-center bg-[#FFC72C]">
                {userInitial}
              </div>
            </button>

            {/* Angular Neo-Brutalist Bell with '1' badge */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2.5 bg-white dark:bg-[#1A1A24] border-2.5 border-black rounded-xl shadow-[2.5px_2.5px_0px_#000] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-transform"
              title="Notifications"
            >
              <Bell className="w-5 h-5 fill-black dark:fill-white stroke-black dark:stroke-white stroke-1" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FFC72C] border-2 border-black rounded-full text-[10px] font-black text-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                {unreadNotifsCount > 0 ? unreadNotifsCount : 1}
              </span>
            </button>

            {/* Prominent Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2.5 bg-white dark:bg-[#1A1A24] border-2.5 border-black rounded-xl shadow-[2.5px_2.5px_0px_#000] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-transform"
              title="Settings & Privacy"
            >
              <Settings className="w-5 h-5 stroke-[2.5] text-black dark:text-white" />
            </button>
          </div>
        </div>

        {/* Pill Navigation Buttons under Home */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          <button
            onClick={() => onNavigate?.('notes')}
            className="px-4 sm:px-5 py-2 rounded-full bg-[#7eedb4] dark:bg-[#5cd499] text-black font-black text-xs sm:text-sm border-2.5 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer hover:brightness-105"
          >
            My Notes
          </button>

          <button
            onClick={() => onNavigate?.('chat')}
            className="px-4 sm:px-5 py-2 rounded-full bg-[#4353ff] dark:bg-[#3243f0] text-black dark:text-white font-black text-xs sm:text-sm border-2.5 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer hover:brightness-105"
          >
            Messages
          </button>

          <button
            onClick={() => onNavigate?.('connections')}
            className="px-4 sm:px-5 py-2 rounded-full bg-[#ff6969] dark:bg-[#fa5555] text-black font-black text-xs sm:text-sm border-2.5 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer hover:brightness-105"
          >
            Circles
          </button>

          <button
            onClick={onOpenSettings}
            className="px-4 sm:px-5 py-2 rounded-full bg-[#FFC72C] dark:bg-[#e6b01e] text-black font-black text-xs sm:text-sm border-2.5 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer hover:brightness-105"
          >
            Settings
          </button>
        </div>

        {/* Section Divider Line */}
        <div className="border-t-2.5 border-black/80 dark:border-white/20 pt-1" />

        {/* Active People Section */}
        {(() => {
          const activeCircleMembers = circleMembers.filter((m) => m.isOnline || isUserOnline(m.id));
          return (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-black text-black dark:text-white font-display">
                  Active People <span className="font-bold text-xs opacity-80">({activeCircleMembers.length} active)</span>
                </h3>
                {currentUser?.availability && (
                  <button
                    onClick={onOpenAvailability}
                    className="text-[11px] font-black underline cursor-pointer hover:text-amber-600"
                  >
                    My Vibe: {currentUser.availability.emoji} {currentUser.availability.label}
                  </button>
                )}
              </div>

              {activeCircleMembers.length > 0 ? (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
                  {activeCircleMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => onOpenProfile?.(member.username)}
                      className="flex items-center shrink-0 cursor-pointer group active:scale-95 transition-transform"
                    >
                      <div className="relative z-10">
                        <div className="w-11 h-11 rounded-full bg-[#FFC72C] text-black border-2.5 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#000]">
                          {(member.displayName || 'U')[0].toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#4ade80] rounded-full border-2 border-black" />
                      </div>
                      <div className="-ml-2 pl-3 pr-2.5 py-0.5 bg-[#7eedb4] text-black font-black text-[11px] rounded-r-full border-2 border-black border-l-0 shadow-[2px_2px_0px_#000]">
                        {member.availability?.emoji || 'online'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-white dark:bg-[#161622] rounded-2xl border-2.5 border-black shadow-[3px_3px_0px_#000] text-center">
                  <p className="text-xs font-black text-stone-900 dark:text-stone-100">No active people yet</p>
                  <p className="text-[11px] font-bold text-stone-500 mt-0.5">When connections in your circle come online or post a vibe, they'll appear here.</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Massive Tilted "Create Note +" Banner */}
        <div className="pt-1">
          <div
            onClick={onOpenCreateNote}
            className="w-full bg-[#101014] text-white border-3 border-black rounded-2xl py-3 px-5 sm:px-6 shadow-[5px_5px_0px_#000] -rotate-1 hover:rotate-0 transition-transform cursor-pointer flex items-center justify-between group active:scale-[0.99]"
          >
            <span className="font-display font-black text-3xl sm:text-4xl tracking-tight text-white select-none">
              Create Note
            </span>
            <span className="font-display font-black text-3xl sm:text-4xl text-white group-hover:scale-125 transition-transform">
              +
            </span>
          </div>

          {/* Big Black Arrow pointing down towards note cards */}
          <div className="flex justify-end pr-8 -mt-2 -mb-2 pointer-events-none select-none">
            <svg 
              className="w-10 h-10 text-black dark:text-white fill-current transform rotate-[-20deg]" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>

        {/* Real Note Cards Grid */}
        <div className="pt-1">
          {notes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {notes.map((note, idx) => {
                const collars = [
                  { name: note.categoryLabel || 'Circle', bg: 'bg-[#ff6969] text-black' },
                  { name: note.categoryLabel || 'Vibe', bg: 'bg-[#9faaff] text-black' },
                  { name: note.categoryLabel || 'Notes', bg: 'bg-[#7eedb4] text-black' },
                  { name: note.categoryLabel || 'Idea', bg: 'bg-[#4353ff] text-white' }
                ];
                const collar = collars[idx % collars.length];
                const isMine = currentUser && note.userId === currentUser.id;

                return (
                  <div 
                    key={note.id}
                    className="border-3 border-black rounded-2xl bg-[#FFC72C] shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className={`${collar.bg} font-black text-xs px-3 py-1.5 border-b-2.5 border-black flex items-center justify-between`}>
                        <span className="truncate max-w-[90px]">{note.emoji} {collar.name}</span>
                        {isMine && (
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-stone-900 hover:text-rose-700 cursor-pointer"
                            title="Delete note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="p-3 text-black space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-black">@{note.author?.username || 'circle'}</span>
                          <span className="text-[9px] font-bold opacity-75">{formatExpiration(note.expiresAt)}</span>
                        </div>
                        <p className="text-[11px] sm:text-xs font-bold leading-tight line-clamp-3">
                          "{note.text}"
                        </p>
                      </div>
                    </div>

                    <div className="p-3 pt-0 space-y-2">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-1 border-t-1.5 border-black/20">
                        {QUICK_REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(note.id, emoji)}
                            className="px-1.5 py-0.5 rounded-md bg-white/70 border border-black text-[10px] font-black hover:bg-white active:scale-95 cursor-pointer shrink-0"
                          >
                            {emoji} {note.reactions?.find(r => r.emoji === emoji) ? '•' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 bg-white dark:bg-[#161622] rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] text-center space-y-2">
              <p className="text-sm font-black text-black dark:text-white font-display">No notes yet</p>
              <p className="text-xs font-bold text-stone-600 dark:text-stone-300">Post an ephemeral note to share with your trusted circle.</p>
              <button
                onClick={onOpenCreateNote}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-400 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-amber-300"
              >
                + Create Your First Note
              </button>
            </div>
          )}
        </div>

        {/* Chat Preview Section */}
        <div className="space-y-2.5 pt-2">
          <h3 className="text-base sm:text-lg font-black text-black dark:text-white font-display">
            Chat Preview
          </h3>

          {conversations.length > 0 ? (
            <div className="border-3 border-black rounded-2xl bg-white dark:bg-[#161622] divide-y-2.5 divide-black shadow-[4px_4px_0px_#000] overflow-hidden">
              {conversations.slice(0, 4).map((conv) => {
                const other = conv.participants?.find((p: any) => p.id !== currentUser?.id) || conv.participants?.[0];
                const lastMsg = conv.lastMessage?.text || 'Encrypted conversation';
                return (
                  <div
                    key={conv.id}
                    onClick={() => onOpenChatWithUser ? onOpenChatWithUser(other?.id) : onNavigate?.('chat')}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F9F8F3] dark:hover:bg-[#1E1E2C] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-[#7eedb4] text-black border-2 border-black flex items-center justify-center font-black text-base shadow-[1.5px_1.5px_0px_#000] shrink-0">
                        {(other?.displayName || 'C')[0]}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs sm:text-sm text-black dark:text-white truncate">
                          {conv.title || other?.displayName}
                        </h4>
                        <p className="text-[11px] sm:text-xs font-bold text-stone-600 dark:text-stone-300 truncate mt-0.5">
                          {lastMsg}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 shrink-0">
                      Active
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 bg-white dark:bg-[#161622] rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] text-center space-y-1.5">
              <p className="text-xs font-black text-black dark:text-white font-display">No conversations yet</p>
              <p className="text-[11px] font-bold text-stone-600 dark:text-stone-300">Private messages are end-to-end encrypted in your circle.</p>
              <button
                onClick={() => onNavigate?.('chat')}
                className="mt-1 px-3.5 py-1.5 rounded-xl bg-amber-400 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
              >
                Start a Private Chat
              </button>
            </div>
          )}
        </div>

        {/* Circle Plans & Meetups Quick Card */}
        <div className="border-3 border-black rounded-2xl bg-white dark:bg-[#161622] p-4 shadow-[4px_4px_0px_#000] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs sm:text-sm text-black dark:text-white uppercase tracking-wider flex items-center gap-2 font-display">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Circle Meetups & Plans</span>
            </h4>
            <button
              onClick={() => setShowCreatePlanModal(true)}
              className="px-2.5 py-1 rounded-xl bg-[#FFC72C] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer"
            >
              + New Plan
            </button>
          </div>

          {plans.length === 0 ? (
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400 italic">
              No plans scheduled yet. Tap '+ New Plan' to propose dinner, games or trips.
            </p>
          ) : (
            <div className="space-y-2">
              {plans.slice(0, 2).map((p) => (
                <div key={p.id} className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border-2 border-black flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-black dark:text-white truncate">{p.title}</p>
                    <p className="text-[10px] font-bold text-stone-500 mt-0.5">{p.scheduledTime} {p.location && `· ${p.location}`}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await api.rsvpPlan(p.id, 'attending');
                      const res = await api.getPlans();
                      setPlans(res.plans);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#7eedb4] text-black border-1.5 border-black cursor-pointer shadow-[1px_1px_0px_#000]"
                  >
                    Going
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

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
                className="px-4 py-2 neo-btn text-xs font-black cursor-pointer"
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
