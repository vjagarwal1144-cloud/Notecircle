import React, { useState, useEffect } from 'react';
import { X, Bug, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { BugReport } from '../types/index.ts';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div 
        className="bg-white dark:bg-[#1C1A18] border border-stone-200/80 dark:border-stone-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-display">Report Bug / Send Feedback</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex items-center px-6 pt-3 border-b border-stone-105 dark:border-stone-800 gap-4">
          <button
            onClick={() => setTab('new')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'new' ? 'border-amber-600 text-amber-700 dark:text-amber-400' : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            New Bug Report
          </button>
          <button
            onClick={() => setTab('history')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'history' ? 'border-amber-600 text-amber-700 dark:text-amber-400' : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
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

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                >
                  <option value="notes">Notes & Expiration</option>
                  <option value="chat">Private Chat & Messaging</option>
                  <option value="privacy">Privacy & Authorization</option>
                  <option value="sync">Local-First Sync & Offline</option>
                  <option value="ui">UI & Responsive Layout</option>
                  <option value="other">General Feedback / Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="What happened? Include steps to reproduce or expected behavior..."
                  className="w-full text-xs p-3 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-hidden focus:border-amber-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Error Identifier / Code (Optional)</label>
                <input
                  type="text"
                  value={errorId}
                  onChange={(e) => setErrorId(e.target.value)}
                  placeholder="e.g. ERR_SYNC_TIMEOUT_403"
                  className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-transform active:scale-98"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Sending...' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {myBugs.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">
                  You haven't submitted any bug reports yet.
                </p>
              ) : (
                myBugs.map((b) => (
                  <div key={b.id} className="p-4 bg-white dark:bg-stone-850 rounded-2xl border border-stone-200/80 dark:border-stone-750 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wide">
                        {b.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : b.status === 'IN_PROGRESS'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : b.status === 'REVIEWING'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-stone-300">{b.description}</p>
                    {b.screenshot && (
                      <div className="pt-1">
                        <img
                          src={b.screenshot}
                          alt="Report screenshot"
                          className="h-20 w-auto rounded-xl border border-stone-200 dark:border-stone-700 object-cover"
                        />
                      </div>
                    )}
                    {b.resolutionNote && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                        <strong>Resolution Note:</strong> {b.resolutionNote}
                      </p>
                    )}
                    <span className="text-[10px] text-stone-400 block">
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
