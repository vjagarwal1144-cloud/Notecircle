import React, { useState } from 'react';
import { 
  Home, 
  StickyNote, 
  MessageSquare, 
  Users, 
  Settings, 
  Plus, 
  Smartphone, 
  Monitor, 
  LogOut, 
  Check, 
  ChevronDown, 
  Bell, 
  Bug, 
  HelpCircle, 
  WifiOff, 
  Search,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCreateNote: () => void;
  onOpenNotifications: () => void;
  onOpenAvailability: () => void;
  onOpenBugReport: () => void;
  onOpenSupport: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateNote,
  onOpenNotifications,
  onOpenAvailability,
  onOpenBugReport,
  onOpenSupport
}) => {
  const { 
    currentUser, 
    isOnline,
    isDarkMode,
    toggleDarkMode,
    logout, 
    switchUser,
    unreadNotifsCount, 
    androidPreview, 
    toggleAndroidPreview 
  } = useAuth();
  
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <>
      {/* Top Glassmorphic Navigation Bar for Desktop & Tablet */}
      <header className="sticky top-0 z-30 glass-panel border-b border-amber-900/10 dark:border-white/10 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          
          {/* Zone 1: Wordmark & Live Availability Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('feed')}
              className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center text-xs font-black shadow-xs tracking-tighter">
                NC
              </span>
              <span className="font-display font-bold">NoteCircle</span>
            </button>

            {/* Clickable Live Availability Badge */}
            {currentUser?.availability && (
              <button
                onClick={onOpenAvailability}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full neu-button text-xs font-semibold text-stone-800 dark:text-stone-200 hover:border-amber-300"
                title="Change your availability status"
              >
                <span>{currentUser.availability.emoji}</span>
                <span>{currentUser.availability.label}</span>
                {currentUser.availability.strictDnd && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Strict DND enabled" />
                )}
              </button>
            )}

            {!isOnline && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                <WifiOff className="w-3 h-3" /> Offline (Local-First Active)
              </span>
            )}
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-stone-600 dark:text-stone-300">
            <button
              onClick={() => setActiveTab('feed')}
              className={`transition-colors py-1 relative ${
                activeTab === 'feed'
                  ? 'text-amber-700 dark:text-amber-400 font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Circle Feed
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`transition-colors py-1 relative ${
                activeTab === 'notes'
                  ? 'text-amber-700 dark:text-amber-400 font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              My Notes
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`transition-colors py-1 relative ${
                activeTab === 'chat'
                  ? 'text-amber-700 dark:text-amber-400 font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Private Chat
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`transition-colors py-1 relative flex items-center gap-1 ${
                activeTab === 'connections'
                  ? 'text-amber-700 dark:text-amber-400 font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <Search className="w-3 h-3 text-stone-400" />
              <span>Search & Circles</span>
            </button>
            {currentUser?.isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`transition-colors py-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 ${
                  activeTab === 'admin' ? 'font-bold' : ''
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Zone 3: Actions & Profile */}
          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-stone-600 dark:text-stone-300 hover:text-amber-600 rounded-xl neu-button"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
            </button>

            {/* Quick Android Frame Toggle */}
            <button
              onClick={toggleAndroidPreview}
              title={androidPreview ? 'Exit to Desktop View' : 'Preview Android Native Shell'}
              className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 rounded-xl neu-button text-xs font-semibold flex items-center gap-1.5"
            >
              {androidPreview ? <Monitor className="w-4 h-4 text-amber-600" /> : <Smartphone className="w-4 h-4" />}
              <span className="hidden xl:inline">{androidPreview ? 'Desktop' : 'Android'}</span>
            </button>

            {/* Support / Help */}
            <button
              onClick={onOpenSupport}
              className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 rounded-xl neu-button"
              title="Help, Safety & Policies"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Bug Report */}
            <button
              onClick={onOpenBugReport}
              className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 rounded-xl neu-button"
              title="Report Bug / Feedback"
            >
              <Bug className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <button
              onClick={onOpenNotifications}
              className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 rounded-xl neu-button relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            {/* Post Note CTA */}
            <button
              onClick={onOpenCreateNote}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Note</span>
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 p-1 rounded-xl neu-button"
                aria-expanded={showUserDropdown}
              >
                {currentUser && (
                  <UserAvatar name={currentUser.displayName} src={currentUser.avatarUrl} size="sm" />
                )}
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {showUserDropdown && (
                <div 
                  className="absolute right-0 mt-2 w-72 glass-panel rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 shadow-xl"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <div className="px-3 py-2 border-b border-stone-200/50 dark:border-stone-800">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {currentUser?.displayName}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      @{currentUser?.username} · 🔒 Private
                    </p>
                    {currentUser?.availability && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                        <span>{currentUser.availability.emoji}</span>
                        <span>{currentUser.availability.label}</span>
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    <button
                      onClick={onOpenAvailability}
                      className="w-full text-left px-3 py-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Set Availability Status</span>
                      <span className="text-[10px] text-stone-400">🟢 🔴 🌙</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="w-full text-left px-3 py-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-lg flex items-center justify-between"
                    >
                      <span>My Profile</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="w-full text-left px-3 py-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-lg flex items-center justify-between"
                    >
                      <span>Settings & Privacy</span>
                    </button>
                  </div>

                  <div className="border-t border-stone-200/50 dark:border-stone-800 pt-1.5 pb-1">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Switch Test Persona
                    </p>
                    <div className="grid grid-cols-2 gap-1 px-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          switchUser('rahul');
                          setShowUserDropdown(false);
                        }}
                        className={`text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          currentUser?.username === 'rahul'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-bold'
                            : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        🏕️ Rahul (Main)
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          switchUser('priya');
                          setShowUserDropdown(false);
                        }}
                        className={`text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          currentUser?.username === 'priya'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-bold'
                            : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        🏺 Priya (Friend)
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          switchUser('amit');
                          setShowUserDropdown(false);
                        }}
                        className={`text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          currentUser?.username === 'amit'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-bold'
                            : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        🎧 Amit (Friend)
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          switchUser('admin');
                          setShowUserDropdown(false);
                        }}
                        className={`text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          currentUser?.username === 'admin'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-bold'
                            : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        🛡️ Safety Admin
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-stone-200/50 dark:border-stone-800 pt-1">
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-2 font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out & Clear Local Keys</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* NoteCircle Floating Bottom Navigation for Mobile & Small Screens */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto z-40 glass-panel rounded-2xl shadow-xl border border-amber-900/15 dark:border-white/10 px-2 py-1.5 flex items-center justify-around backdrop-blur-xl transition-all"
      >
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'feed'
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold scale-105 shadow-xs'
              : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
          aria-label="Feed"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Circle</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'notes'
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold scale-105 shadow-xs'
              : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
          aria-label="My Notes"
        >
          <StickyNote className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Notes</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all relative ${
            activeTab === 'chat'
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold scale-105 shadow-xs'
              : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
          aria-label="Private Chat"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('connections')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'connections'
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold scale-105 shadow-xs'
              : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
          aria-label="Search and Connections"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Search</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all ${
            activeTab === 'settings'
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold scale-105 shadow-xs'
              : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Settings</span>
        </button>
      </nav>
    </>
  );
};
