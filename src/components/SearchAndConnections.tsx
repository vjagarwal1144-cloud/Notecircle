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
  const { currentUser, refreshNotifications, isUserOnline } = useAuth();
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
    <div className="max-w-3xl mx-auto px-3.5 sm:px-4 py-5 space-y-6">
      
      {/* Top Header & Neo-Brutalist Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-stone-100 dark:bg-[#12121A] border-2.5 border-stone-900 dark:border-stone-750 rounded-2xl shadow-[3px_3px_0px_#121217]">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'search'
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Find People</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <span>Requests</span>
          {pendingIncoming.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black border border-stone-900 flex items-center justify-center">
              {pendingIncoming.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('following')}
          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'following'
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <span>Circle ({connectionsList.length})</span>
        </button>
      </div>

      {/* Tab 1: Username Search */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          
          {/* Neo-Brutalist Search Input Bar */}
          <div className="relative">
            <Search className="w-5 h-5 text-stone-500 absolute left-4 top-3.5 stroke-[2.5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search exact username or handle (rahul, priya, test)..."
              className="w-full pl-12 pr-10 py-3.5 text-xs sm:text-sm font-bold neo-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin absolute right-4 top-3.5" />
            )}
          </div>

          <div className="p-3.5 bg-amber-100/70 dark:bg-amber-950/40 border-2 border-stone-900 dark:border-stone-750 rounded-2xl flex items-start gap-3 text-xs text-stone-900 dark:text-stone-200 shadow-[2px_2px_0px_#121217]">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 stroke-[2.5]" />
            <div className="leading-snug font-medium">
              <strong className="font-black text-stone-950 dark:text-amber-300">Privacy Guarantee:</strong> NoteCircle has zero public explore feeds. Searching a username returns strictly minimal verification (Display Name, @username, Private Circle status). Your notes are never revealed to strangers.
            </div>
          </div>

          {searchError && (
            <div className="p-3 bg-rose-200 dark:bg-rose-950/50 border-2 border-stone-900 rounded-2xl text-xs font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2 shadow-[2px_2px_0px_#121217]">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Search Results List */}
          <div className="space-y-3 pt-1">
            {isSearching ? (
              <div className="text-center py-12 text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Searching directory...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => {
                const isLoadingAction = actionInProgress[user.id] || false;

                return (
                  <div
                    key={user.id}
                    className="neo-card bg-white dark:bg-[#161622] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-[4px_4px_0px_#121217] transition-all"
                  >
                    <div 
                      onClick={() => onOpenProfile(user.username)}
                      className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                    >
                      <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" isOnline={isUserOnline(user.id)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 truncate">{user.displayName}</p>
                          <span className="text-[10px] text-stone-900 dark:text-stone-100 flex items-center gap-0.5 font-bold bg-amber-200 dark:bg-stone-800 border border-stone-900 px-2 py-0.5 rounded-full">
                            <Lock className="w-2.5 h-2.5 stroke-[2.5]" /> Private
                          </span>
                        </div>
                        <p className="text-xs font-bold text-stone-500 dark:text-stone-400">@{user.username}</p>
                        
                        {!user.isConnection && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 font-medium italic">
                            "Connect to view their private notes."
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {user.isConnection ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-950 dark:text-amber-300 bg-amber-300 dark:bg-amber-950/80 px-3 py-1.5 rounded-xl font-black border-2 border-stone-900 flex items-center gap-1 shadow-[2px_2px_0px_#121217]">
                            <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>In Circle</span>
                          </span>
                          <button
                            onClick={() => onOpenChatWithUser(user.id)}
                            className="px-3 py-1.5 rounded-xl neo-btn text-xs font-black text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A28] cursor-pointer"
                          >
                            Chat
                          </button>
                        </div>
                      ) : user.isPendingRequest ? (
                        <span className="text-xs text-stone-900 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl font-bold border-2 border-stone-900 flex items-center gap-1 shadow-[2px_2px_0px_#121217]">
                          <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Requested</span>
                        </span>
                      ) : user.hasIncomingRequest ? (
                        <span className="text-xs text-stone-950 bg-sky-200 dark:bg-sky-900 px-3 py-1.5 rounded-xl font-black border-2 border-stone-900 shadow-[2px_2px_0px_#121217]">
                          Requested you
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendFollowRequest(user.id)}
                          disabled={isLoadingAction}
                          className="px-3.5 py-1.5 neo-btn-primary disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{isLoadingAction ? 'Sending...' : 'Request'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : searchQuery.trim() ? (
              <div className="text-center py-12 neo-card bg-white dark:bg-[#161622] rounded-3xl text-xs font-bold text-stone-500">
                No private accounts found matching "@{searchQuery}".
              </div>
            ) : (
              <div className="p-8 text-center text-xs font-bold text-stone-500">
                Type an exact username above to find and connect with friends.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-3">
              Incoming Follow Requests ({pendingIncoming.length})
            </h3>

            {pendingIncoming.length === 0 ? (
              <div className="p-8 neo-card bg-white dark:bg-[#161622] rounded-3xl text-center">
                <Users className="w-8 h-8 text-stone-400 mx-auto mb-2 stroke-[2.5]" />
                <p className="text-xs font-black text-stone-900 dark:text-stone-100">No new follow requests right now.</p>
                <p className="text-[11px] font-medium text-stone-500 mt-1">
                  When someone requests to join your private circle, you can approve or reject them here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 neo-card bg-white dark:bg-[#161622] rounded-2xl flex items-center justify-between gap-3 shadow-[3px_3px_0px_#121217]"
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
                        <p className="text-xs font-black text-stone-900 dark:text-stone-100">
                          {req.requester?.displayName}
                        </p>
                        <p className="text-[11px] font-bold text-stone-500">
                          @{req.requester?.username} · 🔒 Private
                        </p>
                        {req.requester?.bio && (
                          <p className="text-xs text-stone-700 dark:text-stone-300 italic mt-0.5 line-clamp-1">
                            "{req.requester.bio}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        className="px-3.5 py-1.5 neo-btn-primary text-stone-950 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="px-3.5 py-1.5 neo-btn text-stone-800 dark:text-stone-200 bg-white dark:bg-[#1A1A28] rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <span>Reject</span>
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
              <h3 className="text-xs font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-3">
                Sent Requests Pending ({pendingOutgoing.length})
              </h3>
              <div className="space-y-2.5">
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 neo-card bg-white dark:bg-[#161622] rounded-xl flex items-center justify-between shadow-[2px_2px_0px_#121217]"
                  >
                    <div className="flex items-center gap-3">
                      {req.target && (
                        <UserAvatar name={req.target.displayName} src={req.target.avatarUrl} size="sm" />
                      )}
                      <div>
                        <p className="text-xs font-black text-stone-900 dark:text-stone-100">{req.target?.displayName}</p>
                        <p className="text-[11px] font-bold text-stone-500">@{req.target?.username}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-stone-900 dark:text-amber-300 bg-amber-200 dark:bg-amber-950/80 px-2.5 py-1 rounded-full border border-stone-900">
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
            <div className="p-8 neo-card bg-white dark:bg-[#161622] rounded-3xl text-center text-xs font-bold text-stone-500">
              No approved connections in your circle yet.
            </div>
          ) : (
            connectionsList.map((user) => (
              <div key={user.id} className="p-4 neo-card bg-white dark:bg-[#161622] rounded-2xl flex items-center justify-between shadow-[3px_3px_0px_#121217]">
                <div 
                  onClick={() => onOpenProfile(user.username)}
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" isOnline={isUserOnline(user.id)} />
                  <div>
                    <p className="text-xs font-black text-stone-900 dark:text-stone-100">{user.displayName}</p>
                    <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">@{user.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenChatWithUser(user.id)}
                    className="px-3.5 py-1.5 neo-btn text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A28] text-xs font-black rounded-xl cursor-pointer"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => handleUnfollow(user.id)}
                    className="px-3.5 py-1.5 neo-btn text-rose-600 dark:text-rose-400 bg-white dark:bg-[#1A1A28] text-xs font-black rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 cursor-pointer"
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
