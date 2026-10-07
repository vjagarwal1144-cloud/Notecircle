import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Shield, FileText, Send, ChevronDown, CheckCircle } from 'lucide-react';
import { api } from '../services/api.ts';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBugReport?: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, onOpenBugReport }) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'safety' | 'policies' | 'recovery' | 'contact'>('faq');
  const [faqs, setFaqs] = useState<Array<{ q: string; a: string }>>([]);
  const [policies, setPolicies] = useState<{ terms: string; privacyPolicy: string; communityGuidelines: string } | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Ticket form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSent, setTicketSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getFaqs().then((res) => setFaqs(res.faqs)).catch(() => {});
      api.getPolicies().then((res) => setPolicies(res.policies)).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    setIsSubmitting(true);
    try {
      await api.submitSupportTicket(ticketSubject, ticketMessage);
      setTicketSent(true);
      setTicketSubject('');
      setTicketMessage('');
      setTimeout(() => setTicketSent(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        className="neo-card bg-white dark:bg-[#161622] w-full max-w-xl rounded-3xl shadow-[6px_6px_0px_#121217] overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
      >
        <div className="px-6 py-4 border-b-2 border-stone-900 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-stone-900 flex items-center justify-center text-stone-950 font-bold shadow-[2px_2px_0px_#121217]">
              <HelpCircle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide">Help, Safety & Policies</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex items-center px-4 sm:px-6 py-2.5 border-b-2 border-stone-900 dark:border-stone-800 gap-2 text-xs overflow-x-auto scrollbar-none bg-stone-50 dark:bg-[#14141F]">
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'faq' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            FAQs
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'safety' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            Safety
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'policies' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab('recovery')}
            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'recovery' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            Recovery
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`px-3 py-1.5 rounded-xl font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'contact' ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]' : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white'
            }`}
          >
            Contact
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'faq' && (
            <div className="space-y-2.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="border border-stone-200/80 dark:border-stone-800 rounded-2xl bg-white dark:bg-stone-850 overflow-hidden shadow-xs">
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left p-3.5 flex items-center justify-between gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                    >
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 text-xs text-stone-600 dark:text-stone-400 leading-relaxed border-t border-stone-100 dark:border-stone-800 pt-2 bg-stone-50/50 dark:bg-stone-900/50">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-3 text-xs text-stone-700 dark:text-stone-300">
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl">
                <h4 className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5 mb-1 text-sm">
                  <Shield className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>Privacy-First Social Atmosphere</span>
                </h4>
                <p className="text-amber-900 dark:text-amber-300 leading-relaxed">
                  NoteCircle protects you from harassment and public surveillance by ensuring that no stranger can read your notes or send unapproved messages.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-stone-900 dark:text-stone-100">Safety Features Built Into NoteCircle:</h5>
                <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
                  <li><strong>Account Privacy</strong>: Every account is strictly private. Nobody can follow you without explicit approval.</li>
                  <li><strong>Immediate Blocking</strong>: Block any user to instantly sever connections, prevent messaging, and hide notes in both directions.</li>
                  <li><strong>Reporting Workflow</strong>: Report inappropriate notes, abusive chats, or impersonating accounts directly to Trust & Safety.</li>
                  <li><strong>Strict Do Not Disturb</strong>: Guard your quiet hours or family time from incoming messages.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'policies' && policies && (
            <div className="space-y-4 text-xs text-stone-700 dark:text-stone-300">
              <div className="p-4 bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 rounded-2xl space-y-2 shadow-xs">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Local-First Privacy Architecture</span>
                </h4>
                <p className="whitespace-pre-wrap text-stone-600 dark:text-stone-400 leading-relaxed font-mono text-[11px] bg-stone-50 dark:bg-stone-900 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
                  {policies.privacyPolicy}
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 rounded-2xl space-y-2 shadow-xs">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Terms of Service</h4>
                <p className="whitespace-pre-wrap text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
                  {policies.terms}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'recovery' && (
            <div className="space-y-3.5 text-xs text-stone-700 dark:text-stone-300">
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl space-y-1">
                <h4 className="font-bold text-amber-950 dark:text-amber-200 text-sm">Account Recovery & Troubleshooting Guide</h4>
                <p className="text-amber-900 dark:text-amber-300 leading-relaxed text-[11px]">
                  NoteCircle uses local-first client storage and zero plaintext backend architecture. Follow these standard troubleshooting procedures for account and device issues:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 rounded-xl space-y-1">
                  <h5 className="font-bold text-stone-900 dark:text-stone-100">1. Forgot Password</h5>
                  <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                    You can reset your account password in Settings &gt; Account using your registered email or phone verification OTP code.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 rounded-xl space-y-1">
                  <h5 className="font-bold text-stone-900 dark:text-stone-100">2. Local Device Storage & Cache Issues</h5>
                  <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                    If messages or drafts appear out of sync after a connection drop, go to Settings &gt; Data &gt; "Clear Local Device Cache" or toggle your network status to trigger an offline-first re-synchronization.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 rounded-xl space-y-1">
                  <h5 className="font-bold text-stone-900 dark:text-stone-100">3. End-to-End Encryption Keys</h5>
                  <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                    Device keys are generated on your physical device using standard Web Crypto API (ECDH / AES-GCM 256). They never touch the server. If switching browsers, simply log in to initialize your local session key.
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 rounded-xl space-y-1">
                  <h5 className="font-bold text-stone-900 dark:text-stone-100">4. Found a Bug or Unexpected Behavior?</h5>
                  <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed mb-2">
                    Submit a bug report with optional screenshot and automatic browser diagnostics directly to our engineering team.
                  </p>
                  {onOpenBugReport && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBugReport();
                      }}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 transition-colors"
                    >
                      Report a Problem / Bug
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <form onSubmit={handleSendTicket} className="space-y-3.5">
              {ticketSent && (
                <div className="p-3 bg-amber-200 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200 text-xs font-black rounded-xl border-2 border-stone-900 flex items-center gap-2 shadow-[2px_2px_0px_#121217]">
                  <CheckCircle className="w-4 h-4 stroke-[3] text-stone-950 shrink-0" />
                  <span>Your support ticket was submitted. Our team will review your inquiry.</span>
                </div>
              )}

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Subject</label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Question about account recovery or note expiration"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Message</label>
                <textarea
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe your inquiry or request in detail..."
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end pt-2 border-t-2 border-stone-900 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={isSubmitting || !ticketSubject.trim() || !ticketMessage.trim()}
                  className="px-5 py-2.5 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isSubmitting ? 'Submitting...' : 'Send to Support'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
