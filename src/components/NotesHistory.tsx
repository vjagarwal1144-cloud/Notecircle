import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  RotateCcw, 
  Clock, 
  Users, 
  Heart, 
  MessageCircle, 
  Pin,
  Calendar,
  FileEdit,
  Save,
  Check,
  Bookmark,
  Share2,
  Lock,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import type { Note, NoteTemplate } from '../types/index.ts';
import { NeoSelect } from './NeoSelect.tsx';
import { NeoCheckbox } from './NeoCheckbox.tsx';

interface NotesHistoryProps {
  onOpenCreateNote: () => void;
}

export const NotesHistory: React.FC<NotesHistoryProps> = ({ onOpenCreateNote }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'drafts' | 'history' | 'templates' | 'close_friends'>('active');
  
  const [activeNotes, setActiveNotes] = useState<Note[]>([]);
  const [scheduledNotes, setScheduledNotes] = useState<Note[]>([]);
  const [draftNotes, setDraftNotes] = useState<Note[]>([]);
  const [pastNotes, setPastNotes] = useState<Note[]>([]);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [closeFriends, setCloseFriends] = useState<any[]>([]);
  const [allFollowers, setAllFollowers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit note modal state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editText, setEditText] = useState('');
  const [editAudience, setEditAudience] = useState<'followers' | 'close_friends'>('followers');
  const [editPinned, setEditPinned] = useState(false);
  const [editAllowReplies, setEditAllowReplies] = useState(true);
  const [editAllowReactions, setEditAllowReactions] = useState(true);

  // Expanded views for inspection
  const [expandedReactionsNoteId, setExpandedReactionsNoteId] = useState<string | null>(null);
  const [expandedRepliesNoteId, setExpandedRepliesNoteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (navigator.onLine) {
        const notesRes = await api.getMyNotes();
        setActiveNotes(notesRes.activeNotes);
        setScheduledNotes(notesRes.scheduledNotes);
        setDraftNotes(notesRes.draftNotes);
        setPastNotes(notesRes.pastNotes);

        // Save all to device IndexedDB
        const allNotesList = [
          ...notesRes.activeNotes,
          ...notesRes.scheduledNotes,
          ...notesRes.draftNotes,
          ...notesRes.pastNotes
        ];
        for (const n of allNotesList) {
          await localDb.saveNote(n);
        }
      } else if (currentUser) {
        // Fallback to local-first device storage
        const localList = await localDb.getNotesByUser(currentUser.id);
        setActiveNotes(localList.filter((n) => n.status === 'ACTIVE'));
        setScheduledNotes(localList.filter((n) => n.status === 'SCHEDULED'));
        setDraftNotes(localList.filter((n) => n.status === 'DRAFT'));
        setPastNotes(localList.filter((n) => n.status === 'EXPIRED'));
      }

      // Local templates
      const localTmpls = await localDb.getTemplates();
      setTemplates(localTmpls);

      const cfRes = await api.getCloseFriends();
      setCloseFriends(cfRes.closeFriends);

      const connRes = await api.getConnectionsList();
      setAllFollowers(connRes.connections || []);
    } catch (err) {
      console.error('Failed to load notes data, falling back to local database:', err);
      if (currentUser) {
        const localList = await localDb.getNotesByUser(currentUser.id);
        setActiveNotes(localList.filter((n) => n.status === 'ACTIVE'));
        setScheduledNotes(localList.filter((n) => n.status === 'SCHEDULED'));
        setDraftNotes(localList.filter((n) => n.status === 'DRAFT'));
        setPastNotes(localList.filter((n) => n.status === 'EXPIRED'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleDelete = async (noteId: string) => {
    if (!confirm('Permanently delete this note?')) return;
    try {
      await api.deleteNote(noteId);
      await localDb.deleteNote(noteId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      await api.updateNote(note.id, { isPinned: !note.isPinned });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update pin');
    }
  };

  const handleToggleAllowReactions = async (note: Note) => {
    try {
      await api.updateNote(note.id, { allowReactions: !note.allowReactions });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle reactions');
    }
  };

  const handleToggleAllowReplies = async (note: Note) => {
    try {
      await api.updateNote(note.id, { allowReplies: !note.allowReplies });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle replies');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !editText.trim()) return;
    try {
      await api.updateNote(editingNote.id, {
        text: editText.trim(),
        audience: editAudience,
        isPinned: editPinned,
        allowReplies: editAllowReplies,
        allowReactions: editAllowReactions
      });
      setEditingNote(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update note');
    }
  };

  const handlePublishDraft = async (draft: Note) => {
    try {
      await api.updateNote(draft.id, { status: 'ACTIVE' });
      await fetchData();
      alert('Draft note published to your circle!');
    } catch (err: any) {
      alert(err.message || 'Failed to publish draft');
    }
  };

  const handleSaveAsTemplate = async (note: Note) => {
    const tmplName = prompt('Enter a name for this custom template:', note.categoryLabel);
    if (!tmplName) return;

    const newTmpl: NoteTemplate = {
      id: `tmpl_${Date.now()}`,
      name: tmplName.trim(),
      emoji: note.emoji,
      category: note.category,
      text: note.text,
      duration: '1_day',
      audience: note.audience
    };

    await localDb.saveTemplate(newTmpl);
    const tmpls = await localDb.getTemplates();
    setTemplates(tmpls);
    alert('Template saved locally to your device!');
  };

  const handleReuseTemplate = async (tmpl: NoteTemplate) => {
    try {
      await api.createNote({
        text: tmpl.text,
        emoji: tmpl.emoji,
        category: tmpl.category,
        audience: tmpl.audience,
        duration: tmpl.duration
      });
      await fetchData();
      alert(`Note created from template "${tmpl.name}"!`);
      setActiveTab('active');
    } catch (err: any) {
      alert(err.message || 'Failed to post note from template');
    }
  };

  const handleDeleteTemplate = async (tmplId: string) => {
    await localDb.deleteTemplate(tmplId);
    const tmpls = await localDb.getTemplates();
    setTemplates(tmpls);
  };

  const handleToggleCloseFriend = async (userId: string) => {
    try {
      await api.toggleCloseFriend(userId);
      const cfRes = await api.getCloseFriends();
      setCloseFriends(cfRes.closeFriends);
    } catch (err: any) {
      alert(err.message || 'Failed to update Close Friends');
    }
  };

  const handleRepostPastNote = async (note: Note) => {
    try {
      await api.createNote({
        text: note.text,
        emoji: note.emoji,
        category: note.category,
        audience: note.audience,
        duration: '1_day'
      });
      await fetchData();
      alert('Note reposted to your circle for 24 hours!');
      setActiveTab('active');
    } catch (err: any) {
      alert(err.message || 'Failed to repost');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 dark:border-stone-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-display">My Notes Management</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">Local-first note storage, drafts, scheduling, and custom templates</p>
        </div>

        <button
          onClick={onOpenCreateNote}
          className="px-4 py-2 neo-btn-primary text-xs font-black flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>New Note</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 text-xs p-1.5 bg-stone-100 dark:bg-[#12121A] border-2 border-stone-900 dark:border-stone-750 rounded-2xl shadow-[2px_2px_0px_#121217]">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-3.5 py-2 rounded-xl font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'active' 
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' 
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          Active ({activeNotes.length})
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-3.5 py-2 rounded-xl font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'scheduled' 
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' 
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Scheduled ({scheduledNotes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`px-3.5 py-2 rounded-xl font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'drafts' 
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' 
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <FileEdit className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Drafts ({draftNotes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-2 rounded-xl font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'history' 
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' 
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Expired ({pastNotes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-3.5 py-2 rounded-xl font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'templates' 
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' 
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Templates ({templates.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('close_friends')}
          className={`px-3.5 py-2 rounded-xl font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'close_friends' 
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' 
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Inner Circle ({closeFriends.length})</span>
        </button>
      </div>

      {/* Tab 1: Active Notes */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeNotes.length === 0 ? (
            <div className="text-center py-14 neo-card bg-white dark:bg-[#161622] rounded-3xl">
              <p className="text-xs font-bold text-stone-500">You don't have any active notes right now.</p>
              <button
                onClick={onOpenCreateNote}
                className="mt-3 px-4 py-2 neo-btn-primary text-stone-950 text-xs font-black rounded-xl cursor-pointer"
              >
                Create an active note
              </button>
            </div>
          ) : (
            activeNotes.map((note) => (
              <div
                key={note.id}
                className="neo-card bg-white dark:bg-[#161622] rounded-3xl p-5 border-2.5 border-stone-900 shadow-[5px_5px_0px_#121217] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl select-none">{note.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-stone-900 dark:text-stone-100">{note.categoryLabel}</span>
                        {note.isPinned && (
                          <span className="text-[10px] text-stone-950 bg-amber-300 border border-stone-900 px-2 py-0.5 rounded-full font-black">
                            📌 Pinned
                          </span>
                        )}
                        <span className="text-[10px] text-stone-900 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 border border-stone-900 px-2 py-0.5 rounded-full font-bold">
                          {note.audience === 'close_friends' ? '🔒 Inner Circle' : '👥 Circle'}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-stone-400 mt-0.5">
                        Posted {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Expires {note.expiresAt ? new Date(note.expiresAt).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`p-2 rounded-xl neo-btn text-xs bg-white dark:bg-[#1A1A28] ${note.isPinned ? 'text-amber-500 font-bold' : 'text-stone-400'}`}
                      title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                    >
                      <Pin className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingNote(note);
                        setEditText(note.text);
                        setEditAudience(note.audience as any);
                        setEditPinned(!!note.isPinned);
                        setEditAllowReplies(note.allowReplies !== false);
                        setEditAllowReactions(note.allowReactions !== false);
                      }}
                      className="p-2 rounded-xl neo-btn text-stone-700 dark:text-stone-200 bg-white dark:bg-[#1A1A28] text-xs cursor-pointer"
                      title="Edit note"
                    >
                      <FileEdit className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => handleSaveAsTemplate(note)}
                      className="p-2 rounded-xl neo-btn text-stone-700 dark:text-stone-200 bg-white dark:bg-[#1A1A28] text-xs cursor-pointer"
                      title="Save as reusable template"
                    >
                      <Bookmark className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-2 rounded-xl neo-btn text-rose-500 hover:text-rose-700 bg-white dark:bg-[#1A1A28] text-xs cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-relaxed whitespace-pre-wrap">
                  {note.text}
                </p>

                {/* Reactions Breakdown Drawer */}
                {expandedReactionsNoteId === note.id && (
                  <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Reactions ({note.reactions.length})</span>
                      <button
                        onClick={() => setExpandedReactionsNoteId(null)}
                        className="text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        Close
                      </button>
                    </div>
                    {note.reactions.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No reactions yet from your circle.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {note.reactions.map((rx) => (
                          <div
                            key={rx.id || `${rx.userId}_${rx.emoji}`}
                            className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs shadow-2xs"
                          >
                            <span>{rx.emoji}</span>
                            <span className="font-semibold text-slate-800">{rx.displayName || rx.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Replies Drawer */}
                {expandedRepliesNoteId === note.id && (
                  <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Replies ({note.replies.length})</span>
                      <button
                        onClick={() => setExpandedRepliesNoteId(null)}
                        className="text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        Close
                      </button>
                    </div>
                    {note.replies.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No replies yet from your circle.</p>
                    ) : (
                      <div className="space-y-2">
                        {note.replies.map((rep) => (
                          <div key={rep.id} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{rep.displayName} (@{rep.username})</span>
                              <span className="text-[10px] text-slate-400">{new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-700">{rep.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedReactionsNoteId(expandedReactionsNoteId === note.id ? null : note.id)}
                      className="flex items-center gap-1 font-semibold text-slate-700 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Click to view reactions list"
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>{note.reactions.length} reactions</span>
                    </button>
                    <button
                      onClick={() => setExpandedRepliesNoteId(expandedRepliesNoteId === note.id ? null : note.id)}
                      className="flex items-center gap-1 font-semibold text-stone-700 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer"
                      title="Click to view replies list"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{note.replies.length} replies</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAllowReactions(note)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border ${
                        note.allowReactions !== false
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200 dark:border-stone-700 line-through'
                      }`}
                      title={note.allowReactions !== false ? 'Click to disable reactions' : 'Click to enable reactions'}
                    >
                      {note.allowReactions !== false ? 'Reactions Allowed' : 'Reactions Off'}
                    </button>
                    <button
                      onClick={() => handleToggleAllowReplies(note)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border ${
                        note.allowReplies !== false
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200 dark:border-stone-700 line-through'
                      }`}
                      title={note.allowReplies !== false ? 'Click to disable replies' : 'Click to enable replies'}
                    >
                      {note.allowReplies !== false ? 'Replies Allowed' : 'Replies Off'}
                    </button>
                    <span className="text-[11px] text-stone-400">
                      Status: <strong className="text-amber-700 dark:text-amber-400">ACTIVE</strong>
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Scheduled Notes */}
      {activeTab === 'scheduled' && (
        <div className="space-y-3">
          {scheduledNotes.length === 0 ? (
            <div className="text-center py-14 glass-card rounded-3xl border border-slate-200">
              <Calendar className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No scheduled notes pending release.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                You can schedule notes in the note composer to auto-publish at a later time.
              </p>
            </div>
          ) : (
            scheduledNotes.map((note) => (
              <div key={note.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl select-none mt-0.5">{note.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{note.categoryLabel}</span>
                      <span className="text-[10px] text-sky-800 bg-sky-50 px-2 py-0.2 rounded-full font-bold">
                        Scheduled
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5">{note.text}</p>
                    <p className="text-[11px] text-sky-700 mt-1 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>Releases at {note.scheduledFor ? new Date(note.scheduledFor).toLocaleString() : 'Soon'}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1.5 rounded-xl neu-button text-rose-500"
                  title="Cancel scheduled note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Draft Notes */}
      {activeTab === 'drafts' && (
        <div className="space-y-3">
          {draftNotes.length === 0 ? (
            <div className="text-center py-14 glass-card rounded-3xl border border-slate-200">
              <FileEdit className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No drafts currently saved on your device.</p>
            </div>
          ) : (
            draftNotes.map((draft) => (
              <div key={draft.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl select-none mt-0.5">{draft.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{draft.categoryLabel}</span>
                      <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.2 rounded-full font-bold">
                        Local Draft
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5">{draft.text}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePublishDraft(draft)}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs cursor-pointer"
                  >
                    Publish Now
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    className="p-1.5 rounded-xl neu-button text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Expired History */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {pastNotes.length === 0 ? (
            <div className="text-center py-14 glass-card rounded-3xl border border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No expired notes in your archive.
            </div>
          ) : (
            pastNotes.map((note) => (
              <div key={note.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-xl select-none mt-0.5">{note.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{note.categoryLabel}</span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 truncate mt-0.5">{note.text}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRepostPastNote(note)}
                    className="px-2.5 py-1.5 rounded-xl neu-button text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Repost</span>
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-1.5 rounded-xl neu-button text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 5: Custom Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-14 glass-card rounded-3xl border border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              <Bookmark className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <p>No custom saved templates yet.</p>
              <p className="text-[11px] mt-1">You can save any note as a reusable template from the Active Notes tab!</p>
            </div>
          ) : (
            templates.map((tmpl) => (
              <div key={tmpl.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl select-none mt-0.5">{tmpl.emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{tmpl.name}</p>
                    <p className="text-xs text-stone-600 dark:text-stone-400 italic mt-0.5">"{tmpl.text}"</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReuseTemplate(tmpl)}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs cursor-pointer"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tmpl.id)}
                    className="p-1.5 rounded-xl neu-button text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 6: Close Friends */}
      {activeTab === 'close_friends' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 rounded-3xl text-xs text-amber-950 dark:text-amber-200 space-y-1">
            <h4 className="font-bold flex items-center gap-1.5 text-sm text-amber-900 dark:text-amber-300">
              <Users className="w-4 h-4 text-amber-600" />
              <span>Your Inner Circle</span>
            </h4>
            <p>
              Notes with the "Close Friends" audience are strictly protected and visible only to people on this list.
              Other verified connections cannot see them.
            </p>
          </div>

          <div className="glass-card rounded-3xl divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
            {allFollowers.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-8">
                No approved connections available to add yet.
              </p>
            ) : (
              allFollowers.map((user) => {
                const isCf = closeFriends.some((cf) => cf.friendId === user.id);
                return (
                  <div key={user.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{user.displayName}</p>
                        <p className="text-[11px] text-stone-400">@{user.username}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleCloseFriend(user.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                        isCf
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                          : 'neu-button text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {isCf ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Close Friend</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl p-6 space-y-4 shadow-[6px_6px_0px_#121217]">
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide border-b-2 border-stone-900 dark:border-stone-800 pb-2">
              Edit Note
            </h3>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Note Text</label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
              />
            </div>

            <NeoSelect
              id="edit-audience"
              label="Audience"
              value={editAudience}
              onChange={(val) => setEditAudience(val as any)}
              options={[
                { value: 'followers', label: 'Approved Circle' },
                { value: 'close_friends', label: 'Inner Circle Only' }
              ]}
            />

            <div className="space-y-3 pt-3 border-t-2 border-stone-900 dark:border-stone-800">
              <NeoCheckbox
                id="edit-pinned"
                checked={editPinned}
                onChange={(checked) => setEditPinned(checked)}
                label="Pin this note to the top"
              />

              <NeoCheckbox
                id="edit-reactions"
                checked={editAllowReactions}
                onChange={(checked) => setEditAllowReactions(checked)}
                label="Allow reactions (❤️, 👍, etc.)"
              />

              <NeoCheckbox
                id="edit-replies"
                checked={editAllowReplies}
                onChange={(checked) => setEditAllowReplies(checked)}
                label="Allow private replies"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-stone-900 dark:border-stone-800">
              <button
                onClick={() => setEditingNote(null)}
                className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
