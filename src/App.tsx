import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navigation } from './components/Navigation.tsx';
import { HomeFeed } from './components/HomeFeed.tsx';
import { NotesHistory } from './components/NotesHistory.tsx';
import { ChatView } from './components/ChatView.tsx';
import { SearchAndConnections } from './components/SearchAndConnections.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { CreateNoteModal } from './components/CreateNoteModal.tsx';
import { NotificationsModal } from './components/NotificationsModal.tsx';
import { AvailabilityModal } from './components/AvailabilityModal.tsx';
import { BugReportModal } from './components/BugReportModal.tsx';
import { SupportModal } from './components/SupportModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AndroidFrame } from './components/AndroidFrame.tsx';
import { ShieldCheck, UserPlus, LogIn } from 'lucide-react';

function MainApp() {
  const { currentUser, switchableUsers, switchUser, androidPreview } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [viewingProfileUsername, setViewingProfileUsername] = useState<string | null>(null);
  const [activeChatUserId, setActiveChatUserId] = useState<string | undefined>(undefined);
  
  // Modals state
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleOpenProfile = (username: string) => {
    setViewingProfileUsername(username);
    setActiveTab('profile');
  };

  const handleOpenChatWithUser = (userId: string) => {
    setActiveChatUserId(userId);
    setActiveTab('chat');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'feed':
        return (
          <HomeFeed
            onOpenCreateNote={() => setIsCreateNoteOpen(true)}
            onOpenAvailability={() => setIsAvailabilityOpen(true)}
            onOpenChatWithUser={handleOpenChatWithUser}
            onOpenProfile={handleOpenProfile}
          />
        );
      case 'notes':
        return (
          <NotesHistory
            onOpenCreateNote={() => setIsCreateNoteOpen(true)}
          />
        );
      case 'chat':
        return (
          <ChatView
            initialUserId={activeChatUserId}
          />
        );
      case 'connections':
        return (
          <SearchAndConnections
            onOpenProfile={handleOpenProfile}
            onOpenChatWithUser={handleOpenChatWithUser}
          />
        );
      case 'profile':
        return (
          <ProfileView
            username={viewingProfileUsername || currentUser?.username}
            onOpenChatWithUser={handleOpenChatWithUser}
            onOpenCreateNote={() => setIsCreateNoteOpen(true)}
          />
        );
      case 'settings':
        return (
          <SettingsView
            onOpenSupport={() => setIsSupportOpen(true)}
            onOpenBugReport={() => setIsBugReportOpen(true)}
          />
        );
      case 'admin':
        return <AdminPanel />;
      default:
        return (
          <HomeFeed
            onOpenCreateNote={() => setIsCreateNoteOpen(true)}
            onOpenAvailability={() => setIsAvailabilityOpen(true)}
            onOpenChatWithUser={handleOpenChatWithUser}
            onOpenProfile={handleOpenProfile}
          />
        );
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#131211] text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors">
        <aside aria-label="Privacy testing bar" className="bg-stone-900 text-stone-200 text-xs py-1.5 px-4 border-b border-stone-800">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> NoteCircle Local-First Sandbox
              </span>
              <span className="text-stone-500 hidden sm:inline">|</span>
              <span className="text-stone-400">
                Not logged in
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-400 mr-1 hidden lg:inline">Quick Test Accounts:</span>
              {switchableUsers.slice(0, 4).map((u) => (
                <button
                  key={u.id}
                  onClick={() => switchUser(u.id)}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                  title={`Sign in as ${u.displayName}`}
                >
                  {u.displayName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6 animate-in fade-in">
            <div className="w-16 h-16 bg-linear-to-br from-amber-500 to-amber-700 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight font-display">NoteCircle</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 max-w-sm mx-auto leading-relaxed">
                Real-time ephemeral notes & end-to-end encrypted private messaging. Local-first, zero plaintext server storage.
              </p>
            </div>

            <div className="p-6 glass-card border border-amber-900/10 dark:border-white/10 rounded-3xl shadow-sm space-y-3">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Create Account</span>
              </button>
            </div>
          </div>
        </main>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#131211] text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors">
      
      {/* Top Test Sandbox Bar (Lets user switch between personas or create a completely fresh user) */}
      <aside aria-label="Privacy testing bar" className="bg-stone-900 text-stone-200 text-xs py-1.5 px-4 border-b border-stone-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> NoteCircle Local-First Sandbox
            </span>
            <span className="text-stone-500 hidden sm:inline">|</span>
            <span className="text-stone-300">
              Active: <strong>{currentUser?.displayName}</strong> (@{currentUser?.username})
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[11px] text-stone-400 mr-1 hidden lg:inline">Switch Perspective:</span>
            {switchableUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  switchUser(u.id);
                  setViewingProfileUsername(null);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                  currentUser?.id === u.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                }`}
                title={`Switch to ${u.displayName}`}
              >
                <span>{u.displayName.split(' ')[0]}</span>
                {u.isAdmin && <span className="text-[9px] text-rose-300 font-bold">*</span>}
              </button>
            ))}

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-amber-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 ml-1"
              title="Register a completely new private user"
            >
              <UserPlus className="w-3 h-3" />
              <span>New Account</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Glassmorphic Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setViewingProfileUsername(null);
          setActiveTab(tab);
        }}
        onOpenCreateNote={() => setIsCreateNoteOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAvailability={() => setIsAvailabilityOpen(true)}
        onOpenBugReport={() => setIsBugReportOpen(true)}
        onOpenSupport={() => setIsSupportOpen(true)}
      />

      {/* Core Body: Responsive Web or Android Device Shell */}
      <main className="flex-1 pb-16 md:pb-6">
        {androidPreview ? (
          <AndroidFrame
            activeTitle={
              activeTab === 'feed' ? 'Circle Feed' :
              activeTab === 'notes' ? 'My Notes' :
              activeTab === 'chat' ? 'Private Chat' :
              activeTab === 'connections' ? 'Find People' :
              activeTab === 'profile' ? `@${viewingProfileUsername || currentUser?.username}` :
              activeTab === 'settings' ? 'Settings' : 'Admin'
            }
            onBack={viewingProfileUsername ? () => setViewingProfileUsername(null) : undefined}
          >
            {renderTabContent()}
          </AndroidFrame>
        ) : (
          renderTabContent()
        )}
      </main>

      {/* Modals */}
      <CreateNoteModal
        isOpen={isCreateNoteOpen}
        onClose={() => setIsCreateNoteOpen(false)}
        onNoteCreated={() => {
          setActiveTab('feed');
        }}
      />

      <AvailabilityModal
        isOpen={isAvailabilityOpen}
        onClose={() => setIsAvailabilityOpen(false)}
      />

      <BugReportModal
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        onOpenBugReport={() => setIsBugReportOpen(true)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onSelectAction={(notif) => {
          setIsNotificationsOpen(false);
          if (notif.type === 'follow_request') {
            setActiveTab('connections');
          } else if (notif.type === 'message') {
            setActiveTab('chat');
          } else {
            setActiveTab('feed');
          }
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
