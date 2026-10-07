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
  const { currentUser, androidPreview } = useAuth();
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
  const [isChatActiveOnMobile, setIsChatActiveOnMobile] = useState(false);

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
            onActiveConversationChange={setIsChatActiveOnMobile}
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
      <div className="min-h-screen bg-[#FFFDF9] dark:bg-[#0E0E14] text-stone-950 dark:text-stone-50 flex flex-col font-sans transition-colors relative overflow-hidden">
        {/* Playful Neo-Brutalist background geometric shapes */}
        <div className="absolute top-12 left-10 w-24 h-24 rounded-full border-3 border-stone-900 bg-amber-300 -rotate-12 pointer-events-none hidden sm:block opacity-60 shadow-[4px_4px_0px_#121217]" />
        <div className="absolute bottom-16 right-12 w-28 h-28 rounded-3xl border-3 border-stone-900 bg-rose-400 rotate-12 pointer-events-none hidden sm:block opacity-60 shadow-[4px_4px_0px_#121217]" />
        <div className="absolute top-1/3 right-8 w-16 h-16 border-3 border-stone-900 bg-emerald-400 rotate-45 pointer-events-none hidden sm:block opacity-60 shadow-[3px_3px_0px_#121217]" />

        <main className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="max-w-md w-full text-center space-y-6 animate-in fade-in">
            <div className="inline-flex items-center justify-center">
              <div className="w-20 h-20 bg-amber-400 border-3 border-stone-900 rounded-3xl flex items-center justify-center shadow-[6px_6px_0px_#121217] -rotate-3 hover:rotate-0 transition-transform">
                <span className="font-display font-black text-3xl tracking-tighter text-stone-950">NC</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-block">
                <span className="neo-badge bg-stone-950 text-white text-[11px] font-black uppercase tracking-wider mb-2">
                  Privacy-First Social
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-stone-950 dark:text-white tracking-tight font-display uppercase">
                NoteCircle
              </h1>
              <p className="text-xs sm:text-sm font-bold text-stone-600 dark:text-stone-400 mt-2 max-w-sm mx-auto leading-relaxed">
                Quiet status notes, live availability signals, and end-to-end encrypted messaging for your trusted circle. No ads. No feeds engineered for doomscrolling.
              </p>
            </div>

            <div className="p-6 sm:p-7 neo-card bg-white dark:bg-[#161622] shadow-[8px_8px_0px_#121217] space-y-4">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-3.5 px-6 neo-btn-primary rounded-2xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <LogIn className="w-4 h-4 stroke-[3]" />
                <span>Enter Your Private Circle</span>
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-black text-stone-700 dark:text-stone-300 pt-2 border-t-2 border-stone-900 dark:border-stone-800">
                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-950/80 border border-stone-900 rounded-lg">🔒 Zero Telemetry</span>
                <span className="px-2 py-0.5 bg-rose-200 dark:bg-rose-950/80 border border-stone-900 rounded-lg">⏳ Auto-Expiring Notes</span>
                <span className="px-2 py-0.5 bg-emerald-200 dark:bg-emerald-950/80 border border-stone-900 rounded-lg">🛡️ E2E Encrypted</span>
              </div>
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
        hideBottomNav={activeTab === 'chat' && isChatActiveOnMobile}
      />

      {/* Core Body: Responsive Web or Android Device Shell */}
      <main className={`flex-1 ${(activeTab === 'chat' && isChatActiveOnMobile) ? 'pb-0' : 'pb-24 md:pb-8'} w-full max-w-full overflow-x-hidden`}>
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
