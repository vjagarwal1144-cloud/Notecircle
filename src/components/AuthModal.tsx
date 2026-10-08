import React, { useState, useEffect } from 'react';
import { Lock, Shield, ArrowRight, KeyRound, CheckCircle2, Mail, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { restoreDeviceIdentity } from '../services/crypto.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80'
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, completeRegistration } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recovery'>('login');

  // Registration step: 1 = Email, 2 = Verify OTP, 3 = Profile & Password
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Profile setup states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);

  // Login states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI feedback states
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

  // Resend OTP countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.sendRegisterOtp(cleanEmail);
      setSuccessNotice(res.message);
      setCooldownSeconds(60);
      setRegStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.verifyRegisterOtp(email.trim().toLowerCase(), cleanOtp);
      setVerificationToken(res.verificationToken);
      setSuccessNotice('Email verified! Complete your profile below.');
      setRegStep(3);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Complete Registration
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      setError('Username must be 3-24 characters (alphanumeric and underscore only).');
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeRegistration({
        email: email.trim().toLowerCase(),
        verificationToken,
        username: cleanUsername,
        displayName: displayName.trim(),
        password,
        bio: bio.trim(),
        city: city.trim(),
        avatarUrl: selectedAvatar
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to activate account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      await login(loginIdentifier.trim(), loginPassword);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recovery handler
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      if (recoverySubMode === 'phrase') {
        if (!recoveryPhrase.trim()) {
          setError('Please enter your 12-word cryptographic recovery phrase.');
          return;
        }
        const words = recoveryPhrase.trim().toLowerCase().split(/\s+/);
        if (words.length !== 12) {
          setError(`A standard recovery phrase requires exactly 12 words (found ${words.length}).`);
          return;
        }
        const restored = await restoreDeviceIdentity(recoveryPhrase.trim());
        setSuccessNotice(`Key identity restored! Key ID: ${restored.keyId.substring(0, 12)}... You can now sign in.`);
        setRecoveryPhrase('');
        setTimeout(() => setAuthMode('login'), 2000);
      } else {
        if (recoveryStep === 1) {
          if (!loginIdentifier.trim()) {
            setError('Please enter your registered email address.');
            return;
          }
          const reqRes = await api.requestPasswordRecovery(loginIdentifier.trim());
          setRecoveryUserId(reqRes.userId);
          setRecoveryStep(2);
          setSuccessNotice('A 6-digit recovery code has been sent to your email.');
        } else {
          if (!recoveryCode.trim() || !newPassword.trim()) {
            setError('Recovery code and new password are required.');
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
    } catch (err: any) {
      setError(err.message || 'Recovery failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
      <div 
        className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl shadow-[6px_6px_0px_#121217] dark:shadow-[6px_6px_0px_#000] p-6 sm:p-7 border-[3px] border-stone-950 dark:border-stone-700"
        role="dialog"
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-amber-400 border-[2.5px] border-stone-950 text-stone-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_#121217]">
            {authMode === 'recovery' ? (
              <KeyRound className="w-7 h-7 stroke-[2.5]" />
            ) : authMode === 'register' ? (
              <Mail className="w-7 h-7 stroke-[2.5]" />
            ) : (
              <Lock className="w-7 h-7 stroke-[2.5]" />
            )}
          </div>
          <h2 className="text-xl font-black text-stone-950 dark:text-stone-50 uppercase tracking-tight font-display">
            {authMode === 'register'
              ? regStep === 1
                ? 'Register with Email'
                : regStep === 2
                ? 'Verify Email Code'
                : 'Complete Your Profile'
              : authMode === 'recovery'
              ? 'Key Restoration'
              : 'Sign In To NoteCircle'}
          </h2>
          <p className="text-xs font-bold text-stone-600 dark:text-stone-400 mt-1">
            {authMode === 'register'
              ? regStep === 1
                ? 'Enter your email to receive an official 6-digit OTP.'
                : regStep === 2
                ? `Enter the 6-digit code sent to ${email}`
                : 'Choose your unique username and set your password.'
              : authMode === 'recovery'
              ? 'Restore device cryptographic keys or reset account access.'
              : 'Enter your credentials to access your private circle.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-200 dark:bg-rose-950/60 text-stone-950 dark:text-rose-200 text-xs font-black rounded-xl border-2 border-stone-950 shadow-[2px_2px_0px_#121217]">
            {error}
          </div>
        )}

        {successNotice && (
          <div className="mb-4 p-3 bg-amber-300 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200 text-xs font-black rounded-xl border-2 border-stone-950 flex items-center gap-2 shadow-[2px_2px_0px_#121217]">
            <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-stone-950 dark:text-amber-300 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* REGISTRATION FLOW (EMAIL ONLY) */}
        {authMode === 'register' ? (
          <>
            {/* Step Indicators */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`h-2 flex-1 rounded-full border border-stone-950 transition-all ${regStep >= 1 ? 'bg-amber-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
              <div className={`h-2 flex-1 rounded-full border border-stone-950 transition-all ${regStep >= 2 ? 'bg-amber-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
              <div className={`h-2 flex-1 rounded-full border border-stone-950 transition-all ${regStep >= 3 ? 'bg-amber-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
            </div>

            {/* Step 1: Email Form */}
            {regStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-3.5">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. name@domain.com"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-950 dark:text-stone-100"
                    required
                    autoFocus
                  />
                </div>

                <div className="p-3 bg-amber-100/80 dark:bg-amber-950/40 border-2 border-stone-950 rounded-xl text-[11px] font-bold text-stone-950 dark:text-stone-200 flex items-start gap-2 shadow-[2px_2px_0px_#121217]">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    New registrations use email only. A 6-digit one-time code will be dispatched to verify ownership.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#121217]"
                >
                  {isSubmitting ? (
                    'Sending Code...'
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Step 2: OTP Form */}
            {regStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 font-display">
                      Enter 6-Digit Email Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="text-[11px] font-black text-amber-600 hover:underline cursor-pointer"
                    >
                      Change Email
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full text-center font-mono font-black text-lg tracking-[8px] p-3 neo-input text-stone-950 dark:text-stone-100"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold pt-1">
                  <span className="text-stone-500">Didn't receive the email?</span>
                  <button
                    type="button"
                    disabled={cooldownSeconds > 0 || isSubmitting}
                    onClick={() => handleSendOtp()}
                    className="text-amber-600 dark:text-amber-400 font-black hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Code'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otp.trim().length !== 6}
                  className="w-full mt-2 py-3 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#121217]"
                >
                  {isSubmitting ? 'Verifying Code...' : 'Verify Code & Proceed'}
                </button>
              </form>
            )}

            {/* Step 3: Complete Profile */}
            {regStep === 3 && (
              <form onSubmit={handleCompleteRegistration} className="space-y-3.5">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                    Choose Avatar
                  </label>
                  <div className="flex items-center gap-2">
                    {AVATAR_PRESETS.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedAvatar(url)}
                        className={`w-10 h-10 rounded-full border-2 overflow-hidden transition-all cursor-pointer ${
                          selectedAvatar === url
                            ? 'border-amber-400 scale-110 shadow-[2px_2px_0px_#121217]'
                            : 'border-stone-950 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex M"
                      className="w-full text-xs font-bold p-2.5 neo-input text-stone-950 dark:text-stone-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                      Username (@)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="alex_m"
                      className="w-full text-xs font-bold p-2.5 neo-input text-stone-950 dark:text-stone-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                    Password (Min 8 Characters)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs font-bold p-2.5 neo-input text-stone-950 dark:text-stone-100"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City, Country"
                      className="w-full text-xs font-bold p-2.5 neo-input text-stone-950 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                      Bio
                    </label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Short bio..."
                      className="w-full text-xs font-bold p-2.5 neo-input text-stone-950 dark:text-stone-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#121217]"
                >
                  {isSubmitting ? 'Activating Account...' : 'Complete & Enter NoteCircle'}
                </button>
              </form>
            )}
          </>
        ) : authMode === 'login' ? (
          /* LOGIN FLOW */
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                Username or Email
              </label>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="e.g. your_username or email"
                className="w-full text-xs font-bold p-3 neo-input text-stone-950 dark:text-stone-100"
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 font-display">
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
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs font-bold p-3 neo-input text-stone-950 dark:text-stone-100"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#121217]"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* RECOVERY FLOW */
          <form onSubmit={handleRecoverySubmit} className="space-y-3.5">
            <div className="flex rounded-xl bg-stone-100 dark:bg-[#12121A] border-2 border-stone-950 p-1 mb-2">
              <button
                type="button"
                onClick={() => {
                  setRecoverySubMode('phrase');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  recoverySubMode === 'phrase'
                    ? 'bg-amber-400 text-stone-950 border border-stone-950 shadow-[1px_1px_0px_#121217]'
                    : 'text-stone-500 hover:text-stone-950 dark:hover:text-stone-100'
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
                    ? 'bg-amber-400 text-stone-950 border border-stone-950 shadow-[1px_1px_0px_#121217]'
                    : 'text-stone-500 hover:text-stone-950 dark:hover:text-stone-100'
                }`}
              >
                Reset Code
              </button>
            </div>

            {recoverySubMode === 'phrase' ? (
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                  Enter 12-Word Recovery Phrase
                </label>
                <textarea
                  rows={3}
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                  className="w-full text-xs font-mono font-bold p-3 neo-input text-stone-950 dark:text-stone-100 resize-none"
                  required
                />
                <p className="text-[11px] font-medium text-stone-500 mt-1">
                  Re-derives your cryptographic identity in local IndexedDB.
                </p>
              </div>
            ) : recoveryStep === 1 ? (
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-950 dark:text-stone-100"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full text-center font-mono font-black text-sm p-3 neo-input text-stone-950 dark:text-stone-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-300 block mb-1 font-display">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-950 dark:text-stone-100"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#121217]"
            >
              {isSubmitting ? (
                'Processing...'
              ) : recoverySubMode === 'phrase' ? (
                'Restore Cryptographic Identity'
              ) : recoveryStep === 1 ? (
                'Send Recovery Code'
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        {/* Modal Footer Switching */}
        <div className="mt-4 pt-3 border-t-2 border-stone-950 dark:border-stone-800 flex items-center justify-between text-xs">
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
                  setRegStep(1);
                  setError(null);
                  setSuccessNotice(null);
                }}
                className="text-stone-800 dark:text-stone-200 hover:underline font-bold cursor-pointer"
              >
                {authMode === 'register' ? 'Already have an account? Sign In' : "New to NoteCircle? Register with Email"}
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
