import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  Check, 
  X, 
  Lock, 
  Clock, 
  UserCheck, 
  Users, 
  AlertCircle,
  Loader2,
  ShieldCheck,
  UserX
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import type { PublicUserProfile } from '../types/index.ts';

interface SearchAndConnectionsProps {
  onOpenProfile: (username: string) => void;
  onOpenChatWithUser: (userId: string) => void;
}

export const SearchAndConnections: React.FC<SearchAndConnectionsProps> = ({
  onOpenProfile,
  onOpenChatWithUser
}) => {
  const { currentUser, refreshNotifications } = useAuth();
  const [activeTab, setActiveTab] = useState<'search' | 'requests' | 'following'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [pendingIncoming, setPendingIncoming] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<any[]>([]);
  const [connectionsList, setConnectionsList] = useState<PublicUserProfile[]>([]);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConnectionsData = async () => {
    try {
      const res = await api.getPendingRequests();
      setPendingIncoming(res.incoming);
      setPendingOutgoing(res.outgoing);

      const connRes = await api.getConnectionsList();
      setConnectionsList(connRes.connections || []);
    } catch (err) {
      console.error('Failed to load connections data:', err);
    }
  };

  useEffect(() => {
    fetchConnectionsData();
  }, [currentUser]);

  // Real Debounced Username Search
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setSearchError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.searchUsers(value.trim());
        setSearchResults(res.users);
      } catch (err: any) {
        setSearchError(err.message || 'Failed to search users');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  const handleSendFollowRequest = async (targetUserId: string) => {
    setActionInProgress((prev) => ({ ...prev, [targetUserId]: true }));
    try {
      await api.sendFollowRequest(targetUserId);
      // Update local item state to pending
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, isPendingRequest: true } : u))
      );
      await fetchConnectionsData();
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Failed to send follow request');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.acceptFollowRequest(requestId);
      await fetchConnectionsData();
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Failed to accept');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.rejectFollowRequest(requestId);
      await fetchConnectionsData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject');
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!confirm('Unfollow this user? You will no longer see their private status notes.')) return;
    try {
      await api.unfollow(targetUserId);
      setConnectionsList((prev) => prev.filter((u) => u.id !== targetUserId));
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, isConnection: false, isPendingRequest: false } : u))
      );
      await fetchConnectionsData();
    } catch (err: any) {
      alert(err.message || 'Failed to unfollow');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      
      {/* Top Header & Segmented Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'neu-button text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find People</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'neu-button text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <span>Follow Requests</span>
            {pendingIncoming.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingIncoming.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('following')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'following'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'neu-button text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            My Connections ({connectionsList.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Username Search */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          
          {/* Search Input Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search by exact username or prefix (e.g. rahul, priya, amit, testuser)..."
              className="w-full pl-11 pr-10 py-3 text-xs sm:text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-500 shadow-xs"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin absolute right-4 top-3.5" />
            )}
          </div>

          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold">Privacy-First Discovery Guarantee:</span> NoteCircle has zero public explore feeds. Searching a username returns strictly minimal identification (Display Name, @username, Private Account status). No notes, followers, or personal activity are ever exposed to strangers.
            </div>
          </div>

          {searchError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Search Results List */}
          <div className="space-y-2.5 pt-1">
            {isSearching ? (
              <div className="text-center py-12 text-xs text-stone-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span>Searching user directory...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => {
                const isLoadingAction = actionInProgress[user.id] || false;

                return (
                  <div
                    key={user.id}
                    className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 transition-all"
                  >
                    <div 
                      onClick={() => onOpenProfile(user.username)}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">{user.displayName}</p>
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-0.5 font-medium bg-stone-100 dark:bg-stone-800 px-1.5 py-0.2 rounded-full">
                            <Lock className="w-2.5 h-2.5" /> Private Account
                          </span>
                        </div>
                        <p className="text-xs text-stone-400">@{user.username}</p>
                        
                        {!user.isConnection && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 italic">
                            "Follow to see notes."
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {user.isConnection ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 rounded-xl font-semibold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </span>
                          <button
                            onClick={() => onOpenChatWithUser(user.id)}
                            className="px-3 py-1.5 rounded-xl neu-button text-xs font-semibold text-stone-700 dark:text-stone-300"
                          >
                            Chat
                          </button>
                        </div>
                      ) : user.isPendingRequest ? (
                        <span className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 rounded-xl font-semibold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Requested</span>
                        </span>
                      ) : user.hasIncomingRequest ? (
                        <span className="text-xs text-sky-800 bg-sky-50 dark:bg-sky-950/60 px-3 py-1.5 rounded-xl font-semibold border border-sky-200 dark:border-sky-800">
                          Requested to follow you
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendFollowRequest(user.id)}
                          disabled={isLoadingAction}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-transform active:scale-98 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isLoadingAction ? 'Sending...' : 'Request Follow'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : searchQuery.trim() ? (
              <div className="text-center py-12 glass-card rounded-3xl border border-slate-200 text-xs text-slate-400">
                No private accounts found matching "@{searchQuery}".
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Type an exact username or prefix above to search your circle.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Incoming Follow Requests ({pendingIncoming.length})
            </h3>

            {pendingIncoming.length === 0 ? (
              <div className="p-8 glass-card rounded-3xl border border-slate-200 text-center">
                <Users className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No new follow requests right now.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When someone requests to join your circle, you'll see them here to approve or reject.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 glass-card rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      {req.requester && (
                        <UserAvatar
                          name={req.requester.displayName}
                          src={req.requester.avatarUrl}
                          size="md"
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {req.requester?.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          @{req.requester?.username} · 🔒 Private
                        </p>
                        {req.requester?.bio && (
                          <p className="text-xs text-slate-600 italic mt-0.5 line-clamp-1">
                            "{req.requester.bio}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="px-3 py-1.5 neu-button text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium"
                      >
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          {pendingOutgoing.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Sent Follow Requests Pending ({pendingOutgoing.length})
              </h3>
              <div className="space-y-2">
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 glass-card rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {req.target && (
                        <UserAvatar name={req.target.displayName} src={req.target.avatarUrl} size="sm" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900">{req.target?.displayName}</p>
                        <p className="text-[11px] text-slate-400">@{req.target?.username}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                      Pending approval
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Connections */}
      {activeTab === 'following' && (
        <div className="space-y-3">
          {connectionsList.length === 0 ? (
            <div className="p-8 glass-card rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
              No approved connections in your circle yet.
            </div>
          ) : (
            connectionsList.map((user) => (
              <div key={user.id} className="p-4 glass-card rounded-2xl flex items-center justify-between">
                <div 
                  onClick={() => onOpenProfile(user.username)}
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                    <p className="text-[11px] text-slate-400">@{user.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenChatWithUser(user.id)}
                    className="px-3 py-1.5 neu-button text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => handleUnfollow(user.id)}
                    className="px-3 py-1.5 neu-button text-rose-600 text-xs font-semibold rounded-xl hover:bg-rose-50"
                  >
                    Unfollow
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
