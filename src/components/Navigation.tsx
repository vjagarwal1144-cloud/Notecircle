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
  hideBottomNav?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateNote,
  onOpenNotifications,
  onOpenAvailability,
  onOpenBugReport,
  onOpenSupport,
  hideBottomNav = false
}) => {
  const { 
    currentUser, 
    isOnline,
    isDarkMode,
    toggleDarkMode,
    logout, 
    unreadNotifsCount, 
    androidPreview, 
    toggleAndroidPreview 
  } = useAuth();
  
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <>
      {/* Top Neo-Brutalist Navigation Bar for Desktop & Mobile Header */}
      <header className="sticky top-0 z-30 bg-[#FAF7F0]/95 dark:bg-[#0D0D12]/95 backdrop-blur-md border-b-2.5 border-stone-900 dark:border-stone-750 transition-colors">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Zone 1: Wordmark & Live Signal */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              onClick={() => setActiveTab('feed')}
              className="group text-lg sm:text-xl font-black tracking-tight text-stone-950 dark:text-stone-50 flex items-center gap-2.5 hover:opacity-95 transition-transform active:scale-95 cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400 text-stone-950 border-2.5 border-stone-900 dark:border-stone-100 flex items-center justify-center text-xs sm:text-sm font-black shadow-[2.5px_2.5px_0px_0px_#121217] dark:shadow-[2.5px_2.5px_0px_0px_#CDFF00] group-hover:rotate-[-3deg] transition-transform">
                NC
              </div>
              <div className="flex flex-col text-left">
                <span className="font-display font-black leading-none text-base sm:text-lg">NoteCircle</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 leading-tight">Private Circle</span>
              </div>
            </button>

            {/* Clickable Live Availability Badge */}
            {currentUser?.availability && (
              <button
                onClick={onOpenAvailability}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#1A1A24] border-2 border-stone-900 dark:border-stone-700 text-xs font-black text-stone-900 dark:text-stone-100 shadow-[2px_2px_0px_0px_#121217] dark:shadow-[2px_2px_0px_0px_#2B2B3C] hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-all cursor-pointer"
                title="Change your availability status"
              >
                <span className="text-sm select-none">{currentUser.availability.emoji}</span>
                <span className="truncate max-w-[110px]">{currentUser.availability.label}</span>
                {currentUser.availability.strictDnd && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Strict DND active" />
                )}
              </button>
            )}

            {!isOnline && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-black text-stone-950 bg-amber-300 border-2 border-stone-900 px-2 py-0.5 rounded-lg shadow-[2px_2px_0px_0px_#121217]">
                <WifiOff className="w-3 h-3" /> Offline Mode
              </span>
            )}
          </div>

          {/* Zone 2: Navigation Links (Segmented Neo-Brutalist Control) */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-stone-200/80 dark:bg-[#161622] rounded-2xl border-2 border-stone-900 dark:border-stone-700 text-xs font-black shadow-[2.5px_2.5px_0px_0px_#121217] dark:shadow-[2.5px_2.5px_0px_0px_#050508]">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217] font-black scale-[1.02]'
                  : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white border-2 border-transparent'
              }`}
            >
              Circle Stream
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217] font-black scale-[1.02]'
                  : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white border-2 border-transparent'
              }`}
            >
              My Notes
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217] font-black scale-[1.02]'
                  : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white border-2 border-transparent'
              }`}
            >
              Private Chat
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'connections'
                  ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217] font-black scale-[1.02]'
                  : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white border-2 border-transparent'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Circle Finder</span>
            </button>
            {currentUser?.isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-rose-500 text-white border-2 border-stone-900 shadow-[2px_2px_0px_0px_#121217] font-black'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 border-2 border-transparent'
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Zone 3: Actions & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A24]"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-900" />}
            </button>

            {/* Quick Android Frame Toggle */}
            <button
              onClick={toggleAndroidPreview}
              title={androidPreview ? 'Exit to Desktop View' : 'Preview Android Shell'}
              className="hidden sm:inline-flex p-2 neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A24] text-xs font-black items-center gap-1.5"
            >
              {androidPreview ? <Monitor className="w-4 h-4 text-amber-600" /> : <Smartphone className="w-4 h-4" />}
              <span className="hidden xl:inline">{androidPreview ? 'Desktop' : 'Android'}</span>
            </button>

            {/* Support / Help (Desktop / Tablet) */}
            <button
              onClick={onOpenSupport}
              className="hidden lg:inline-flex p-2 neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A24]"
              title="Help, Safety & Policies"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Bug Report (Desktop / Tablet) */}
            <button
              onClick={onOpenBugReport}
              className="hidden lg:inline-flex p-2 neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A24]"
              title="Report Bug / Feedback"
            >
              <Bug className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <button
              onClick={onOpenNotifications}
              className="p-2 neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A24] relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white border-1.5 border-stone-900 rounded-full text-[9px] font-black flex items-center justify-center">
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Post Note CTA */}
            <button
              onClick={onOpenCreateNote}
              className="px-3 sm:px-4 py-2 neo-btn-primary text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Post temporary note to your circle"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Post Note</span>
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 p-1 rounded-2xl border-2 border-stone-900 dark:border-stone-700 bg-white dark:bg-[#1A1A24] shadow-[2px_2px_0px_0px_#121217] dark:shadow-[2px_2px_0px_0px_#2A2A38] hover:translate-y-[-1px] transition-all cursor-pointer"
                aria-expanded={showUserDropdown}
              >
                {currentUser && (
                  <UserAvatar name={currentUser.displayName} src={currentUser.avatarUrl} size="sm" />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300 pr-0.5" />
              </button>

              {showUserDropdown && (
                <div 
                  className="absolute right-0 mt-2.5 w-76 neo-card p-3 z-50 animate-in fade-in zoom-in-95 duration-100 shadow-[6px_6px_0px_0px_#121217] dark:shadow-[6px_6px_0px_0px_#050508]"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <div className="px-3 py-2 bg-amber-50 dark:bg-[#20202E] border-2 border-stone-900 dark:border-stone-700 rounded-xl mb-2">
                    <p className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                      {currentUser?.displayName}
                    </p>
                    <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400 truncate">
                      @{currentUser?.username} · 🔒 Encrypted
                    </p>
                    {currentUser?.availability && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-300">
                        <span>{currentUser.availability.emoji}</span>
                        <span>{currentUser.availability.label}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={onOpenAvailability}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl flex items-center justify-between border border-transparent hover:border-stone-900 transition-all cursor-pointer"
                    >
                      <span>Set Availability Status</span>
                      <span className="text-xs">✨</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl flex items-center justify-between border border-transparent hover:border-stone-900 transition-all cursor-pointer"
                    >
                      <span>My Profile</span>
                      <span className="text-xs">👤</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl flex items-center justify-between border border-transparent hover:border-stone-900 transition-all cursor-pointer"
                    >
                      <span>Settings & Privacy</span>
                      <Settings className="w-3.5 h-3.5 text-stone-500" />
                    </button>
                    <button
                      onClick={toggleAndroidPreview}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl flex items-center justify-between border border-transparent hover:border-stone-900 transition-all cursor-pointer"
                    >
                      <span>{androidPreview ? 'Exit Android Shell' : 'Android Native Frame'}</span>
                      <Smartphone className="w-3.5 h-3.5 text-stone-500" />
                    </button>
                    <button
                      onClick={onOpenSupport}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl flex items-center justify-between border border-transparent hover:border-stone-900 transition-all cursor-pointer"
                    >
                      <span>Help & Safety</span>
                      <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
                    </button>
                    <button
                      onClick={onOpenBugReport}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl flex items-center justify-between border border-transparent hover:border-stone-900 transition-all cursor-pointer"
                    >
                      <span>Report Bug / Feedback</span>
                      <Bug className="w-3.5 h-3.5 text-stone-500" />
                    </button>
                  </div>

                  <div className="border-t-2 border-stone-200 dark:border-stone-750 pt-2 mt-1">
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-xl flex items-center gap-2 border border-transparent hover:border-rose-600 transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out & Wipe Keys</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* NoteCircle Floating Neo-Brutalist Cyber-Dock for Mobile Screens */}
      {!hideBottomNav && (
        <nav 
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto z-40 neo-dock px-2.5 py-2 pb-[calc(0.55rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around transition-all"
        >
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-amber-400 text-stone-950 font-black scale-105 border-2 border-stone-950 shadow-[2px_2px_0px_#000]'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Feed"
          >
            <Home className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-black mt-0.5 tracking-tight">Stream</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-amber-400 text-stone-950 font-black scale-105 border-2 border-stone-950 shadow-[2px_2px_0px_#000]'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="My Notes"
          >
            <StickyNote className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-black mt-0.5 tracking-tight">Notes</span>
          </button>

          {/* Center Elevated Action Button (Post Note) */}
          <button
            onClick={onOpenCreateNote}
            className="flex flex-col items-center justify-center p-2 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-300 text-stone-950 border-2.5 border-stone-950 shadow-[0_0_12px_rgba(255,184,0,0.4),2px_2px_0px_#000] -translate-y-2 hover:-translate-y-2.5 active:translate-y-0 transition-transform cursor-pointer"
            aria-label="Create Note"
            title="Create Note"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all relative cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-amber-400 text-stone-950 font-black scale-105 border-2 border-stone-950 shadow-[2px_2px_0px_#000]'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Private Chat"
          >
            <MessageSquare className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-black mt-0.5 tracking-tight">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('connections')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'connections'
                ? 'bg-amber-400 text-stone-950 font-black scale-105 border-2 border-stone-950 shadow-[2px_2px_0px_#000]'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Search and Connections"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-black mt-0.5 tracking-tight">Circle</span>
          </button>
        </nav>
      )}
    </>
  );
};
