import React, { useState } from 'react';
import { Lock, Shield, ArrowRight, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { restoreDeviceIdentity } from '../services/crypto.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recovery'>('login');
  const [step, setStep] = useState<1 | 2>(1); // Step 1: email/phone, Step 2: details

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery phrase & password reset states
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoverySubMode, setRecoverySubMode] = useState<'phrase' | 'password_code'>('phrase');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryUserId, setRecoveryUserId] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (step === 1) {
          if (!identifier.trim()) {
            setError('Please enter your email or phone number');
            setIsSubmitting(false);
            return;
          }
          setStep(2);
          setIsSubmitting(false);
          return;
        }

        // Step 2 submission
        await register({
          username,
          displayName,
          email: identifier.includes('@') ? identifier : undefined,
          phone: !identifier.includes('@') ? identifier : undefined,
          password,
          city,
          bio
        });
        onClose();
      } else if (authMode === 'login') {
        await login(identifier, password);
        onClose();
      } else if (authMode === 'recovery') {
        if (recoverySubMode === 'phrase') {
          if (!recoveryPhrase.trim()) {
            setError('Please enter your 12-word cryptographic recovery phrase.');
            setIsSubmitting(false);
            return;
          }
          const words = recoveryPhrase.trim().toLowerCase().split(/\s+/);
          if (words.length !== 12) {
            setError(`A standard recovery phrase requires exactly 12 words (found ${words.length}).`);
            setIsSubmitting(false);
            return;
          }
          const restored = await restoreDeviceIdentity(recoveryPhrase.trim());
          setSuccessNotice(`Key identity restored successfully! Key ID: ${restored.keyId.substring(0, 12)}... You can now sign in.`);
          setRecoveryPhrase('');
          setTimeout(() => {
            setAuthMode('login');
          }, 2000);
        } else {
          // Password reset with 6-digit code
          if (recoveryStep === 1) {
            if (!identifier.trim()) {
              setError('Please enter your username or registered email.');
              setIsSubmitting(false);
              return;
            }
            const reqRes = await api.requestPasswordRecovery(identifier.trim());
            setRecoveryUserId(reqRes.userId);
            setRecoveryStep(2);
            setSuccessNotice('A 6-digit recovery code has been generated. Enter it below.');
          } else {
            if (!recoveryCode.trim() || !newPassword.trim()) {
              setError('Recovery code and new password are required.');
              setIsSubmitting(false);
              return;
            }
            await api.resetPasswordWithRecoveryCode(recoveryUserId, recoveryCode.trim(), newPassword);
            setSuccessNotice('Password reset successful! You can now log in.');
            setTimeout(() => {
              setAuthMode('login');
              setRecoveryStep(1);
            }, 1500);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div 
        className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl shadow-[6px_6px_0px_#121217] p-6 sm:p-7"
        role="dialog"
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-amber-400 border-2.5 border-stone-900 text-stone-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_#121217]">
            {authMode === 'recovery' ? <KeyRound className="w-7 h-7 stroke-[2.5]" /> : <Lock className="w-7 h-7 stroke-[2.5]" />}
          </div>
          <h2 className="text-xl font-black text-stone-950 dark:text-stone-50 uppercase tracking-tight font-display">
            {authMode === 'register'
              ? 'Join NoteCircle'
              : authMode === 'recovery'
              ? 'Key Restoration'
              : 'Sign In To NoteCircle'}
          </h2>
          <p className="text-xs font-bold text-stone-500 mt-1">
            {authMode === 'register'
              ? 'Your people. Your notes. Zero public feeds.'
              : authMode === 'recovery'
              ? 'Restore device cryptographic keys or reset account access.'
              : 'Enter your credentials to access your private circle.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-200 dark:bg-rose-950/60 text-stone-950 dark:text-rose-200 text-xs font-bold rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_#121217]">
            {error}
          </div>
        )}

        {successNotice && (
          <div className="mb-4 p-3 bg-amber-200 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200 text-xs font-bold rounded-xl border-2 border-stone-900 flex items-center gap-2 shadow-[2px_2px_0px_#121217]">
            <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-stone-950 dark:text-amber-300 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {authMode === 'login' ? (
            <>
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. your_username"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('recovery');
                      setError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-[11px] font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Forgot or Restore Keys?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  required
                />
              </div>
            </>
          ) : authMode === 'recovery' ? (
            <>
              <div className="flex rounded-xl bg-stone-100 dark:bg-[#12121A] border-2 border-stone-900 p-1 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecoverySubMode('phrase');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    recoverySubMode === 'phrase'
                      ? 'bg-amber-400 text-stone-950 border border-stone-900 shadow-[1px_1px_0px_#121217]'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  12-Word Phrase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoverySubMode('password_code');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    recoverySubMode === 'password_code'
                      ? 'bg-amber-400 text-stone-950 border border-stone-900 shadow-[1px_1px_0px_#121217]'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  Reset Code
                </button>
              </div>

              {recoverySubMode === 'phrase' ? (
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Enter 12-Word Recovery Phrase
                  </label>
                  <textarea
                    rows={3}
                    value={recoveryPhrase}
                    onChange={(e) => setRecoveryPhrase(e.target.value)}
                    placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                    className="w-full text-xs font-mono font-bold p-3 neo-input text-stone-900 dark:text-stone-100 resize-none"
                    required
                  />
                  <p className="text-[11px] font-medium text-stone-500 mt-1">
                    Deterministically re-derives your ECDH cryptographic identity in local IndexedDB.
                  </p>
                </div>
              ) : recoveryStep === 1 ? (
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                    Username or Registered Email
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. rahul"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                      Enter 6-Digit Recovery Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full text-center font-mono font-black text-sm p-3 neo-input text-stone-900 dark:text-stone-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                      required
                    />
                  </div>
                </>
              )}
            </>
          ) : step === 1 ? (
            /* Register Step 1 */
            <>
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">
                  Email or Mobile Number
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or +1 234 567 8900"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  required
                  autoFocus
                />
              </div>

              <div className="p-3 bg-amber-100/70 dark:bg-amber-950/40 border-2 border-stone-900 rounded-xl text-[11px] font-bold text-stone-900 dark:text-stone-200 flex items-start gap-2 shadow-[2px_2px_0px_#121217]">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 stroke-[2.5]" />
                <span>
                  Every account is strictly private. Strangers will never see your notes, follower lists, or personal activity.
                </span>
              </div>
            </>
          ) : (
            /* Register Step 2 */
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="rahul_s"
                    className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Create Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Short Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Lover of coffee & quiet weekends..."
                  className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              'Processing...'
            ) : authMode === 'recovery' && recoverySubMode === 'phrase' ? (
              'Restore Cryptographic Identity'
            ) : authMode === 'recovery' && recoveryStep === 1 ? (
              'Request Recovery Code'
            ) : authMode === 'recovery' ? (
              'Reset Password'
            ) : authMode === 'register' && step === 1 ? (
              <>
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
              </>
            ) : authMode === 'register' ? (
              'Create Private Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t-2 border-stone-900 dark:border-stone-800 flex items-center justify-between text-xs">
          {authMode === 'recovery' ? (
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setSuccessNotice(null);
              }}
              className="text-stone-700 dark:text-stone-300 hover:underline font-bold cursor-pointer"
            >
              ← Back to Sign In
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setStep(1);
                  setError(null);
                  setSuccessNotice(null);
                }}
                className="text-stone-700 dark:text-stone-300 hover:underline font-bold cursor-pointer"
              >
                {authMode === 'register' ? 'Already have an account? Log In' : "New to NoteCircle? Sign Up"}
              </button>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('recovery');
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-black cursor-pointer text-[11px]"
                >
                  Key Recovery
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
