import React, { useState } from 'react';
import { X, Clock, Users, Sparkles, MessageCircle, Heart, Shield, Calendar, Pin, FileText, Lock } from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import type { NoteCategory, PrivacyAudience } from '../types/index.ts';
import { NeoSelect } from './NeoSelect.tsx';
import { NeoCheckbox } from './NeoCheckbox.tsx';

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
  },
  {
    emoji: '✨',
    category: 'other',
    title: 'Other',
    defaultText: 'Doing my own thing right now. Hit me up later!',
    defaultDuration: '4_hours'
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        className="neo-card bg-white dark:bg-[#161622] w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-[8px_8px_0px_0px_#121217] dark:shadow-[8px_8px_0px_0px_#050508] overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Mobile Pull Handle */}
        <div className="sm:hidden w-12 h-1 bg-stone-400 dark:bg-stone-600 rounded-full mx-auto mt-2.5 mb-1" />

        {/* Modal Collar Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-amber-400 dark:bg-amber-400/90 border-b-2.5 border-stone-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="neo-badge bg-stone-950 text-white">Broadcast</span>
            <span className="text-sm font-black text-stone-950 font-display">Post Circle Note</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl neo-btn bg-white text-stone-950 border-2 border-stone-900 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4.5">
          {error && (
            <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 text-xs font-black rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217]">
              {error}
            </div>
          )}

          {/* Quick 10-Second Templates */}
          <div>
            <label className="text-xs font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-2 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Quick 10-Second Templates</span>
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
              {NOTE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border-2 border-stone-900 flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    category === tmpl.category
                      ? 'bg-amber-400 text-stone-950 shadow-[2.5px_2.5px_0px_0px_#121217] scale-[1.02]'
                      : 'bg-white dark:bg-[#1A1A26] text-stone-900 dark:text-stone-100 hover:bg-amber-100 shadow-[1.5px_1.5px_0px_0px_#121217]'
                  }`}
                >
                  <span className="text-sm select-none">{tmpl.emoji}</span>
                  <span>{tmpl.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                What are you up to?
              </label>
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400">{text.length}/280</span>
            </div>
            <div className="neo-card bg-white dark:bg-[#1A1A26] overflow-hidden">
              <div className="p-2.5 flex items-center gap-2.5 border-b-2 border-stone-900 dark:border-stone-700 bg-stone-100 dark:bg-[#202030]">
                <span className="text-2xl select-none">{selectedEmoji}</span>
                <input
                  type="text"
                  value={selectedEmoji}
                  onChange={(e) => setSelectedEmoji(e.target.value.slice(0, 2))}
                  className="w-10 text-center text-sm font-black bg-white dark:bg-stone-800 border-2 border-stone-900 rounded-lg p-1 text-stone-900 dark:text-stone-100"
                  title="Custom emoji icon"
                />
                <span className="text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase">Custom Icon</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 280))}
                rows={3}
                placeholder="Let your people know what you're doing without broadcasting to the world..."
                className="w-full p-3.5 text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 bg-transparent focus:outline-hidden resize-none font-display"
              />
            </div>
          </div>

          {/* Audience Selection */}
          <div>
            <label className="text-xs font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-2 uppercase tracking-wide">
              <Users className="w-3.5 h-3.5 text-stone-700 dark:text-stone-300" />
              <span>Target Audience</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAudience('followers')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  audience === 'followers'
                    ? 'border-stone-900 bg-amber-300 dark:bg-amber-400 text-stone-950 shadow-[3px_3px_0px_0px_#121217]'
                    : 'border-stone-900/40 dark:border-stone-700 bg-white dark:bg-[#1A1A26] text-stone-800 dark:text-stone-200 hover:border-stone-900'
                }`}
              >
                <div className="text-xs font-black">All Circle</div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5">Approved connections only</div>
              </button>

              <button
                type="button"
                onClick={() => setAudience('close_friends')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  audience === 'close_friends'
                    ? 'border-stone-900 bg-rose-400 dark:bg-rose-500 text-white shadow-[3px_3px_0px_0px_#121217]'
                    : 'border-stone-900/40 dark:border-stone-700 bg-white dark:bg-[#1A1A26] text-stone-800 dark:text-stone-200 hover:border-stone-900'
                }`}
              >
                <div className="text-xs font-black flex items-center gap-1">
                  <span>Close Friends</span>
                  <span className="text-[9px] bg-stone-950 text-white px-1 py-0.2 rounded font-black">Only</span>
                </div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5">Strictly inner circle</div>
              </button>
            </div>
          </div>

          {/* Expiration Settings & Optional Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NeoSelect
              id="note-duration"
              label="Expires After"
              value={duration}
              onChange={(val) => setDuration(val)}
              options={[
                { value: '1_hour', label: '1 hour' },
                { value: '3_hours', label: '3 hours' },
                { value: '6_hours', label: '6 hours' },
                { value: '12_hours', label: '12 hours' },
                { value: '1_day', label: '1 day (24 hours)' },
                { value: '3_days', label: '3 days' },
                { value: '1_week', label: '1 week' },
                { value: 'never', label: 'Never (Until replaced)' }
              ]}
            />

            <div>
              <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 block mb-1.5 font-display">
                Schedule Later (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {/* Privacy Preview Banner */}
          <div className="p-3 bg-amber-50 dark:bg-[#1F1C16] rounded-2xl border-2 border-stone-900 dark:border-amber-500/80 flex items-center justify-between text-xs font-black shadow-[2px_2px_0px_0px_#FF9F1C]">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Circle Privacy Guard:</span>
            </div>
            <span className="text-stone-900 dark:text-stone-100 font-bold">
              {audience === 'close_friends' ? 'Close Friends Only' : 'Circle Only'} · {duration.replace('_', ' ')}
            </span>
          </div>

          {/* Interaction Toggles */}
          <div className="pt-3 border-t-2 border-stone-900 dark:border-stone-800 flex flex-wrap items-center justify-between text-xs font-black text-stone-800 dark:text-stone-200 gap-3">
            <NeoCheckbox
              id="note-allow-replies"
              checked={allowReplies}
              onChange={(checked) => setAllowReplies(checked)}
              label={<span className="flex items-center gap-1 font-black"><MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" /> Allow replies</span>}
            />

            <NeoCheckbox
              id="note-allow-reactions"
              checked={allowReactions}
              onChange={(checked) => setAllowReactions(checked)}
              label={<span className="flex items-center gap-1 font-black"><Heart className="w-3.5 h-3.5 stroke-[2.5]" /> Allow reactions</span>}
            />

            <NeoCheckbox
              id="note-is-pinned"
              checked={isPinned}
              onChange={(checked) => setIsPinned(checked)}
              label={<span className="flex items-center gap-1 font-black"><Pin className="w-3.5 h-3.5 stroke-[2.5]" /> Pin note</span>}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t-2 border-stone-900 dark:border-stone-750 bg-stone-100 dark:bg-[#1D1D2B] flex items-center justify-between pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={isSubmitting || !text.trim()}
            onClick={() => handlePostNote(true)}
            className="px-3 py-2 text-xs font-black neo-btn bg-white dark:bg-[#161622] flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Draft</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 neo-btn text-xs font-black cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !text.trim()}
              onClick={() => handlePostNote(false)}
              className="px-5 py-2 neo-btn-primary disabled:opacity-40 text-xs font-black cursor-pointer"
            >
              {isSubmitting ? 'Posting...' : scheduledFor ? 'Schedule Note' : 'Broadcast Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
