import React, { useState } from 'react';
import { X, Clock, Moon, Shield, Check } from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { AvailabilityCode, UserAvailability } from '../types/index.ts';

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
  { code: 'offline', label: 'Offline', emoji: '⚫', desc: 'Stepped away from NoteCircle' }
];

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

    try {
      await api.updateAvailability({
        code: selectedCode,
        label: opt.label,
        emoji: opt.emoji,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div 
        className="bg-white dark:bg-[#1C1A18] border border-stone-200/80 dark:border-stone-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-display">Your Availability Status</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Separated from notes · Informs your circle when to reach you</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Status grid */}
          <div className="grid grid-cols-2 gap-2">
            {AVAILABILITY_OPTIONS.map((opt) => {
              const isSelected = selectedCode === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setSelectedCode(opt.code)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-600 shadow-xs ring-1 ring-amber-600'
                      : 'border-stone-200/80 dark:border-stone-800 bg-white/70 dark:bg-stone-850 hover:bg-white dark:hover:bg-stone-800'
                  }`}
                >
                  <span className="text-xl shrink-0 select-none">{opt.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{opt.label}</p>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight mt-0.5 line-clamp-1">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom status text */}
          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
              Custom Status Message (Optional)
            </label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value.slice(0, 80))}
              placeholder="e.g. Taking rest until evening, reading on the balcony..."
              className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
              Clear Status After
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
            >
              <option value="1_hour">1 hour</option>
              <option value="4_hours">4 hours</option>
              <option value="8_hours">8 hours (Tonight)</option>
              <option value="1_day">24 hours (Tomorrow)</option>
              <option value="never">Don't clear automatically</option>
            </select>
          </div>

          {/* Strict DND toggle */}
          {(selectedCode === 'dnd' || selectedCode === 'sleeping' || selectedCode === 'busy') && (
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-2.5">
              <Moon className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between cursor-pointer">
                  <span>Enable Strict DND Mode</span>
                  <input
                    type="checkbox"
                    checked={strictDnd}
                    onChange={(e) => setStrictDnd(e.target.checked)}
                    className="rounded-md text-amber-600 focus:ring-amber-500"
                  />
                </label>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-snug">
                  When checked, incoming direct messages are blocked until this status expires.
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-98"
            >
              {isSubmitting ? 'Saving...' : 'Set Availability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
