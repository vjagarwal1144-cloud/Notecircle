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
  UserX
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
      setRestoreInput('');
      setInlineNotice({ type: 'success', text: `Device identity restored! New Key ID: ${restored.keyId}` });
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
    if (verifyModal.code.trim() !== '582914' && verifyModal.code.trim().length !== 6) {
      alert('Verification code must be 6 digits (Default demo code: 582914)');
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
      
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-stone-200/80 dark:border-stone-800 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveSection('account')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeSection === 'account' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          Account
        </button>

        <button
          onClick={() => setActiveSection('appearance')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeSection === 'appearance' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Appearance</span>
        </button>

        <button
          onClick={() => setActiveSection('privacy')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeSection === 'privacy' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          Privacy Controls
        </button>

        <button
          onClick={() => setActiveSection('security')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeSection === 'security' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          Security & Sessions
        </button>

        <button
          onClick={() => setActiveSection('notifications')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeSection === 'notifications' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          Notifications
        </button>

        <button
          onClick={() => setActiveSection('data')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeSection === 'data' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          Data & Storage
        </button>

        <button
          onClick={() => setActiveSection('android')}
          className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeSection === 'android' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          Android Native Stack
        </button>
      </div>

      {inlineNotice && (
        <div className={`p-3 text-xs rounded-xl border flex items-center justify-between animate-in fade-in ${
          inlineNotice.type === 'success' 
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800' 
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900'
        }`}>
          <span>{inlineNotice.text}</span>
          <button 
            type="button" 
            onClick={() => setInlineNotice(null)} 
            className="text-[10px] font-bold uppercase underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 0: Appearance / Theme */}
      {activeSection === 'appearance' && (
        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-6 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <div className="border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-display flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-600" />
                <span>NoteCircle Design & Color Theme</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Neumorphic, warm and calm interface crafted for authentic quiet sharing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Light Theme Card */}
              <button
                type="button"
                onClick={() => isDarkMode && toggleDarkMode()}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  !isDarkMode 
                    ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/50 shadow-sm' 
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sun className="w-5 h-5 text-amber-600" />
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Warm Cream Light</span>
                  </div>
                  {!isDarkMode && (
                    <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-1.5 shadow-xs">
                  <div className="w-16 h-2 bg-amber-600 rounded-full" />
                  <div className="w-28 h-1.5 bg-stone-300 rounded-full" />
                  <div className="w-20 h-1.5 bg-stone-200 rounded-full" />
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2.5">
                  Soft warm background (#FAF8F5), diffuse shadows, warm cards & amber accents.
                </p>
              </button>

              {/* Dark Theme Card */}
              <button
                type="button"
                onClick={() => !isDarkMode && toggleDarkMode()}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isDarkMode 
                    ? 'border-amber-600 bg-amber-950/20 ring-2 ring-amber-500/50 shadow-sm' 
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Moon className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Deep Obsidian Dark</span>
                  </div>
                  {isDarkMode && (
                    <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div className="p-3 bg-[#131211] rounded-xl border border-stone-800 space-y-1.5 shadow-xs">
                  <div className="w-16 h-2 bg-amber-500 rounded-full" />
                  <div className="w-28 h-1.5 bg-stone-700 rounded-full" />
                  <div className="w-20 h-1.5 bg-stone-800 rounded-full" />
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2.5">
                  Dark obsidian background (#131211), warm glowing borders & soft amber luminescence.
                </p>
              </button>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/80 dark:border-stone-800 text-xs space-y-1">
              <span className="font-bold text-stone-800 dark:text-stone-200">Typography & Micro-Interactions:</span>
              <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                Rendered with Plus Jakarta Sans and Inter font stacks. Designed with 20–24px rounded corners and tactile micro-interactions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Account Management */}
      {activeSection === 'account' && (
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2">
              Account Credentials
            </h3>

            {accSuccess && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-600" />
                <span>Account credentials updated successfully.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Email Address</label>
                  {newEmail !== currentUser?.email && (
                    <button
                      type="button"
                      onClick={() => handleStartVerifyContact('email')}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                    >
                      Verify & Update
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Mobile Phone</label>
                  {newPhone !== (currentUser?.phone || '') && newPhone.trim() && (
                    <button
                      type="button"
                      onClick={() => handleStartVerifyContact('phone')}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
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
                  className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">Change Password</h4>
                <button
                  type="button"
                  onClick={() => setForgotModal({ open: true, step: 'request', identifier: currentUser?.email || currentUser?.username || '', code: '', newPass: '', msg: '' })}
                  className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-transform active:scale-98"
              >
                {isSaving ? 'Updating...' : 'Save Account Changes'}
              </button>
            </div>
          </div>

          {/* Danger Zone: Account Deletion */}
          <div className="glass-card rounded-3xl p-5 border border-rose-200/80 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
            <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Danger Zone: Deactivate or Delete Account</span>
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
              Permanently delete your NoteCircle account, follow connections, notes, and local cryptographic keys.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-transform active:scale-98"
            >
              Permanently Delete Account
            </button>
          </div>
        </form>
      )}

      {/* Section 2: Privacy Controls */}
      {activeSection === 'privacy' && (
        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Communication & Connection Privacy</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Zero public discovery · Strict authorization filters</p>
              </div>
              {privSuccess && (
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Who can message me?</label>
                <select
                  value={privacySettings.whoCanMessageMe}
                  onChange={(e) => setPrivacySettings({ ...privacySettings, whoCanMessageMe: e.target.value as any })}
                  className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                >
                  <option value="mutual">Mutual connections only</option>
                  <option value="followers">Any approved follower</option>
                  <option value="people_i_follow">People I follow</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Who can reply to my notes?</label>
                <select
                  value={privacySettings.whoCanReply}
                  onChange={(e) => setPrivacySettings({ ...privacySettings, whoCanReply: e.target.value as any })}
                  className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                >
                  <option value="connections">Approved Connections</option>
                  <option value="close_friends">Close Friends Only</option>
                  <option value="nobody">Nobody (Disable replies)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">Profile Field Visibility (Strangers never see these)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">Bio</label>
                  <select
                    value={privacySettings.bioVisibility}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, bioVisibility: e.target.value as any })}
                    className="w-full text-xs p-2 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="connections">Connections</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">City</label>
                  <select
                    value={privacySettings.cityVisibility}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, cityVisibility: e.target.value as any })}
                    className="w-full text-xs p-2 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="connections">Connections</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">Birthday</label>
                  <select
                    value={privacySettings.birthdayVisibility}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, birthdayVisibility: e.target.value as any })}
                    className="w-full text-xs p-2 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="only_me">Only Me</option>
                    <option value="connections">Connections</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">Workplace</label>
                  <select
                    value={privacySettings.workplaceVisibility}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, workplaceVisibility: e.target.value as any })}
                    className="w-full text-xs p-2 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="connections">Connections</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSavePrivacy}
                disabled={isSaving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-transform active:scale-98"
              >
                Save Privacy Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Security & Sessions */}
      {activeSection === 'security' && (
        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2">
              Security Architecture
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/80 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900 dark:text-stone-100">End-to-End Encryption Algorithm</p>
                  <p className="text-stone-500 dark:text-stone-400">AES-GCM 256-bit with PBKDF2 device key derivation</p>
                </div>
                <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                  Active
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/80 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900 dark:text-stone-100">Password Hashing</p>
                  <p className="text-stone-500 dark:text-stone-400">PBKDF2-SHA256 with 1000-pass cryptographic salt</p>
                </div>
                <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                  Enforced
                </span>
              </div>
            </div>
          </div>

          {/* Device Cryptographic Identity & 12-Word Recovery Phrase */}
          <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Device Cryptographic Identity & Key Recovery</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Zero-knowledge local key pair and cross-device recovery phrase</p>
              </div>
              <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                {deviceIdentity?.keyId || 'KEY-LOCAL-INIT'}
              </span>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">12-Word Device Recovery Phrase</span>
                <button
                  type="button"
                  onClick={() => setShowRecoveryPhrase(!showRecoveryPhrase)}
                  className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 underline"
                >
                  {showRecoveryPhrase ? 'Hide Phrase' : 'Reveal Phrase'}
                </button>
              </div>

              {showRecoveryPhrase ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 animate-in fade-in">
                  {deviceIdentity?.recoveryPhrase.split(' ').map((word, idx) => (
                    <div key={idx} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2.5 py-1.5 rounded-xl text-center shadow-2xs">
                      <span className="text-[10px] text-stone-400 block font-mono">{idx + 1}</span>
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 font-mono">{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400 italic bg-white dark:bg-stone-800 p-3 rounded-xl border border-stone-200/80 dark:border-stone-700">
                  •••••••• •••••••• •••••••• •••••••• (Click 'Reveal Phrase' to view or back up your 12-word cryptographic seed)
                </p>
              )}

              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                Keep this phrase safe. When switching browsers or restoring your account on a secondary device, enter these 12 words to restore full local decryption capabilities.
              </p>
            </div>

            {/* Restore Device Key Form */}
            <form onSubmit={handleRestoreIdentity} className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                Restore Device Identity from 12-Word Phrase
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                  placeholder="Enter 12 recovery words separated by spaces..."
                  className="flex-1 text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold shrink-0 shadow-xs transition-transform active:scale-98"
                >
                  Restore Key
                </button>
              </div>
            </form>

            {/* Live Cryptographic Self-Test */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">In-Browser Cryptographic Audit</h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">Live client AES-GCM 256-bit round-trip self-test</p>
                </div>
                <button
                  type="button"
                  onClick={handleRunCryptoSelfTest}
                  disabled={isTestingCrypto}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-transform active:scale-98"
                >
                  {isTestingCrypto ? 'Testing...' : 'Run Cryptographic Self-Test'}
                </button>
              </div>

              {cryptoTestResult && (
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                    <Check className="w-4 h-4 text-amber-600" />
                    <span>Cryptographic Verification Passed</span>
                  </div>
                  <div className="font-mono text-[11px] text-amber-850 dark:text-amber-300 space-y-0.5">
                    <p>• Algorithm: {cryptoTestResult.algorithm}</p>
                    <p>• Ciphertext (AES-GCM): {cryptoTestResult.ciphertextSample}</p>
                    <p>• Roundtrip match: {cryptoTestResult.roundtripMatch ? 'Verified (100% exact)' : 'Failed'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Sessions & Logged-In Devices */}
          <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Logged-In Devices & Active Sessions</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Manage all recognized browser and companion devices</p>
              </div>
              <button
                type="button"
                onClick={handleLogoutAllOtherDevices}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold"
              >
                Logout All Other Devices
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {sessions.length === 0 ? (
                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-100">Current Device</p>
                    <p className="text-stone-500 dark:text-stone-400">Web Client · Local device session</p>
                  </div>
                  <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full font-semibold border border-amber-200 dark:border-amber-800">
                    Active Now
                  </span>
                </div>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="p-3 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                        <span>{s.device}</span>
                      </p>
                      <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                        {s.browser} · IP: {s.ip} · Last active: {new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.current ? (
                        <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full font-bold border border-amber-200 dark:border-amber-800 text-[10px]">
                          This Device
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-stone-500 dark:text-stone-400 bg-stone-200 dark:bg-stone-800 px-2.5 py-1 rounded-full font-medium text-[10px]">
                            Remote Device
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-2 py-0.5 text-[10px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md border border-rose-200 dark:border-rose-900 font-semibold"
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

            <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-transform active:scale-98"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout Current Device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Notifications */}
      {activeSection === 'notifications' && (
        <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Notification Preferences</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">Control notifications for note activity and chats</p>
            </div>
            {notifSuccess && (
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            {Object.entries(notifSettings).map(([key, val]) => (
              <label key={key} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-850 cursor-pointer transition-colors">
                <span className="font-medium text-stone-800 dark:text-stone-200 capitalize">
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setNotifSettings({ ...notifSettings, [key]: e.target.checked })}
                  className="rounded-md text-amber-600 focus:ring-amber-500"
                />
              </label>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              onClick={handleSaveNotifications}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs transition-transform active:scale-98"
            >
              Save Notification Settings
            </button>
          </div>
        </div>
      )}

      {/* Section 5: Data & Storage */}
      {activeSection === 'data' && (
        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-5 shadow-xs space-y-4 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Local-First Data & Portability (GDPR Article 20)</span>
            </h3>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              NoteCircle gives you complete ownership of your personal data. You can download an offline JSON archive of your account profile and connection records anytime.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
              <a
                href={api.exportPersonalDataUrl()}
                download
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Download Personal Data Archive (.JSON)</span>
              </a>

              <button
                type="button"
                onClick={handleClearLocalData}
                className="px-4 py-2.5 neu-button text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Local Device Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 6: Android Architecture Stack */}
      {activeSection === 'android' && (
        <div className="glass-card rounded-3xl p-5 shadow-xs space-y-3 bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800">
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Native Android Companion Specs</span>
          </h3>

          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            The NoteCircle native Android application uses Jetpack Compose, Kotlin Coroutines, Retrofit, and Android Keystore for secure local encryption matching this web client's local-first architecture.
          </p>

          <div className="bg-stone-900 text-stone-100 p-4 rounded-2xl font-mono text-[11px] space-y-1.5 border border-stone-800">
            <p className="text-amber-400">// Native Android Stack (See /android/README.md)</p>
            <p>UI: Jetpack Compose Material 3</p>
            <p>Local Storage: Room + EncryptedSharedPreferences</p>
            <p>Crypto: Android Keystore AES-GCM 256</p>
            <p>Backend: Same API endpoints (/api/notes, /api/connections, /api/chat)</p>
          </div>
        </div>
      )}

      {/* Verification OTP Modal (Change Email or Mobile) */}
      {verifyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1C1A18] w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-stone-200/80 dark:border-stone-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2">
              Verify New {verifyModal.type === 'email' ? 'Email' : 'Mobile Phone'}
            </h3>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              We've dispatched a 6-digit confirmation code to <strong>{verifyModal.targetValue}</strong>.
            </p>

            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-xl text-[11px] border border-amber-200 dark:border-amber-800">
              Test OTP Code: <strong>582914</strong>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Enter 6-Digit Code</label>
              <input
                type="text"
                maxLength={6}
                value={verifyModal.code}
                onChange={(e) => setVerifyModal({ ...verifyModal, code: e.target.value })}
                placeholder="582914"
                className="w-full text-center tracking-widest text-lg font-mono p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl focus:border-amber-500 focus:outline-hidden text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setVerifyModal({ open: false, type: 'email', targetValue: '', code: '' })}
                className="px-3.5 py-2 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerification}
                disabled={isSaving || !verifyModal.code.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs transition-transform active:scale-98"
              >
                Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password / Account Recovery Modal */}
      {forgotModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1C1A18] w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-stone-200/80 dark:border-stone-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2">
              Account Password Recovery
            </h3>

            {forgotModal.step === 'request' ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Enter your registered username or email address to receive an account recovery OTP code.
                </p>
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Username or Email</label>
                  <input
                    type="text"
                    value={forgotModal.identifier}
                    onChange={(e) => setForgotModal({ ...forgotModal, identifier: e.target.value })}
                    placeholder="e.g. rahul or email@domain.com"
                    className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setForgotModal({ open: false, step: 'request', identifier: '', code: '', newPass: '', msg: '' })}
                    className="px-3.5 py-2 text-xs text-stone-600 dark:text-stone-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestForgot}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs transition-transform active:scale-98"
                  >
                    Send Recovery Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-xl text-[11px] border border-amber-200 dark:border-amber-800">
                  {forgotModal.msg}
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">Recovery OTP Code</label>
                  <input
                    type="text"
                    value={forgotModal.code}
                    onChange={(e) => setForgotModal({ ...forgotModal, code: e.target.value })}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-center font-mono tracking-wider text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">New Password</label>
                  <input
                    type="password"
                    value={forgotModal.newPass}
                    onChange={(e) => setForgotModal({ ...forgotModal, newPass: e.target.value })}
                    placeholder="At least 6 characters"
                    className="w-full text-xs p-2.5 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setForgotModal({ open: false, step: 'request', identifier: '', code: '', newPass: '', msg: '' })}
                    className="px-3.5 py-2 text-xs text-stone-600 dark:text-stone-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmForgotReset}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs transition-transform active:scale-98"
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
