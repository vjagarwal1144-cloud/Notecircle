import React, { useState } from 'react';
import { X, Clock, Moon, Shield, Check } from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { AvailabilityCode, UserAvailability } from '../types/index.ts';
import { NeoSelect } from './NeoSelect.tsx';
import { NeoCheckbox } from './NeoCheckbox.tsx';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABILITY_OPTIONS: { code: AvailabilityCode; label: string; emoji: string; desc: string }[] = [
  { code: 'available', label: 'Available', emoji: '🟢', desc: 'Free to talk and reply to notes' },
  { code: 'dnd', label: 'Do Not Disturb', emoji: '🔴', desc: 'Focusing or taking quiet time' },
  { code: 'busy', label: 'Busy', emoji: '🟡', desc: 'Working or in meetings; replies will be delayed' },
  { code: 'sleeping', label: 'Sleeping', emoji: '🌙', desc: 'Resting; will reply when awake' },
  { code: 'travelling', label: 'Travelling', emoji: '✈️', desc: 'On the road; intermittent connectivity' },
  { code: 'studying', label: 'Studying', emoji: '📚', desc: 'Deep study session' },
  { code: 'family', label: 'Family Time', emoji: '🏕️', desc: 'Spending time with family' },
  { code: 'offline', label: 'Offline', emoji: '⚫', desc: 'Stepped away from NoteCircle' },
  { code: 'other', label: 'Other', emoji: '✨', desc: 'Create your own custom status, emoji & note' }
];

const CUSTOM_STATUS_EMOJIS = ['✨', '☕', '🎧', '🎨', '🌿', '💻', '🏃‍♂️', '🧘', '🍕', '🚀', '💡', '🌧️', '🍿', '🎸'];

export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, refreshUser } = useAuth();
  const currentAvail = currentUser?.availability || {
    code: 'available',
    label: 'Available',
    emoji: '🟢',
    strictDnd: false,
    updatedAt: new Date().toISOString()
  };

  const [selectedCode, setSelectedCode] = useState<AvailabilityCode>(currentAvail.code);
  const [customEmoji, setCustomEmoji] = useState(currentAvail.emoji || '✨');
  const [customLabel, setCustomLabel] = useState(currentAvail.code === 'other' ? currentAvail.label : 'In the Zone');
  const [customStatus, setCustomStatus] = useState(currentAvail.customStatus || '');
  const [duration, setDuration] = useState('4_hours');
  const [strictDnd, setStrictDnd] = useState(currentAvail.strictDnd || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const now = Date.now();
    let expiresAt: string | null = null;
    switch (duration) {
      case '1_hour':
        expiresAt = new Date(now + 1 * 60 * 60 * 1000).toISOString();
        break;
      case '4_hours':
        expiresAt = new Date(now + 4 * 60 * 60 * 1000).toISOString();
        break;
      case '8_hours':
        expiresAt = new Date(now + 8 * 60 * 60 * 1000).toISOString();
        break;
      case '1_day':
        expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'never':
        expiresAt = null;
        break;
      default:
        expiresAt = new Date(now + 4 * 60 * 60 * 1000).toISOString();
    }

    const opt = AVAILABILITY_OPTIONS.find((o) => o.code === selectedCode) || AVAILABILITY_OPTIONS[0];
    const finalLabel = selectedCode === 'other' ? (customLabel.trim() || 'Custom Status') : opt.label;
    const finalEmoji = selectedCode === 'other' ? (customEmoji.trim() || '✨') : opt.emoji;

    try {
      await api.updateAvailability({
        code: selectedCode,
        label: finalLabel,
        emoji: finalEmoji,
        customStatus: customStatus.trim() || undefined,
        expiresAt,
        strictDnd
      });
      await refreshUser();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        className="bg-[#FFFDF9] dark:bg-[#151413] border-t-2 sm:border-2 border-stone-900 dark:border-stone-100 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-[6px_6px_0px_0px_#18181b] dark:shadow-[6px_6px_0px_0px_#faf8f5] overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Mobile Pull Indicator */}
        <div className="sm:hidden w-12 h-1 bg-stone-400 dark:bg-stone-600 rounded-full mx-auto mt-2.5" />

        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b-2 border-stone-900 dark:border-stone-800 flex items-center justify-between bg-amber-400/10 dark:bg-amber-400/5">
          <div>
            <div className="flex items-center gap-2">
              <span className="neo-badge bg-amber-400 text-stone-950">Circle Signal</span>
              <h3 className="text-base font-black text-stone-950 dark:text-stone-50 font-display">Live Availability</h3>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-0.5">Let your trusted people know your current vibe</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl neo-btn text-stone-800 dark:text-stone-200"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 text-xs font-bold rounded-xl border-2 border-rose-900 shadow-[2px_2px_0px_0px_#881337]">
              {error}
            </div>
          )}

          {/* Status grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {AVAILABILITY_OPTIONS.map((opt) => {
              const isSelected = selectedCode === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setSelectedCode(opt.code)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'border-stone-950 bg-amber-300 dark:bg-amber-400/90 text-stone-950 shadow-[3px_3px_0px_0px_#18181b] translate-x-[-1px] translate-y-[-1px]'
                      : 'border-stone-900/40 dark:border-stone-700 bg-white dark:bg-stone-850 hover:border-stone-900 dark:hover:border-stone-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]'
                  }`}
                >
                  <span className="text-2xl shrink-0 select-none">
                    {opt.code === 'other' && isSelected ? customEmoji : opt.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{opt.label}</p>
                    <p className="text-[10px] opacity-80 leading-tight mt-0.5 line-clamp-1">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Status Expansion when 'Other / Custom' is chosen */}
          {selectedCode === 'other' && (
            <div className="p-3.5 bg-amber-50 dark:bg-stone-850 border-2 border-stone-900 dark:border-stone-200 rounded-2xl shadow-[3px_3px_0px_0px_#d97706] space-y-3 animate-in fade-in zoom-in-98 duration-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span>✨</span> Custom Status Details
                </span>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Other Mode Active</span>
              </div>

              {/* Emoji quick selector */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Choose Status Emoji
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOM_STATUS_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCustomEmoji(emoji)}
                      className={`w-8 h-8 rounded-xl border-2 text-base flex items-center justify-center transition-all ${
                        customEmoji === emoji
                          ? 'border-stone-950 bg-amber-300 shadow-[2px_2px_0px_0px_#18181b] scale-110 font-bold'
                          : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:scale-105'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={customEmoji}
                    onChange={(e) => setCustomEmoji(e.target.value.slice(0, 4))}
                    placeholder="or type"
                    className="w-16 px-2 py-1 text-xs text-center border-2 border-stone-900 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800"
                    title="Type any emoji"
                  />
                </div>
              </div>

              {/* Custom Status Label */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Status Name
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value.slice(0, 30))}
                  placeholder="e.g. Making Music, Gym Workout, Deep Coding..."
                  className="w-full text-xs p-2.5 neo-input text-stone-900 dark:text-stone-100 font-bold"
                />
              </div>
            </div>
          )}

          {/* Custom status text */}
          <div>
            <label className="text-xs font-black text-stone-900 dark:text-stone-100 block mb-1">
              Custom Status Note (Optional)
            </label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value.slice(0, 80))}
              placeholder="e.g. Back in 2 hours, call if urgent..."
              className="w-full text-xs p-2.5 neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
            />
          </div>

          {/* Duration */}
          <NeoSelect
            id="avail-duration"
            label="Clear Status After"
            value={duration}
            onChange={(val) => setDuration(val)}
            options={[
              { value: '1_hour', label: '1 hour' },
              { value: '4_hours', label: '4 hours' },
              { value: '8_hours', label: '8 hours (Tonight)' },
              { value: '1_day', label: '24 hours (Tomorrow)' },
              { value: 'never', label: "Don't clear automatically" }
            ]}
          />

          {/* Strict DND toggle */}
          <div className="p-3 bg-amber-50 dark:bg-[#181824] border-2 border-stone-900 dark:border-stone-700 rounded-2xl flex items-start gap-3 shadow-[2.5px_2.5px_0px_#121217]">
            <Moon className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 stroke-[2.5]" />
            <div className="flex-1">
              <NeoCheckbox
                id="strict-dnd"
                checked={strictDnd}
                onChange={(checked) => setStrictDnd(checked)}
                label="Enable Strict DND Mode"
                description="When checked, incoming direct messages are blocked until this status expires."
                className="w-full justify-between flex-row-reverse"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t-2 border-stone-900 dark:border-stone-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 neo-btn text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 neo-btn-primary text-xs"
            >
              {isSubmitting ? 'Saving...' : 'Set Availability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
