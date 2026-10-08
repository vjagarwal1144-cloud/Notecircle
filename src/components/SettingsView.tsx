import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Smartphone, 
  AlertTriangle, 
  Check, 
  Save, 
  Key, 
  LogOut,
  Moon,
  Download,
  Database,
  Bell,
  Sun,
  Palette,
  HelpCircle,
  Trash2,
  UserX,
  User
} from 'lucide-react';
import { api } from '../services/api.ts';
import { localDb } from '../services/localDb.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  initOrGetDeviceIdentity, 
  restoreDeviceIdentity, 
  testCryptoPipeline, 
  type DeviceCryptoIdentity 
} from '../services/crypto.ts';
import type { UserPrivacySettings, NotificationSettings } from '../types/index.ts';
import { NeoSelect } from './NeoSelect.tsx';
import { NeoCheckbox } from './NeoCheckbox.tsx';

interface SettingsViewProps {
  onOpenSupport?: () => void;
  onOpenBugReport?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenSupport, onOpenBugReport }) => {
  const { currentUser, refreshUser, logout, isDarkMode, toggleDarkMode } = useAuth();

  const [activeSection, setActiveSection] = useState<
    'account' | 'appearance' | 'privacy' | 'security' | 'notifications' | 'safety' | 'data' | 'android'
  >('account');

  // Account form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(currentUser?.email || '');
  const [newPhone, setNewPhone] = useState(currentUser?.phone || '');
  const [accSuccess, setAccSuccess] = useState(false);

  // Privacy form
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>(
    currentUser?.privacySettings || {
      whoCanMessageMe: 'mutual',
      whoCanSeeOnlineStatus: 'connections',
      whoCanSeeReadReceipts: 'connections',
      whoCanSeeTyping: 'connections',
      whoCanFollowMe: 'require_approval',
      whoCanReply: 'connections',
      whoCanReact: 'connections',
      bioVisibility: 'connections',
      cityVisibility: 'connections',
      birthdayVisibility: 'only_me',
      workplaceVisibility: 'connections',
      followerCountsVisibility: 'connections',
      dndModeStrict: false
    }
  );
  const [privSuccess, setPrivSuccess] = useState(false);

  // Notification form
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(
    currentUser?.notificationSettings || {
      messages: true,
      messageRequests: true,
      followRequests: true,
      acceptedRequests: true,
      reactions: true,
      replies: true,
      noteExpiration: true,
      securityAlerts: true
    }
  );
  const [notifSuccess, setNotifSuccess] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; browser: string; ip: string; current: boolean; lastActive: string }>>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Email/Phone OTP Verification Modal
  const [verifyModal, setVerifyModal] = useState<{
    open: boolean;
    type: 'email' | 'phone';
    targetValue: string;
    code: string;
  }>({ open: false, type: 'email', targetValue: '', code: '' });

  // Forgot Password Modal
  const [forgotModal, setForgotModal] = useState<{
    open: boolean;
    step: 'request' | 'verify';
    identifier: string;
    code: string;
    newPass: string;
    userId?: string;
    msg: string;
  }>({ open: false, step: 'request', identifier: '', code: '', newPass: '', msg: '' });

  const [isSaving, setIsSaving] = useState(false);

  const [deviceIdentity, setDeviceIdentity] = useState<DeviceCryptoIdentity | null>(null);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [cryptoTestResult, setCryptoTestResult] = useState<any | null>(null);
  const [isTestingCrypto, setIsTestingCrypto] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await api.getSessions();
      setSessions(res.sessions);
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeSection === 'security') {
      fetchSessions();
      initOrGetDeviceIdentity().then(setDeviceIdentity).catch(() => {});
    }
  }, [activeSection]);

  const handleRunCryptoSelfTest = async () => {
    setIsTestingCrypto(true);
    try {
      const res = await testCryptoPipeline();
      setCryptoTestResult(res);
      setInlineNotice({ type: 'success', text: 'Cryptographic pipeline passed: AES-GCM-256 round-trip verified.' });
    } catch (err: any) {
      setInlineNotice({ type: 'error', text: err.message || 'Crypto self-test failed' });
    } finally {
      setIsTestingCrypto(false);
    }
  };

  const handleRestoreIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreInput.trim()) return;
    try {
      const restored = await restoreDeviceIdentity(restoreInput.trim());
      setDeviceIdentity(restored);
      // Publish restored public key so contacts can encrypt messages for this device
      await api.registerDevicePublicKey(restored.deviceId, 'Restored Device Client', restored.publicKeyJwk).catch(() => {});
      setRestoreInput('');
      setInlineNotice({ type: 'success', text: `Device identity restored & verified! Key ID: ${restored.keyId}` });
    } catch (err: any) {
      setInlineNotice({ type: 'error', text: err.message || 'Failed to restore device identity' });
    }
  };

  const handleStartVerifyContact = (type: 'email' | 'phone') => {
    const val = type === 'email' ? newEmail.trim() : newPhone.trim();
    if (!val) {
      alert(`Please enter a valid ${type}`);
      return;
    }
    setVerifyModal({
      open: true,
      type,
      targetValue: val,
      code: ''
    });
  };

  const handleConfirmVerification = async () => {
    const code = verifyModal.code.trim();
    if (!/^\d{6}$/.test(code)) {
      alert('Verification code must be a 6-digit numeric confirmation code.');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateCredentials({
        newEmail: verifyModal.type === 'email' ? verifyModal.targetValue : undefined,
        newPhone: verifyModal.type === 'phone' ? verifyModal.targetValue : undefined
      });
      await refreshUser();
      setVerifyModal({ open: false, type: 'email', targetValue: '', code: '' });
      setAccSuccess(true);
      setTimeout(() => setAccSuccess(false), 3000);
      alert(`${verifyModal.type === 'email' ? 'Email' : 'Mobile'} verified and updated!`);
    } catch (err: any) {
      alert(err.message || 'Verification update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestForgot = async () => {
    if (!forgotModal.identifier.trim()) {
      alert('Enter your email or username');
      return;
    }

    try {
      const res = await api.forgotPassword(forgotModal.identifier.trim());
      setForgotModal((prev) => ({
        ...prev,
        step: 'verify',
        userId: res.userId,
        code: '',
        msg: res.message
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to request password recovery');
    }
  };

  const handleConfirmForgotReset = async () => {
    if (!forgotModal.userId || !forgotModal.code || !forgotModal.newPass) {
      alert('Please fill in recovery code and new password');
      return;
    }

    try {
      const res = await api.resetPassword({
        userId: forgotModal.userId,
        code: forgotModal.code.trim(),
        newPassword: forgotModal.newPass.trim()
      });
      alert(res.message);
      setForgotModal({ open: false, step: 'request', identifier: '', code: '', newPass: '', msg: '' });
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'Password reset failed');
    }
  };

  const handleLogoutAllOtherDevices = async () => {
    if (!confirm('Logout all other active devices and companion sessions?')) return;
    try {
      await api.logoutAllDevices();
      alert('All other remote devices logged out.');
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to logout devices');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.revokeSession(sessionId);
      await fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke session');
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setAccSuccess(false);
    try {
      await api.updateCredentials({
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        newEmail: newEmail !== currentUser?.email ? newEmail : undefined,
        newPhone: newPhone !== currentUser?.phone ? newPhone : undefined
      });
      await refreshUser();
      setAccSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setAccSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    setPrivSuccess(false);
    try {
      await api.updatePrivacySettings(privacySettings);
      await refreshUser();
      setPrivSuccess(true);
      setTimeout(() => setPrivSuccess(false), 3000);
    } catch (err: any) {
      setInlineNotice({ type: 'error', text: err.message || 'Failed to save privacy' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    setNotifSuccess(false);
    try {
      await api.updateNotificationSettings(notifSettings);
      await refreshUser();
      setNotifSuccess(true);
      setInlineNotice({ type: 'success', text: 'Notification preferences saved.' });
      setTimeout(() => setNotifSuccess(false), 3000);
    } catch (err: any) {
      setInlineNotice({ type: 'error', text: err.message || 'Failed to save notification settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearLocalData = async () => {
    try {
      await localDb.clearAllLocalData();
      setInlineNotice({ type: 'success', text: 'Local IndexedDB storage and cached credentials cleared.' });
    } catch (err: any) {
      setInlineNotice({ type: 'error', text: err.message || 'Failed to clear local data' });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      await localDb.clearAllLocalData();
      await logout();
    } catch (err: any) {
      setInlineNotice({ type: 'error', text: err.message || 'Failed to delete account' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      
      {/* Settings Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 p-1.5 bg-[#FAF7F0] dark:bg-[#12121A] border-[3px] border-stone-950 dark:border-stone-750 rounded-2xl shadow-[3px_3px_0px_#121217] dark:shadow-[3px_3px_0px_#000] text-xs font-black scrollbar-none">
        {[
          { id: 'account', label: 'Account', icon: User },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'privacy', label: 'Privacy', icon: Shield },
          { id: 'security', label: 'Security', icon: Lock },
          { id: 'notifications', label: 'Alerts', icon: Bell },
          { id: 'data', label: 'Storage', icon: Database },
          { id: 'android', label: 'Android Stack', icon: Smartphone }
        ].map((tab) => {
          const isActive = activeSection === tab.id;
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`h-10 px-4 rounded-xl uppercase tracking-wider font-display font-black text-xs transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-stone-950 border-[2.5px] border-stone-950 shadow-[2px_2px_0px_#121217]'
                  : 'bg-white dark:bg-[#1A1A26] text-stone-700 dark:text-stone-300 border-[2.5px] border-stone-950/20 dark:border-stone-750 hover:border-stone-950 dark:hover:border-stone-500 hover:text-stone-950 dark:hover:text-white'
              }`}
            >
              <IconComp className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {inlineNotice && (
        <div className={`p-3.5 text-xs font-bold rounded-2xl border-[2.5px] border-stone-950 flex items-center justify-between shadow-[2px_2px_0px_#121217] ${
          inlineNotice.type === 'success' 
            ? 'bg-amber-200 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200' 
            : 'bg-rose-200 dark:bg-rose-950/60 text-stone-950 dark:text-rose-200'
        }`}>
          <span>{inlineNotice.text}</span>
          <button 
            type="button" 
            onClick={() => setInlineNotice(null)} 
            className="text-[10px] font-black uppercase underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 0: Appearance / Theme */}
      {activeSection === 'appearance' && (
        <div className="space-y-4">
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-5 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
            <div className="border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-black text-stone-950 dark:text-stone-50 uppercase tracking-wide flex items-center gap-2 font-display">
                <Palette className="w-4 h-4 stroke-[2.5] text-amber-500" />
                <span>NoteCircle Visual Theme</span>
              </h3>
              <p className="text-xs font-bold text-stone-600 dark:text-stone-400 mt-0.5">
                Switch between high-contrast daylight cream canvas and deep obsidian neo-night.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Theme Card A: Warm Cream Canvas */}
              <button
                type="button"
                onClick={() => isDarkMode && toggleDarkMode()}
                className={`p-5 rounded-3xl border-[3px] text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                  !isDarkMode 
                    ? 'border-stone-950 bg-[#FAF7F0] shadow-[5px_5px_0px_#121217] ring-2 ring-amber-400' 
                    : 'border-stone-950/30 dark:border-stone-750 bg-stone-50 dark:bg-[#15141E] opacity-75 hover:opacity-100 hover:border-stone-950 shadow-[3px_3px_0px_#121217] dark:shadow-[3px_3px_0px_#000]'
                }`}
              >
                <div>
                  {/* Card Header & Selected Indicator */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-300 text-stone-950 border-2 border-stone-950 flex items-center justify-center shadow-[2px_2px_0px_#121217]">
                        <Sun className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-stone-950 block font-display">Warm Cream Canvas</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Daylight Mode</span>
                      </div>
                    </div>
                    {!isDarkMode ? (
                      <span className="text-xs bg-amber-400 text-stone-950 font-black px-3 py-1 rounded-xl border-2 border-stone-950 flex items-center gap-1 shadow-[2px_2px_0px_#121217]">
                        <Check className="w-3.5 h-3.5 stroke-[3.5]" /> Active
                      </span>
                    ) : (
                      <span className="text-[11px] bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold px-2.5 py-1 rounded-xl border border-stone-400 dark:border-stone-700 group-hover:border-stone-950">
                        Select
                      </span>
                    )}
                  </div>

                  {/* UI Preview Area */}
                  <div className="p-3 bg-[#FAF7F0] rounded-2xl border-2 border-stone-950 space-y-2 shadow-[2.5px_2.5px_0px_#121217]">
                    <div className="flex items-center justify-between">
                      <div className="px-2 py-0.5 bg-amber-400 text-stone-950 font-black text-[9px] rounded-md border border-stone-950">
                        NOTE #1
                      </div>
                      <span className="text-[10px] font-black text-stone-700">15m ago</span>
                    </div>
                    <p className="text-xs font-black text-stone-950 font-display">
                      Cafe sync at 4 PM ☕
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-stone-950/20 text-[10px] font-bold text-stone-700">
                      <span>🔥 4 reactions</span>
                      <span>·</span>
                      <span>Mutual circle</span>
                    </div>
                  </div>

                  {/* Short Description (Strict Light Contrast) */}
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-300 mt-3 leading-relaxed">
                    Tactile cream canvas (#FAF7F0) with deep ink-black neo-borders, amber accents, and crisp daylight contrast.
                  </p>
                </div>
              </button>

              {/* Theme Card B: Obsidian Night */}
              <button
                type="button"
                onClick={() => !isDarkMode && toggleDarkMode()}
                className={`p-5 rounded-3xl border-[3px] text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                  isDarkMode 
                    ? 'border-amber-400 dark:border-amber-400 bg-[#161622] shadow-[5px_5px_0px_#FFB800] ring-2 ring-amber-400' 
                    : 'border-stone-950/30 dark:border-stone-750 bg-stone-50 dark:bg-[#15141E] opacity-75 hover:opacity-100 hover:border-stone-950 shadow-[3px_3px_0px_#121217] dark:shadow-[3px_3px_0px_#000]'
                }`}
              >
                <div>
                  {/* Card Header & Selected Indicator */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 border-2 border-stone-950 dark:border-stone-700 flex items-center justify-center shadow-[2px_2px_0px_#121217]">
                        <Moon className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-stone-950 dark:text-stone-50 block font-display">Obsidian Night</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Dark Mode</span>
                      </div>
                    </div>
                    {isDarkMode ? (
                      <span className="text-xs bg-amber-400 text-stone-950 font-black px-3 py-1 rounded-xl border-2 border-stone-950 flex items-center gap-1 shadow-[2px_2px_0px_#121217]">
                        <Check className="w-3.5 h-3.5 stroke-[3.5]" /> Active
                      </span>
                    ) : (
                      <span className="text-[11px] bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold px-2.5 py-1 rounded-xl border border-stone-400 dark:border-stone-700 group-hover:border-stone-950">
                        Select
                      </span>
                    )}
                  </div>

                  {/* UI Preview Area */}
                  <div className="p-3 bg-[#0E0E14] rounded-2xl border-2 border-stone-750 space-y-2 shadow-[2.5px_2.5px_0px_#000]">
                    <div className="flex items-center justify-between">
                      <div className="px-2 py-0.5 bg-amber-400 text-stone-950 font-black text-[9px] rounded-md border border-stone-950">
                        NOTE #1
                      </div>
                      <span className="text-[10px] font-bold text-stone-400">2h ago</span>
                    </div>
                    <p className="text-xs font-black text-stone-50 font-display">
                      Encrypted draft #2 ⚡
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-stone-800 text-[10px] font-bold text-stone-400">
                      <span>⚡ 7 reactions</span>
                      <span>·</span>
                      <span>Private circle</span>
                    </div>
                  </div>

                  {/* Short Description */}
                  <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mt-3 leading-relaxed">
                    Deep obsidian surface (#0D0D12) with kinetic amber shadows, dark paper cards, and glowing badges.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Account Management */}
      {activeSection === 'account' && (
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] space-y-4 bg-white dark:bg-[#161622]">
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide border-b-2 border-stone-900 dark:border-stone-800 pb-2">
              Account Credentials
            </h3>

            {accSuccess && (
              <div className="p-3 bg-amber-300 border-2 border-stone-900 text-stone-950 text-xs font-black rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_#121217]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Account credentials updated successfully.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">Email Address</label>
                  {newEmail !== currentUser?.email && (
                    <button
                      type="button"
                      onClick={() => handleStartVerifyContact('email')}
                      className="text-[11px] font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Verify & Update
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">Mobile Phone</label>
                  {newPhone !== (currentUser?.phone || '') && newPhone.trim() && (
                    <button
                      type="button"
                      onClick={() => handleStartVerifyContact('phone')}
                      className="text-[11px] font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Verify & Update
                    </button>
                  )}
                </div>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="pt-3 border-t-2 border-stone-900 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-900 dark:text-stone-100">Change Password</h4>
                <button
                  type="button"
                  onClick={() => setForgotModal({ open: true, step: 'request', identifier: currentUser?.email || currentUser?.username || '', code: '', newPass: '', msg: '' })}
                  className="text-[11px] text-amber-600 dark:text-amber-400 font-black hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t-2 border-stone-900 dark:border-stone-800">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
              >
                {isSaving ? 'Updating...' : 'Save Account Changes'}
              </button>
            </div>
          </div>

          {/* Danger Zone: Account Deletion */}
          <div className="neo-card rounded-3xl p-5 border-2 border-rose-500 bg-rose-100 dark:bg-rose-950/40 space-y-3 shadow-[4px_4px_0px_#121217]">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 stroke-[2.5]" />
              <span>Danger Zone: Deactivate or Delete Account</span>
            </h4>
            <p className="text-xs font-bold text-rose-900 dark:text-rose-300 leading-relaxed">
              Permanently delete your NoteCircle account, follow connections, notes, and local cryptographic keys.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black border-2 border-stone-900 shadow-[2px_2px_0px_#121217] cursor-pointer"
            >
              Permanently Delete Account
            </button>
          </div>
        </form>
      )}

      {/* Section 2: Privacy Controls */}
      {activeSection === 'privacy' && (
        <div className="space-y-4">
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-5 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
            <div className="flex items-center justify-between border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-stone-950 dark:text-stone-50 uppercase tracking-wide font-display flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500 stroke-[2.5]" />
                  <span>Communication & Connection Privacy</span>
                </h3>
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400 mt-0.5">
                  Zero public discovery · Strict authorization filters
                </p>
              </div>
              {privSuccess && (
                <span className="text-xs font-black text-stone-950 bg-amber-400 px-3 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3.5]" /> Saved
                </span>
              )}
            </div>

            {/* Custom NoteCircle Dropdown Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NeoSelect
                id="privacy-who-can-message"
                label="Who can message me?"
                value={privacySettings.whoCanMessageMe}
                onChange={(val) => setPrivacySettings({ ...privacySettings, whoCanMessageMe: val as any })}
                options={[
                  { value: 'mutual', label: 'Mutual connections only' },
                  { value: 'followers', label: 'Any approved follower' },
                  { value: 'people_i_follow', label: 'People I follow' },
                  { value: 'nobody', label: 'Nobody' }
                ]}
              />

              <NeoSelect
                id="privacy-who-can-reply"
                label="Who can reply to my notes?"
                value={privacySettings.whoCanReply}
                onChange={(val) => setPrivacySettings({ ...privacySettings, whoCanReply: val as any })}
                options={[
                  { value: 'connections', label: 'Approved Connections' },
                  { value: 'close_friends', label: 'Close Friends Only' },
                  { value: 'nobody', label: 'Nobody (Disable replies)' }
                ]}
              />
            </div>

            <div className="pt-3 border-t-[2.5px] border-stone-950 dark:border-stone-800 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 font-display">
                Profile Field Visibility (Strangers never see these)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <NeoSelect
                  id="privacy-bio"
                  label="Bio"
                  value={privacySettings.bioVisibility}
                  onChange={(val) => setPrivacySettings({ ...privacySettings, bioVisibility: val as any })}
                  options={[
                    { value: 'connections', label: 'Connections' },
                    { value: 'only_me', label: 'Only Me' }
                  ]}
                />

                <NeoSelect
                  id="privacy-city"
                  label="City"
                  value={privacySettings.cityVisibility}
                  onChange={(val) => setPrivacySettings({ ...privacySettings, cityVisibility: val as any })}
                  options={[
                    { value: 'connections', label: 'Connections' },
                    { value: 'only_me', label: 'Only Me' }
                  ]}
                />

                <NeoSelect
                  id="privacy-birthday"
                  label="Birthday"
                  value={privacySettings.birthdayVisibility}
                  onChange={(val) => setPrivacySettings({ ...privacySettings, birthdayVisibility: val as any })}
                  options={[
                    { value: 'only_me', label: 'Only Me' },
                    { value: 'connections', label: 'Connections' }
                  ]}
                />

                <NeoSelect
                  id="privacy-workplace"
                  label="Workplace"
                  value={privacySettings.workplaceVisibility}
                  onChange={(val) => setPrivacySettings({ ...privacySettings, workplaceVisibility: val as any })}
                  options={[
                    { value: 'connections', label: 'Connections' },
                    { value: 'only_me', label: 'Only Me' }
                  ]}
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t-[2.5px] border-stone-950 dark:border-stone-800">
              <button
                type="button"
                onClick={handleSavePrivacy}
                disabled={isSaving}
                className="px-5 py-2.5 neo-btn-primary text-stone-950 rounded-xl text-xs font-black shadow-[3px_3px_0px_#121217] cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Privacy Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Security & Sessions */}
      {activeSection === 'security' && (
        <div className="space-y-4">
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-4 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
            <h3 className="text-sm font-black text-stone-950 dark:text-stone-50 uppercase tracking-wide border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-2.5 font-display flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500 stroke-[2.5]" />
              <span>Security Architecture</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 bg-[#FAF7F0] dark:bg-[#15141A] rounded-2xl border-2 border-stone-950 dark:border-stone-700 flex items-center justify-between shadow-[2px_2px_0px_#121217] dark:shadow-[2px_2px_0px_#000]">
                <div>
                  <p className="font-black text-stone-950 dark:text-stone-100 font-display">End-to-End Encryption Algorithm</p>
                  <p className="text-stone-600 dark:text-stone-400 font-medium">AES-GCM 256-bit with PBKDF2 device key derivation</p>
                </div>
                <span className="text-xs bg-amber-400 text-stone-950 font-black px-3 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217]">
                  Active
                </span>
              </div>

              <div className="p-3.5 bg-[#FAF7F0] dark:bg-[#15141A] rounded-2xl border-2 border-stone-950 dark:border-stone-700 flex items-center justify-between shadow-[2px_2px_0px_#121217] dark:shadow-[2px_2px_0px_#000]">
                <div>
                  <p className="font-black text-stone-950 dark:text-stone-100 font-display">Password Hashing</p>
                  <p className="text-stone-600 dark:text-stone-400 font-medium">PBKDF2-SHA256 with 1000-pass cryptographic salt</p>
                </div>
                <span className="text-xs bg-amber-400 text-stone-950 font-black px-3 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217]">
                  Enforced
                </span>
              </div>
            </div>
          </div>

          {/* Device Cryptographic Identity & 12-Word Recovery Phrase */}
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-4 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
            <div className="flex items-center justify-between border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-stone-950 dark:text-stone-100 uppercase tracking-wide font-display flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500 stroke-[2.5]" />
                  <span>Device Cryptographic Identity & Key Recovery</span>
                </h3>
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">Zero-knowledge local key pair and cross-device recovery phrase</p>
              </div>
              <span className="text-xs font-mono font-black text-stone-950 dark:text-stone-100 bg-amber-200 dark:bg-amber-950/60 px-3 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217]">
                {deviceIdentity?.keyId || 'KEY-LOCAL-INIT'}
              </span>
            </div>

            {/* Recovery Phrase Section with Visual Separation */}
            <div className="p-4 bg-[#FFF9ED] dark:bg-[#1F1B12] border-2 border-amber-400 rounded-2xl space-y-3 shadow-[2.5px_2.5px_0px_#FFB800]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-stone-950 dark:text-stone-100 font-display">
                  12-Word Device Recovery Phrase
                </span>
                <button
                  type="button"
                  onClick={() => setShowRecoveryPhrase(!showRecoveryPhrase)}
                  className="px-3 py-1.5 text-xs font-black bg-amber-400 text-stone-950 border-2 border-stone-950 rounded-xl shadow-[2px_2px_0px_#121217] hover:bg-amber-300 transition-all cursor-pointer"
                >
                  {showRecoveryPhrase ? 'Hide Phrase' : 'Reveal Phrase'}
                </button>
              </div>

              {showRecoveryPhrase ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 animate-in fade-in">
                  {deviceIdentity?.recoveryPhrase.split(' ').map((word, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#15141A] border-2 border-stone-950 dark:border-stone-700 px-2.5 py-1.5 rounded-xl text-center shadow-[1.5px_1.5px_0px_#121217]">
                      <span className="text-[10px] text-stone-500 block font-mono font-black">{idx + 1}</span>
                      <span className="text-xs font-black text-stone-950 dark:text-stone-100 font-mono">{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-white dark:bg-[#15141A] rounded-xl border-2 border-stone-950 dark:border-stone-700 shadow-[1.5px_1.5px_0px_#121217] flex items-center justify-between">
                  <span className="text-xs text-stone-500 dark:text-stone-400 font-mono tracking-widest font-bold">
                    •••••••• •••••••• •••••••• ••••••••
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Encrypted on-device
                  </span>
                </div>
              )}

              <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300 leading-relaxed">
                Keep this phrase safe. When switching browsers or restoring your account on a secondary device, enter these 12 words to restore full local decryption capabilities.
              </p>
            </div>

            {/* Restore Device Key Form */}
            <form onSubmit={handleRestoreIdentity} className="space-y-2 pt-2 border-t-[2.5px] border-stone-950 dark:border-stone-800">
              <label className="text-xs font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 block font-display">
                Restore Device Identity from 12-Word Phrase
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                  placeholder="Enter 12 recovery words separated by spaces..."
                  className="flex-1 text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                />
                <button
                  type="submit"
                  className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black shrink-0 cursor-pointer"
                >
                  Restore Key
                </button>
              </div>
            </form>

            {/* Live Cryptographic Self-Test */}
            <div className="pt-2 border-t-[2.5px] border-stone-950 dark:border-stone-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-stone-900 dark:text-stone-200 font-display">
                    In-Browser Cryptographic Audit
                  </h4>
                  <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                    Live client AES-GCM 256-bit round-trip self-test
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunCryptoSelfTest}
                  disabled={isTestingCrypto}
                  className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                >
                  {isTestingCrypto ? 'Testing...' : 'Run Cryptographic Self-Test'}
                </button>
              </div>

              {cryptoTestResult && (
                <div className="p-3.5 bg-amber-100 dark:bg-amber-950/40 border-2 border-stone-950 dark:border-amber-700 rounded-2xl text-xs space-y-1.5 shadow-[2px_2px_0px_#121217]">
                  <div className="flex items-center gap-2 text-stone-950 dark:text-amber-200 font-black font-display">
                    <Check className="w-4 h-4 text-amber-600 stroke-[3]" />
                    <span>Cryptographic Verification Passed</span>
                  </div>
                  <div className="font-mono text-[11px] text-stone-800 dark:text-amber-300 space-y-0.5 font-bold">
                    <p>• Algorithm: {cryptoTestResult.algorithm}</p>
                    <p>• Ciphertext (AES-GCM): {cryptoTestResult.ciphertextSample}</p>
                    <p>• Roundtrip match: {cryptoTestResult.roundtripMatch ? 'Verified (100% exact)' : 'Failed'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Sessions & Logged-In Devices */}
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-4 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
            <div className="flex items-center justify-between border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-stone-950 dark:text-stone-100 uppercase tracking-wide font-display">
                  Logged-In Devices & Active Sessions
                </h3>
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  Manage all recognized browser and companion devices
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogoutAllOtherDevices}
                className="px-3.5 py-1.5 neo-btn-coral text-white rounded-xl text-xs font-black shadow-[2px_2px_0px_#121217] cursor-pointer"
              >
                Logout All Other Devices
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {sessions.length === 0 ? (
                <div className="p-3.5 bg-[#FAF7F0] dark:bg-[#15141A] rounded-2xl border-2 border-stone-950 dark:border-stone-700 flex items-center justify-between shadow-[2px_2px_0px_#121217] dark:shadow-[2px_2px_0px_#000]">
                  <div>
                    <p className="font-black text-stone-950 dark:text-stone-100 font-display">Current Device</p>
                    <p className="text-stone-600 dark:text-stone-400 font-medium">Web Client · Local device session</p>
                  </div>
                  <span className="text-xs bg-amber-400 text-stone-950 font-black px-3 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217]">
                    Active Now
                  </span>
                </div>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="p-3.5 bg-[#FAF7F0] dark:bg-[#15141A] rounded-2xl border-2 border-stone-950 dark:border-stone-700 flex items-center justify-between shadow-[2px_2px_0px_#121217] dark:shadow-[2px_2px_0px_#000]">
                    <div>
                      <p className="font-black text-stone-950 dark:text-stone-100 flex items-center gap-2 font-display">
                        <Smartphone className="w-4 h-4 text-stone-600 dark:text-stone-400 stroke-[2.5]" />
                        <span>{s.device}</span>
                      </p>
                      <p className="text-stone-600 dark:text-stone-400 text-[11px] font-medium">
                        {s.browser} · IP: {s.ip} · Last active: {new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.current ? (
                        <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2.5 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217]">
                          This Device
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-black px-2.5 py-1 rounded-xl border border-stone-400 dark:border-stone-700">
                            Remote Device
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-2.5 py-1 text-[11px] neo-btn-coral text-white rounded-lg font-black cursor-pointer shadow-[1.5px_1.5px_0px_#121217]"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t-[2.5px] border-stone-950 dark:border-stone-800">
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 neo-btn text-stone-900 dark:text-stone-100 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#121217]"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Logout Current Device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Notifications */}
      {activeSection === 'notifications' && (
        <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-4 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
          <div className="flex items-center justify-between border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-2.5">
            <div>
              <h3 className="text-sm font-black text-stone-950 dark:text-stone-100 uppercase tracking-wide font-display flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500 stroke-[2.5]" />
                <span>Notification Preferences</span>
              </h3>
              <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                Control notifications for note activity and chats
              </p>
            </div>
            {notifSuccess && (
              <span className="text-xs font-black text-stone-950 bg-amber-400 px-3 py-1 rounded-xl border-2 border-stone-950 shadow-[1.5px_1.5px_0px_#121217] flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3.5]" /> Saved
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs pt-1">
            {Object.entries(notifSettings).map(([key, val]) => (
              <div 
                key={key} 
                className="p-3 bg-[#FAF7F0] dark:bg-[#15141A] rounded-2xl border-2 border-stone-950 dark:border-stone-750 shadow-[2px_2px_0px_#121217] dark:shadow-[2px_2px_0px_#000] flex items-center justify-between"
              >
                <NeoCheckbox
                  id={`notif-${key}`}
                  checked={val}
                  onChange={(checked) => setNotifSettings({ ...notifSettings, [key]: checked })}
                  label={<span className="capitalize text-stone-950 dark:text-stone-100 font-black">{key.replace(/([A-Z])/g, ' $1')}</span>}
                  description="Enable real-time instant alerts for this category"
                  className="w-full justify-between flex-row-reverse"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-3 border-t-[2.5px] border-stone-950 dark:border-stone-800">
            <button
              onClick={handleSaveNotifications}
              className="px-5 py-2.5 neo-btn-primary text-stone-950 rounded-xl text-xs font-black shadow-[3px_3px_0px_#121217] cursor-pointer"
            >
              Save Notification Settings
            </button>
          </div>
        </div>
      )}

      {/* Section 5: Data & Storage */}
      {activeSection === 'data' && (
        <div className="space-y-4">
          <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-4 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
            <h3 className="text-sm font-black text-stone-950 dark:text-stone-100 uppercase tracking-wide border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-2.5 flex items-center gap-2 font-display">
              <Database className="w-4 h-4 text-amber-500 stroke-[2.5]" />
              <span>Local-First Data & Portability (GDPR Article 20)</span>
            </h3>

            <p className="text-xs font-bold text-stone-700 dark:text-stone-300 leading-relaxed">
              NoteCircle gives you complete ownership of your personal data. You can download an offline JSON archive of your account profile and connection records anytime.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <a
                href={api.exportPersonalDataUrl()}
                download
                className="px-5 py-2.5 neo-btn-primary text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-[3px_3px_0px_#121217] cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download Personal Data Archive (.JSON)</span>
              </a>

              <button
                type="button"
                onClick={handleClearLocalData}
                className="px-5 py-2.5 neo-btn text-stone-900 dark:text-stone-100 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-100 hover:text-rose-700 border-2 border-stone-950 shadow-[3px_3px_0px_#121217] cursor-pointer"
              >
                <Trash2 className="w-4 h-4 stroke-[2.5]" />
                <span>Clear Local Device Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 6: Android Architecture Stack */}
      {activeSection === 'android' && (
        <div className="neo-card rounded-3xl p-5 sm:p-6 shadow-[5px_5px_0px_#121217] dark:shadow-[5px_5px_0px_#000] space-y-4 bg-white dark:bg-[#161622] border-[3px] border-stone-950 dark:border-stone-700">
          <h3 className="text-sm font-black text-stone-950 dark:text-stone-100 uppercase tracking-wide border-b-[2.5px] border-stone-950 dark:border-stone-800 pb-2.5 flex items-center gap-2 font-display">
            <Smartphone className="w-4 h-4 text-amber-500 stroke-[2.5]" />
            <span>Native Android Companion Specs</span>
          </h3>

          <p className="text-xs font-bold text-stone-700 dark:text-stone-300 leading-relaxed">
            The NoteCircle native Android application uses Jetpack Compose, Kotlin Coroutines, Retrofit, and Android Keystore for secure local encryption matching this web client's local-first architecture.
          </p>

          <div className="bg-[#0D0D14] text-stone-100 p-4 rounded-2xl font-mono text-[11px] space-y-1.5 border-2 border-stone-950 dark:border-stone-700 shadow-[3px_3px_0px_#121217]">
            <p className="text-amber-400 font-bold">// Native Android Stack (See /android/README.md)</p>
            <p>UI: Jetpack Compose Material 3</p>
            <p>Local Storage: Room + EncryptedSharedPreferences</p>
            <p>Crypto: Android Keystore AES-GCM 256</p>
            <p>Backend: Same API endpoints (/api/notes, /api/connections, /api/chat)</p>
          </div>
        </div>
      )}
      {/* Verification OTP Modal (Change Email or Mobile) */}
      {verifyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="neo-card bg-white dark:bg-[#161622] w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-[6px_6px_0px_#121217]">
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide border-b-2 border-stone-900 dark:border-stone-800 pb-2">
              Verify New {verifyModal.type === 'email' ? 'Email' : 'Mobile Phone'}
            </h3>

            <p className="text-xs font-medium text-stone-700 dark:text-stone-300 leading-relaxed">
              We've dispatched a 6-digit confirmation code to <strong>{verifyModal.targetValue}</strong>.
            </p>

            <div className="p-3 bg-amber-200 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200 rounded-xl text-xs font-black border-2 border-stone-900 shadow-[2px_2px_0px_#121217]">
              Test OTP Code: <strong>582914</strong>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Enter 6-Digit Code</label>
              <input
                type="text"
                maxLength={6}
                value={verifyModal.code}
                onChange={(e) => setVerifyModal({ ...verifyModal, code: e.target.value })}
                placeholder="582914"
                className="w-full text-center tracking-widest text-lg font-mono font-black p-3 neo-input text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-stone-900 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setVerifyModal({ open: false, type: 'email', targetValue: '', code: '' })}
                className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerification}
                disabled={isSaving || !verifyModal.code.trim()}
                className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
              >
                Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password / Account Recovery Modal */}
      {forgotModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="neo-card bg-white dark:bg-[#161622] w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-[6px_6px_0px_#121217]">
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide border-b-2 border-stone-900 dark:border-stone-800 pb-2">
              Password Recovery
            </h3>

            {forgotModal.step === 'request' ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Enter your registered username or email address to receive an account recovery OTP code.
                </p>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Username or Email</label>
                  <input
                    type="text"
                    value={forgotModal.identifier}
                    onChange={(e) => setForgotModal({ ...forgotModal, identifier: e.target.value })}
                    placeholder="e.g. rahul or email@domain.com"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-stone-900 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setForgotModal({ open: false, step: 'request', identifier: '', code: '', newPass: '', msg: '' })}
                    className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestForgot}
                    className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
                  >
                    Send Recovery Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-200 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200 rounded-xl text-xs font-black border-2 border-stone-900">
                  {forgotModal.msg}
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Recovery OTP Code</label>
                  <input
                    type="text"
                    value={forgotModal.code}
                    onChange={(e) => setForgotModal({ ...forgotModal, code: e.target.value })}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-xs font-bold p-3 neo-input text-center font-mono tracking-wider text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">New Password</label>
                  <input
                    type="password"
                    value={forgotModal.newPass}
                    onChange={(e) => setForgotModal({ ...forgotModal, newPass: e.target.value })}
                    placeholder="At least 6 characters"
                    className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-stone-900 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setForgotModal({ open: false, step: 'request', identifier: '', code: '', newPass: '', msg: '' })}
                    className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmForgotReset}
                    className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
                  >
                    Set New Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
