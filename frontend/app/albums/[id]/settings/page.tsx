'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

const API_URL = 'http://localhost:8000';

interface User {
  user_id: number;
  username: string;
  profile_photo_path: string;
  created_at: string;
}

interface Member {
  user_id: number;
  username: string;
  profile_photo_path: string;
  added_at: string;
}

interface Album {
  album_id: number;
  name: string;
  privacy_mode: string;
  is_admin: boolean;
}

interface Invite {
  invite_id: number;
  invite_token: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_by_username: string;
}

export default function AlbumSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.id as string;
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState('public');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteExpireDays, setInviteExpireDays] = useState<number | ''>('');
  const [inviteMaxUses, setInviteMaxUses] = useState<number | ''>('');

  useEffect(() => {
    fetchData();
  }, [albumId]);

  const fetchData = async () => {
    try {
      const [albumRes, membersRes, usersRes, invitesRes] = await Promise.all([
        axios.get(`${API_URL}/albums`, { withCredentials: true }),
        axios.get(`${API_URL}/album/${albumId}/members`, { withCredentials: true }),
        axios.get(`${API_URL}/users`, { withCredentials: true }),
        axios.get(`${API_URL}/album/${albumId}/invites`, { withCredentials: true })
      ]);

      const albumData = albumRes.data.albums.find((a: any) => a.album_id === parseInt(albumId));
      setAlbum(albumData);
      setPrivacyMode(albumData?.privacy_mode || 'public');
      setMembers(membersRes.data.members);
      setAllUsers(usersRes.data.users);
      setInvites(invitesRes.data.invites);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: number) => {
    try {
      await axios.post(
        `${API_URL}/album/${albumId}/members`,
        { user_id: userId },
        { withCredentials: true }
      );
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Remove this user from the album?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/album/${albumId}/members/${userId}`,
        { withCredentials: true }
      );
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to remove member');
    }
  };

  const handlePrivacyChange = async (mode: string) => {
    try {
      await axios.post(
        `${API_URL}/album/${albumId}/privacy`,
        { privacy_mode: mode },
        { withCredentials: true }
      );
      setPrivacyMode(mode);
      alert(`Privacy mode changed to ${mode}`);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update privacy mode');
    }
  };

  const handleCreateInvite = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/album/${albumId}/invite`,
        {
          expires_days: inviteExpireDays || null,
          max_uses: inviteMaxUses || null
        },
        { withCredentials: true }
      );
      
      setShowInviteForm(false);
      setInviteExpireDays('');
      setInviteMaxUses('');
      fetchData();
      
      // Show the invite link
      const inviteUrl = `${window.location.origin}/invite/${response.data.invite.invite_token}`;
      navigator.clipboard.writeText(inviteUrl);
      alert(`Invite link created and copied to clipboard!\n\n${inviteUrl}`);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create invite link');
    }
  };

  const handleCopyInvite = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    alert('Invite link copied to clipboard!');
  };

  const handleDeactivateInvite = async (inviteId: number) => {
    if (!confirm('Deactivate this invite link?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/album/${albumId}/invite/${inviteId}`,
        { withCredentials: true }
      );
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to deactivate invite');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-red-600">Album not found</h2>
      </div>
    );
  }

  if (!album.is_admin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-red-600">Access Denied</h2>
        <p className="text-gray-600 mt-2">Only album admins can access settings</p>
        <Link href={`/albums/${albumId}`} className="text-blue-600 hover:underline mt-4 inline-block">
          Back to Album
        </Link>
      </div>
    );
  }

  const memberIds = new Set(members.map(m => m.user_id));
  const availableUsers = allUsers.filter(u => !memberIds.has(u.user_id));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Album Settings</h1>
          <p className="text-gray-600 mt-2">{album.name}</p>
        </div>
        <Link
          href={`/albums/${albumId}`}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Back to Album
        </Link>
      </div>

      {/* Privacy Mode Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Privacy Mode</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <input
              type="radio"
              id="public"
              name="privacy"
              checked={privacyMode === 'public'}
              onChange={() => handlePrivacyChange('public')}
              className="mt-1"
            />
            <div className="flex-1">
              <label htmlFor="public" className="font-medium text-gray-900 cursor-pointer">
                Public Mode
              </label>
              <p className="text-sm text-gray-600">
                All members can see all identified people in the album. Best for collaborative organizing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <input
              type="radio"
              id="private"
              name="privacy"
              checked={privacyMode === 'private'}
              onChange={() => handlePrivacyChange('private')}
              className="mt-1"
            />
            <div className="flex-1">
              <label htmlFor="private" className="font-medium text-gray-900 cursor-pointer">
                Private Mode
              </label>
              <p className="text-sm text-gray-600">
                Each member only sees photos of themselves. Best for privacy-focused events.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Album Members ({members.length})</h2>
        
        {members.length === 0 ? (
          <p className="text-gray-600">No members yet. Add users below.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-semibold">
                    {member.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.username}</p>
                    <p className="text-xs text-gray-500">Added {new Date(member.added_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.user_id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Members Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Add Members</h2>
        
        {availableUsers.length === 0 ? (
          <p className="text-gray-600">All users have been added to this album.</p>
        ) : (
          <div className="space-y-3">
            {availableUsers.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.username}</p>
                    <p className="text-xs text-gray-500">Joined {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAddMember(user.user_id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Add to Album
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Links Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Invite Links</h2>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            {showInviteForm ? 'Cancel' : 'Create Invite Link'}
          </button>
        </div>

        {showInviteForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires in (days) - Optional
              </label>
              <input
                type="number"
                value={inviteExpireDays}
                onChange={(e) => setInviteExpireDays(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Leave empty for no expiration"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum uses - Optional
              </label>
              <input
                type="number"
                value={inviteMaxUses}
                onChange={(e) => setInviteMaxUses(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Leave empty for unlimited uses"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="1"
              />
            </div>
            <button
              onClick={handleCreateInvite}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Generate Invite Link
            </button>
          </div>
        )}

        {invites.length === 0 ? (
          <p className="text-gray-600">No invite links created yet.</p>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div key={invite.invite_id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        invite.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {invite.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {invite.expires_at && (
                        <span className="text-xs text-gray-600">
                          Expires: {new Date(invite.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Created by {invite.created_by_username} on {new Date(invite.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Uses: {invite.use_count}{invite.max_uses ? ` / ${invite.max_uses}` : ' (unlimited)'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {invite.is_active && (
                      <button
                        onClick={() => handleCopyInvite(invite.invite_token)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Copy Link
                      </button>
                    )}
                    <button
                      onClick={() => handleDeactivateInvite(invite.invite_id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
