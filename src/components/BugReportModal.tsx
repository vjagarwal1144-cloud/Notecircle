import React, { useState, useEffect } from 'react';
import { X, Bug, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { BugReport } from '../types/index.ts';
import { NeoSelect } from './NeoSelect.tsx';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
  const { androidPreview } = useAuth();
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [category, setCategory] = useState<'ui' | 'privacy' | 'notes' | 'chat' | 'sync' | 'other'>('notes');
  const [description, setDescription] = useState('');
  const [errorId, setErrorId] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myBugs, setMyBugs] = useState<BugReport[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);

  const fetchBugs = async () => {
    try {
      const res = await api.getMyBugs();
      setMyBugs(res.bugs);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBugs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Screenshot file size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      await api.submitBug({
        category,
        description: description.trim(),
        errorIdentifier: errorId.trim() || undefined,
        screenshot: screenshot || undefined,
        deviceInfo: {
          browser: navigator.userAgent.substring(0, 80),
          os: navigator.platform || 'Unknown OS',
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          isAndroidFrame: androidPreview
        }
      });
      setDescription('');
      setErrorId('');
      setScreenshot(null);
      setSuccessMsg(true);
      await fetchBugs();
      setTimeout(() => {
        setSuccessMsg(false);
        setTab('history');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit bug report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        className="neo-card bg-white dark:bg-[#161622] w-full max-w-lg rounded-3xl shadow-[6px_6px_0px_#121217] overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
      >
        <div className="px-6 py-4 border-b-2 border-stone-900 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-stone-900 flex items-center justify-center text-stone-950 font-bold shadow-[2px_2px_0px_#121217]">
              <Bug className="w-4 h-4 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">Report Bug / Feedback</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex items-center px-4 sm:px-6 py-2.5 border-b-2 border-stone-900 dark:border-stone-800 gap-2 bg-stone-50 dark:bg-[#14141F]">
          <button
            onClick={() => setTab('new')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              tab === 'new' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            New Bug Report
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              tab === 'history' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            My Reports ({myBugs.length})
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {tab === 'new' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {successMsg && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Report submitted successfully! Thank you for helping keep NoteCircle reliable.</span>
                </div>
              )}

              <NeoSelect
                id="bug-category"
                label="Issue Category"
                value={category}
                onChange={(val) => setCategory(val as any)}
                options={[
                  { value: 'notes', label: 'Notes & Expiration' },
                  { value: 'chat', label: 'Private Chat & Messaging' },
                  { value: 'privacy', label: 'Privacy & Authorization' },
                  { value: 'sync', label: 'Local-First Sync & Offline' },
                  { value: 'ui', label: 'UI & Responsive Layout' },
                  { value: 'other', label: 'General Feedback / Other' }
                ]}
              />

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 block mb-1 font-display">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="What happened? Include steps to reproduce or expected behavior..."
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 block mb-1 font-display">
                  Error Identifier / Code (Optional)
                </label>
                <input
                  type="text"
                  value={errorId}
                  onChange={(e) => setErrorId(e.target.value)}
                  placeholder="e.g. ERR_SYNC_TIMEOUT_403"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Screenshot / Attachment (Optional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="text-xs text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-50 dark:file:bg-amber-950/40 file:text-amber-800 dark:file:text-amber-300 hover:file:bg-amber-100 cursor-pointer"
                  />
                  {screenshot && (
                    <button
                      type="button"
                      onClick={() => setScreenshot(null)}
                      className="text-[11px] text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {screenshot && (
                  <div className="mt-2 relative w-24 h-16 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700">
                    <img src={screenshot} alt="Screenshot preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-750 rounded-xl text-[11px] text-stone-500 dark:text-stone-400">
                <span className="font-semibold text-stone-700 dark:text-stone-300">Diagnostics automatically included:</span>{' '}
                Browser: {navigator.userAgent.substring(0, 30)}... | Viewport: {window.innerWidth}x{window.innerHeight} | Mode: {androidPreview ? 'Android Shell' : 'Web Desktop'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-stone-900 dark:border-stone-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="px-5 py-2.5 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isSubmitting ? 'Sending...' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {myBugs.length === 0 ? (
                <p className="text-xs font-bold text-stone-400 text-center py-8">
                  You haven't submitted any bug reports yet.
                </p>
              ) : (
                myBugs.map((b) => (
                  <div key={b.id} className="p-4 bg-white dark:bg-[#1A1A28] rounded-2xl border-2 border-stone-900 space-y-2 shadow-[3px_3px_0px_#121217]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                        {b.category}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-stone-900 ${
                        b.status === 'RESOLVED'
                          ? 'bg-emerald-300 text-stone-950'
                          : b.status === 'IN_PROGRESS'
                          ? 'bg-sky-300 text-stone-950'
                          : b.status === 'REVIEWING'
                          ? 'bg-purple-300 text-stone-950'
                          : 'bg-amber-300 text-stone-950'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-stone-900 dark:text-stone-100">{b.description}</p>
                    {b.screenshot && (
                      <div className="pt-1">
                        <img
                          src={b.screenshot}
                          alt="Report screenshot"
                          className="h-20 w-auto rounded-xl border-2 border-stone-900 object-cover"
                        />
                      </div>
                    )}
                    {b.resolutionNote && (
                      <p className="text-[11px] font-bold text-stone-950 dark:text-amber-200 bg-amber-200 dark:bg-amber-950/60 p-2.5 rounded-xl border border-stone-900">
                        <strong>Resolution Note:</strong> {b.resolutionNote}
                      </p>
                    )}
                    <span className="text-[10px] font-bold text-stone-400 block pt-1 border-t border-stone-200 dark:border-stone-800">
                      Submitted on {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
