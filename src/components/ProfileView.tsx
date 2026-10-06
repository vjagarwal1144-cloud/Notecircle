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
  const { currentUser, refreshUser } = useAuth();
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
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <UserAvatar name={profile.displayName} src={profile.avatarUrl} size="xl" />

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-display">{profile.displayName}</h2>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  <span>@{profile.username}</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Private Account</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-2">
                {isSelf ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <>
                    {profile.isConnection ? (
                      <button
                        onClick={() => onOpenChatWithUser?.(profile.id)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    ) : profile.isPendingRequest ? (
                      <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-medium border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Request Pending</span>
                      </span>
                    ) : (
                      <button
                        onClick={handleSendFollowRequest}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Request Follow</span>
                      </button>
                    )}

                    <button
                      onClick={handleReport}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg"
                      title="Report account"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Counts */}
            <div className="flex items-center justify-center sm:justify-start gap-4 mt-4 text-xs text-stone-600 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800 pt-3">
              <div>
                <span className="font-bold text-stone-900 dark:text-stone-100 mr-1 tabular-nums">{profile.followersCount}</span>
                <span className="text-stone-400">Followers</span>
              </div>
              <div>
                <span className="font-bold text-stone-900 dark:text-stone-100 mr-1 tabular-nums">{profile.followingCount}</span>
                <span className="text-stone-400">Following</span>
              </div>
              {profile.isCloseFriend && (
                <span className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded font-semibold border border-amber-200 dark:border-amber-800">
                  Close Friend
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Note Card on Profile */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Current Note
        </h3>

        {profile.isConnection || isSelf ? (
          profile.activeNote ? (
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs flex items-start gap-3">
              <span className="text-2xl select-none">{profile.activeNote.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {profile.activeNote.categoryLabel}
                  </span>
                  <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" />
                    {profile.activeNote.expiresAt ? 'Temporary note' : 'Permanent'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-800 dark:text-stone-200 mt-1 leading-relaxed">
                  "{profile.activeNote.text}"
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 text-xs text-stone-400 text-center">
              No active note right now.
              {isSelf && (
                <button
                  onClick={onOpenCreateNote}
                  className="block mx-auto mt-2 text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                >
                  Post a note
                </button>
              )}
            </div>
          )
        ) : (
          /* Privacy Barrier for Strangers */
          <div className="p-6 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
            <Lock className="w-6 h-6 text-stone-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Notes are private</p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 max-w-xs mx-auto">
              Follow {profile.displayName.split(' ')[0]} to see their temporary status notes and availability.
            </p>
            {!profile.isPendingRequest && (
              <button
                onClick={handleSendFollowRequest}
                className="mt-3 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shadow-xs cursor-pointer"
              >
                Send Follow Request
              </button>
            )}
          </div>
        )}
      </div>

      {/* About & Profile Details */}
      {(profile.isConnection || isSelf) && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
            About
          </h3>

          {profile.bio && (
            <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-normal">
              {profile.bio}
            </p>
          )}

          <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
            {profile.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                <span>{profile.city}</span>
              </div>
            )}
            {profile.workplace && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-stone-400" />
                <span>{profile.workplace}</span>
              </div>
            )}
            {profile.birthday && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Birthday: {profile.birthday}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white dark:bg-[#1C1A18] w-full max-w-md rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2 font-display">
              Edit Your Profile
            </h3>

            <div>
              <label className="text-xs font-medium text-stone-600 dark:text-stone-300 block mb-1">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 rounded-xl text-stone-800 dark:text-stone-200 focus:outline-hidden focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 dark:text-stone-300 block mb-1">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 rounded-xl text-stone-800 dark:text-stone-200 focus:outline-hidden focus:border-amber-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-stone-300 block mb-1">City</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full text-xs p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 rounded-xl text-stone-800 dark:text-stone-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-stone-300 block mb-1">Workplace</label>
                <input
                  type="text"
                  value={editWorkplace}
                  onChange={(e) => setEditWorkplace(e.target.value)}
                  className="w-full text-xs p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 rounded-xl text-stone-800 dark:text-stone-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-2 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-xs cursor-pointer transition-transform active:scale-98"
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
