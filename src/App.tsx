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
import { ShieldCheck, LogIn } from 'lucide-react';

function MainApp() {
  const { currentUser, androidPreview, switchUser } = useAuth();
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
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6 animate-in fade-in">
            <div className="w-16 h-16 bg-linear-to-br from-amber-500 to-amber-700 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight font-display">NoteCircle</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 max-w-sm mx-auto leading-relaxed">
                Your private digital life with the people who actually matter. Real-time ephemeral notes & end-to-end encrypted messaging.
              </p>
            </div>

            <div className="p-6 glass-card border border-amber-900/10 dark:border-white/10 rounded-3xl shadow-sm space-y-4">
              <button
                onClick={() => switchUser('rahul')}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Explore as Rahul Sharma (Default Profile)</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-stone-200 dark:border-stone-800"></div>
                <span className="shrink mx-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">or 1-click persona</span>
                <div className="grow border-t border-stone-200 dark:border-stone-800"></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => switchUser('priya')}
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-500 bg-white dark:bg-stone-900 text-left transition-colors cursor-pointer"
                >
                  <div className="text-base">🏺</div>
                  <div className="font-bold text-[11px] text-stone-800 dark:text-stone-200 truncate mt-0.5">Priya Patel</div>
                  <div className="text-[10px] text-stone-400">Close Friend</div>
                </button>
                <button
                  onClick={() => switchUser('amit')}
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-500 bg-white dark:bg-stone-900 text-left transition-colors cursor-pointer"
                >
                  <div className="text-base">🎧</div>
                  <div className="font-bold text-[11px] text-stone-800 dark:text-stone-200 truncate mt-0.5">Amit Verma</div>
                  <div className="text-[10px] text-stone-400">Friend</div>
                </button>
                <button
                  onClick={() => switchUser('admin')}
                  className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-500 bg-white dark:bg-stone-900 text-left transition-colors cursor-pointer"
                >
                  <div className="text-base">🛡️</div>
                  <div className="font-bold text-[11px] text-stone-800 dark:text-stone-200 truncate mt-0.5">Safety Admin</div>
                  <div className="text-[10px] text-stone-400">Moderator</div>
                </button>
              </div>

              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-2.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Sign In with Credentials / Create Account
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
          // If in feed, trigger feed refresh or switch to feed
          if (activeTab === 'feed') {
            window.dispatchEvent(new CustomEvent('notecircle:note_created'));
          }
        }}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenChat={(userId) => {
          setIsNotificationsOpen(false);
          handleOpenChatWithUser(userId);
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
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
