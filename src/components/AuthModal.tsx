import React, { useState } from 'react';
import { Lock, Shield, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, switchUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: email/phone, Step 2: details

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('1234');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (step === 1) {
          // Advance to step 2 after simulated OTP check
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
      } else {
        await login(identifier, password);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div 
        className="glass-card bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-linear-to-br from-amber-500 to-amber-700 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 font-display">
            {isRegister ? 'Join NoteCircle' : 'Welcome to NoteCircle'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {isRegister
              ? 'Your people. Your notes. Your private space.'
              : 'Enter your credentials to access your circle.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isRegister ? (
            <>
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. rahul or rahul@notecircle.app"
                  className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100 focus:border-amber-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100 focus:border-amber-500 focus:outline-hidden"
                  required
                />
              </div>
            </>
          ) : step === 1 ? (
            <>
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Email or Mobile Number
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or +1 234 567 8900"
                  className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100 focus:border-amber-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 rounded-xl text-[11px] text-amber-950 dark:text-amber-200 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Every account is strictly private. Strangers will never see your notes, follower lists, or personal activity.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full text-xs p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="rahul_s"
                    className="w-full text-xs p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Create Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Short Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Lover of coffee & quiet weekends..."
                  className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl text-stone-900 dark:text-stone-100"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              'Processing...'
            ) : isRegister && step === 1 ? (
              <>
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : isRegister ? (
              'Create Private Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>

        {!isRegister && (
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2 text-center">
              ⚡ 1-Click Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await switchUser('rahul');
                  onClose();
                }}
                className="p-2 rounded-xl text-left border border-stone-200 dark:border-stone-700 hover:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 text-xs transition-colors"
              >
                <div className="font-semibold text-stone-800 dark:text-stone-200 text-[11px]">🏕️ Rahul Sharma</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400">Main Account · Bangalore</div>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await switchUser('priya');
                  onClose();
                }}
                className="p-2 rounded-xl text-left border border-stone-200 dark:border-stone-700 hover:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 text-xs transition-colors"
              >
                <div className="font-semibold text-stone-800 dark:text-stone-200 text-[11px]">🏺 Priya Patel</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400">Ceramicist · Mumbai</div>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await switchUser('amit');
                  onClose();
                }}
                className="p-2 rounded-xl text-left border border-stone-200 dark:border-stone-700 hover:border-amber-500 bg-stone-50 dark:bg-stone-800/40 text-xs transition-colors"
              >
                <div className="font-semibold text-stone-800 dark:text-stone-200 text-[11px]">🎧 Amit Verma</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400">Sound Designer · Delhi</div>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await switchUser('admin');
                  onClose();
                }}
                className="p-2 rounded-xl text-left border border-stone-200 dark:border-stone-700 hover:border-amber-500 bg-stone-50 dark:bg-stone-800/40 text-xs transition-colors"
              >
                <div className="font-semibold text-stone-800 dark:text-stone-200 text-[11px]">🛡️ Safety Admin</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400">Trust & Ops · SF</div>
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setStep(1);
              setError(null);
            }}
            className="text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-medium"
          >
            {isRegister ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};
