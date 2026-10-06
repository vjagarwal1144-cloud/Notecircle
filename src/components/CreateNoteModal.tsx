import React, { useState } from 'react';
import { X, Clock, Users, Sparkles, MessageCircle, Heart, Shield, Calendar, Pin, FileText } from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import type { NoteCategory, PrivacyAudience } from '../types/index.ts';

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated: () => void;
}

interface TemplateItem {
  emoji: string;
  category: NoteCategory;
  title: string;
  defaultText: string;
  defaultDuration: string;
}

const NOTE_TEMPLATES: TemplateItem[] = [
  {
    emoji: '🏕️',
    category: 'family',
    title: 'Family Trip',
    defaultText: "I'm spending time with my family for the next few days. Please don't call unless urgent.",
    defaultDuration: '3_days'
  },
  {
    emoji: '📚',
    category: 'study',
    title: 'Studying',
    defaultText: 'Studying today. Replies may be slow.',
    defaultDuration: '6_hours'
  },
  {
    emoji: '💼',
    category: 'work',
    title: 'Working',
    defaultText: "Working right now. I'll reply later.",
    defaultDuration: '3_hours'
  },
  {
    emoji: '🔇',
    category: 'dnd',
    title: 'Do Not Disturb',
    defaultText: "Taking some rest. Please don't disturb unless urgent.",
    defaultDuration: '12_hours'
  },
  {
    emoji: '✈️',
    category: 'travel',
    title: 'Travelling',
    defaultText: 'Travelling and may be offline intermittently.',
    defaultDuration: '1_day'
  },
  {
    emoji: '🏖️',
    category: 'vacation',
    title: 'Vacation',
    defaultText: 'On vacation. Back soon!',
    defaultDuration: '1_week'
  },
  {
    emoji: '💤',
    category: 'sleep',
    title: 'Sleeping',
    defaultText: "Sleeping. I'll reply tomorrow morning.",
    defaultDuration: '6_hours'
  },
  {
    emoji: '☕',
    category: 'break',
    title: 'Taking a Break',
    defaultText: 'Stepping away from screens for a bit.',
    defaultDuration: '1_hour'
  },
  {
    emoji: '🎮',
    category: 'gaming',
    title: 'Gaming',
    defaultText: 'Gaming for a while. Catch you later.',
    defaultDuration: '3_hours'
  }
];

export const CreateNoteModal: React.FC<CreateNoteModalProps> = ({
  isOpen,
  onClose,
  onNoteCreated
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState('🏕️');
  const [category, setCategory] = useState<NoteCategory>('family');
  const [text, setText] = useState('');
  const [duration, setDuration] = useState('1_day');
  const [audience, setAudience] = useState<PrivacyAudience>('followers');
  const [scheduledFor, setScheduledFor] = useState('');
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: TemplateItem) => {
    setSelectedEmoji(tmpl.emoji);
    setCategory(tmpl.category);
    setText(tmpl.defaultText);
    setDuration(tmpl.defaultDuration);
    setError(null);
  };

  const handlePostNote = async (asDraft: boolean = false) => {
    if (!text.trim()) {
      setError('Please write a note or choose a template.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      emoji: selectedEmoji,
      category,
      text: text.trim(),
      duration,
      audience,
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      isDraft: asDraft,
      isPinned,
      allowReplies,
      allowReactions
    };

    try {
      if (navigator.onLine) {
        const res = await api.createNote(payload);
        await localDb.saveNote(res.note);
      } else {
        // Local-first offline queue
        await localDb.enqueueSyncAction({
          id: `sync_${Date.now()}`,
          type: 'CREATE_NOTE',
          payload,
          timestamp: new Date().toISOString()
        });
        alert('Offline: Note saved locally to your device and queued to sync when connected.');
      }

      setText('');
      onNoteCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div 
        className="bg-white dark:bg-[#1C1A18] border border-stone-200/80 dark:border-stone-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100 font-display">Post a Note</span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-normal">
              Temporary & private to your circle
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Quick 1-Tap Templates */}
          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick 10-Second Templates</span>
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {NOTE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0 ${
                    category === tmpl.category
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 shadow-xs'
                      : 'neu-button text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span>{tmpl.emoji}</span>
                  <span>{tmpl.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">What are you up to?</label>
              <span className="text-[11px] text-stone-400">{text.length}/280</span>
            </div>
            <div className="border border-stone-200 dark:border-stone-750 rounded-2xl bg-white dark:bg-stone-900 focus-within:border-amber-500 shadow-xs overflow-hidden transition-colors">
              <div className="p-2 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850">
                <span className="text-xl select-none">{selectedEmoji}</span>
                <input
                  type="text"
                  value={selectedEmoji}
                  onChange={(e) => setSelectedEmoji(e.target.value.slice(0, 2))}
                  className="w-8 text-center text-xs font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-0.5 text-stone-900 dark:text-stone-100"
                  title="Custom emoji"
                />
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Custom icon</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 280))}
                rows={3}
                placeholder="Let your people know what you're doing without having to message everyone individually..."
                className="w-full p-3 text-xs sm:text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 bg-transparent focus:outline-hidden resize-none"
              />
            </div>
          </div>

          {/* Audience Selection */}
          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>Audience</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAudience('followers')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  audience === 'followers'
                    ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-600 ring-1 ring-amber-600 shadow-xs'
                    : 'neu-button text-stone-800 dark:text-stone-200'
                }`}
              >
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Approved Followers</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">All your verified connections</div>
              </button>

              <button
                type="button"
                onClick={() => setAudience('close_friends')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  audience === 'close_friends'
                    ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-600 ring-1 ring-amber-600 shadow-xs'
                    : 'neu-button text-stone-800 dark:text-stone-200'
                }`}
              >
                <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                  <span>Close Friends</span>
                  <span className="text-[9px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-1 py-0.2 rounded-md font-bold">Only</span>
                </div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Strictly your chosen inner circle</div>
              </button>
            </div>
          </div>

          {/* Expiration Settings & Optional Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                <span>Expires after</span>
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full text-xs font-medium bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="1_hour">1 hour</option>
                <option value="3_hours">3 hours</option>
                <option value="6_hours">6 hours</option>
                <option value="12_hours">12 hours</option>
                <option value="1_day">1 day (24 hours)</option>
                <option value="3_days">3 days</option>
                <option value="1_week">1 week</option>
                <option value="never">Never (Until replaced)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                <span>Schedule for later (Optional)</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full text-xs font-medium bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2 text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Interaction Toggles */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between text-xs text-stone-600 dark:text-stone-300 gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowReplies}
                onChange={(e) => setAllowReplies(e.target.checked)}
                className="rounded-md border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Allow replies
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowReactions}
                onChange={(e) => setAllowReactions(e.target.checked)}
                className="rounded-md border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" /> Allow reactions
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded-md border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Pin className="w-3.5 h-3.5" /> Pin note
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800/80 bg-stone-50/70 dark:bg-stone-850 flex items-center justify-between">
          <button
            type="button"
            disabled={isSubmitting || !text.trim()}
            onClick={() => handlePostNote(true)}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-900 rounded-xl neu-button flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !text.trim()}
              onClick={() => handlePostNote(false)}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-xs transition-transform active:scale-98"
            >
              {isSubmitting ? 'Posting...' : scheduledFor ? 'Schedule Note' : 'Post Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
