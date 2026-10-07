import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Edit3, 
  MessageSquare, 
  ShieldAlert, 
  UserPlus, 
  UserCheck, 
  Clock, 
  Sparkles,
  Users
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import type { PublicUserProfile } from '../types/index.ts';

interface ProfileViewProps {
  username?: string; // if not provided, defaults to currentUser
  onOpenChatWithUser?: (userId: string) => void;
  onOpenCreateNote?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  username,
  onOpenChatWithUser,
  onOpenCreateNote
}) => {
  const { currentUser, refreshUser, isUserOnline } = useAuth();
  const targetUsername = username || currentUser?.username || '';
  const isSelf = Boolean(currentUser && currentUser.username.toLowerCase() === targetUsername.toLowerCase());

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editWorkplace, setEditWorkplace] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await api.getProfile(targetUsername);
      setProfile(res.profile);
      if (isSelf) {
        setEditName(res.profile.displayName);
        setEditBio(res.profile.bio || '');
        setEditCity(res.profile.city || '');
        setEditWorkplace(res.profile.workplace || '');
        setEditBirthday(res.profile.birthday || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUsername, currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({
        displayName: editName,
        bio: editBio,
        city: editCity,
        workplace: editWorkplace,
        birthday: editBirthday
      });
      await refreshUser();
      await fetchProfile();
      setIsEditing(false);
      setNotice({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to update profile' });
    }
  };

  const handleSendFollowRequest = async () => {
    if (!profile) return;
    try {
      await api.sendFollowRequest(profile.id);
      await fetchProfile();
      setNotice({ type: 'success', text: 'Follow request sent!' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to send request' });
    }
  };

  const handleBlock = async () => {
    if (!profile) return;
    try {
      await api.blockUser(profile.id);
      await fetchProfile();
      setNotice({ type: 'success', text: `User @${profile.username} has been blocked.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to block user' });
    }
  };

  const handleReport = async () => {
    if (!profile) return;
    const reason = prompt('Please describe why you are reporting this account:');
    if (!reason || !reason.trim()) return;
    try {
      await api.submitReport({
        targetType: 'user',
        targetId: profile.id,
        reason: 'abuse',
        details: reason
      });
      setNotice({ type: 'success', text: 'Account reported for moderation review.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to report' });
    }
  };

  if (isLoading) {
    return <div className="text-center py-16 text-xs text-stone-400">Loading private profile...</div>;
  }

  if (!profile) {
    return <div className="text-center py-16 text-xs text-stone-400">User not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {notice && (
        <div className={`p-3 text-xs rounded-xl border flex items-center justify-between animate-in fade-in ${
          notice.type === 'success'
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900'
        }`}>
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[10px] font-bold uppercase underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="neo-card bg-white dark:bg-[#161622] p-6 shadow-[5px_5px_0px_0px_#121217] dark:shadow-[5px_5px_0px_0px_#050508]">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4.5">
          <div className="border-2.5 border-stone-900 rounded-full p-1 shadow-[3px_3px_0px_0px_#121217] bg-white dark:bg-stone-850 shrink-0">
            <UserAvatar name={profile.displayName} src={profile.avatarUrl} size="xl" isOnline={isUserOnline(profile.id)} />
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-stone-950 dark:text-stone-50 font-display">{profile.displayName}</h2>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-stone-500 dark:text-stone-400 mt-1">
                  <span>@{profile.username}</span>
                  <span aria-hidden="true">·</span>
                  <span className="neo-badge bg-amber-300 text-stone-950 text-[9.5px]">
                    <Lock className="w-3 h-3 text-stone-950 stroke-[2.5]" />
                    <span>Private Circle</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-2">
                {isSelf ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-2 neo-btn text-xs font-black text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1A1A26] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <>
                    {profile.isConnection ? (
                      <button
                        onClick={() => onOpenChatWithUser?.(profile.id)}
                        className="px-4 py-2 neo-btn-primary text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Message</span>
                      </button>
                    ) : profile.isPendingRequest ? (
                      <span className="px-3.5 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-stone-950 dark:text-amber-200 rounded-xl text-xs font-black border-2 border-stone-900 flex items-center gap-1 shadow-[2px_2px_0px_0px_#121217]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Request Pending</span>
                      </span>
                    ) : (
                      <button
                        onClick={handleSendFollowRequest}
                        className="px-4 py-2 neo-btn-primary text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Request Follow</span>
                      </button>
                    )}

                    <button
                      onClick={handleReport}
                      className="p-2 neo-btn text-stone-600 dark:text-stone-300 hover:text-rose-600 bg-white dark:bg-[#1A1A26] cursor-pointer"
                      title="Report account"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Counts */}
            <div className="flex items-center justify-center sm:justify-start gap-4 mt-4 text-xs font-black text-stone-700 dark:text-stone-300 border-t-2 border-stone-100 dark:border-stone-800 pt-3">
              <div className="p-1.5 bg-stone-100 dark:bg-stone-850 rounded-xl border border-stone-900 px-3">
                <span className="font-black text-stone-950 dark:text-stone-50 mr-1.5 tabular-nums">{profile.followersCount}</span>
                <span className="text-stone-500 uppercase text-[10px]">Followers</span>
              </div>
              <div className="p-1.5 bg-stone-100 dark:bg-stone-850 rounded-xl border border-stone-900 px-3">
                <span className="font-black text-stone-950 dark:text-stone-50 mr-1.5 tabular-nums">{profile.followingCount}</span>
                <span className="text-stone-500 uppercase text-[10px]">Following</span>
              </div>
              {profile.isCloseFriend && (
                <span className="neo-badge bg-rose-500 text-white text-[9.5px]">
                  Close Friend
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Note Card on Profile */}
      <div className="mb-6 space-y-2">
        <h3 className="text-xs font-black text-stone-950 dark:text-stone-300 uppercase tracking-wider font-display">
          Current Note Broadcast
        </h3>

        {profile.isConnection || isSelf ? (
          profile.activeNote ? (
            <div className="neo-card p-4 sm:p-5 bg-amber-50 dark:bg-[#1F1C16] border-2 border-stone-900 shadow-[4px_4px_0px_0px_#FF9F1C] flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white dark:bg-stone-850 border-2 border-stone-900 text-2xl flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#121217]">
                {profile.activeNote.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-950 dark:text-stone-50">
                    {profile.activeNote.categoryLabel}
                  </span>
                  <span className="text-[10.5px] text-stone-500 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {profile.activeNote.expiresAt ? 'Temporary note' : 'Permanent'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 leading-relaxed">
                  "{profile.activeNote.text}"
                </p>
              </div>
            </div>
          ) : (
            <div className="neo-card p-5 bg-white dark:bg-[#161622] text-xs font-bold text-stone-500 text-center">
              No active note broadcasted right now.
              {isSelf && (
                <button
                  onClick={onOpenCreateNote}
                  className="block mx-auto mt-2 text-amber-600 dark:text-amber-400 font-black hover:underline cursor-pointer"
                >
                  Post a note to your circle
                </button>
              )}
            </div>
          )
        ) : (
          /* Privacy Barrier for Strangers */
          <div className="neo-card p-6 bg-white dark:bg-[#161622] text-center shadow-[4px_4px_0px_0px_#121217]">
            <Lock className="w-7 h-7 text-stone-950 dark:text-white mx-auto mb-2 stroke-[2.5]" />
            <p className="text-sm font-black text-stone-950 dark:text-stone-50 font-display">Notes are private to circle</p>
            <p className="text-xs font-bold text-stone-500 dark:text-stone-400 mt-0.5 max-w-xs mx-auto">
              Follow {profile.displayName.split(' ')[0]} to view their temporary status notes and live presence.
            </p>
            {!profile.isPendingRequest && (
              <button
                onClick={handleSendFollowRequest}
                className="mt-3.5 px-4 py-2 neo-btn-primary text-xs font-black cursor-pointer"
              >
                Send Follow Request
              </button>
            )}
          </div>
        )}
      </div>

      {/* About & Profile Details */}
      {(profile.isConnection || isSelf) && (
        <div className="neo-card bg-white dark:bg-[#161622] p-6 space-y-3 shadow-[4px_4px_0px_0px_#121217]">
          <h3 className="text-xs font-black text-stone-950 dark:text-stone-300 uppercase tracking-wider font-display">
            About {profile.displayName.split(' ')[0]}
          </h3>

          {profile.bio && (
            <p className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200 leading-relaxed">
              {profile.bio}
            </p>
          )}

          <div className="space-y-2 pt-3 border-t-2 border-stone-100 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300">
            {profile.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>{profile.city}</span>
              </div>
            )}
            {profile.workplace && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>{profile.workplace}</span>
              </div>
            )}
            {profile.birthday && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-500" />
                <span>Birthday: {profile.birthday}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProfile}
            className="neo-card bg-white dark:bg-[#161622] w-full max-w-md rounded-3xl shadow-[6px_6px_0px_#121217] p-6 space-y-4"
          >
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wide border-b-2 border-stone-900 dark:border-stone-800 pb-2">
              Edit Your Profile
            </h3>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100"
                required
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full text-xs font-bold p-3 neo-input text-stone-900 dark:text-stone-100 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">City</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1">Workplace</label>
                <input
                  type="text"
                  value={editWorkplace}
                  onChange={(e) => setEditWorkplace(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 neo-input text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-stone-900 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 neo-btn-primary text-stone-950 rounded-xl text-xs font-black cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
