'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog, Toast, type ToastData } from '../../../components/Toast'
import { API_URL } from '@/lib/config'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const formatDate = (s: string) => fmt.format(new Date(s));

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

interface BlockedMember {
  user_id: number;
  username: string;
  blocked_at: string;
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
  access_level: string;
}

const fetcher = (url: string) =>
  axios.get(url, { withCredentials: true }).then(r => r.data);

export default function AlbumSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.id as string;
  const qc = useQueryClient();

  const [privacyMode, setPrivacyMode] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteExpireDays, setInviteExpireDays] = useState<number | ''>('');
  const [inviteMaxUses, setInviteMaxUses] = useState<number | ''>('');
  const [inviteAccessLevel, setInviteAccessLevel] = useState<'full' | 'partial'>('full');
  const [showTransferAdmin, setShowTransferAdmin] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [qrInviteToken, setQrInviteToken] = useState<string | null>(null);
  const [rescanStatus, setRescanStatus] = useState<string | null>(null);
  const [rescanRunning, setRescanRunning] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = useCallback((message: string, type: ToastData['type']) =>
    setToast({ message, type }), []);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: album, isLoading: albumLoading } = useQuery<Album>({
    queryKey: ['album', albumId],
    queryFn: () => fetcher(`${API_URL}/album/${albumId}`),
  });

  // Sync privacyMode from fetched album (once, on first load)
  useMemo(() => {
    if (album && privacyMode === null) setPrivacyMode(album.privacy_mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album?.privacy_mode]);

  const { data: membersData } = useQuery<{ members: Member[] }>({
    queryKey: ['album-members', albumId],
    queryFn: () => fetcher(`${API_URL}/album/${albumId}/members`),
    enabled: !!album,
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['users'],
    queryFn: () => fetcher(`${API_URL}/users`),
    enabled: !!album,
    staleTime: 5 * 60 * 1000, // users list rarely changes — cache 5 min
  });

  const { data: invitesData } = useQuery<{ invites: Invite[] }>({
    queryKey: ['album-invites', albumId],
    queryFn: () => fetcher(`${API_URL}/album/${albumId}/invites`),
    enabled: !!album,
  });

  const { data: blockedData } = useQuery<{ blocked: BlockedMember[] }>({
    queryKey: ['album-blocked', albumId],
    queryFn: () => fetcher(`${API_URL}/album/${albumId}/blocked`),
    enabled: !!album,
  });

  const members = membersData?.members ?? [];
  const allUsers = usersData?.users ?? [];
  const invites = invitesData?.invites ?? [];
  const blockedMembers = blockedData?.blocked ?? [];

  // ── Derived / memoised ───────────────────────────────────────────────────
  const memberIds = useMemo(() => new Set(members.map(m => m.user_id)), [members]);
  const blockedIds = useMemo(() => new Set(blockedMembers.map(b => b.user_id)), [blockedMembers]);
  const availableUsers = useMemo(
    () => allUsers.filter(u => !memberIds.has(u.user_id) && !blockedIds.has(u.user_id)),
    [allUsers, memberIds, blockedIds]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateMembers = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['album-members', albumId] });
  }, [qc, albumId]);

  const addMemberMut = useMutation({
    mutationFn: (userId: number) =>
      axios.post(`${API_URL}/album/${albumId}/members`, { user_id: userId }, { withCredentials: true }),
    onSuccess: (res) => {
      invalidateMembers();
      if (res.data.matched_person_id) showToast(res.data.message, 'success');
    },
    onError: (err: any) => showToast(err.response?.data?.detail || 'Failed to add member', 'error'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: number) =>
      axios.delete(`${API_URL}/album/${albumId}/members/${userId}`, { withCredentials: true }),
    // Optimistic: remove instantly, restore on error
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ['album-members', albumId] });
      const prev = qc.getQueryData<{ members: Member[] }>(['album-members', albumId]);
      qc.setQueryData(['album-members', albumId], (old: any) => ({
        ...old, members: old.members.filter((m: Member) => m.user_id !== userId)
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      qc.setQueryData(['album-members', albumId], ctx.prev);
      showToast('Failed to remove member', 'error');
    },
    onSettled: invalidateMembers,
  });

  const blockMemberMut = useMutation({
    mutationFn: (userId: number) =>
      axios.post(`${API_URL}/album/${albumId}/members/${userId}/block`, {}, { withCredentials: true }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ['album-members', albumId] });
      const prev = qc.getQueryData<{ members: Member[] }>(['album-members', albumId]);
      qc.setQueryData(['album-members', albumId], (old: any) => ({
        ...old, members: old.members.filter((m: Member) => m.user_id !== userId)
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      qc.setQueryData(['album-members', albumId], ctx.prev);
      showToast('Failed to block member', 'error');
    },
    onSettled: () => {
      invalidateMembers();
      qc.invalidateQueries({ queryKey: ['album-blocked', albumId] });
    },
  });

  const unblockMemberMut = useMutation({
    mutationFn: (userId: number) =>
      axios.delete(`${API_URL}/album/${albumId}/members/${userId}/block`, { withCredentials: true }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ['album-blocked', albumId] });
      const prev = qc.getQueryData<{ blocked: BlockedMember[] }>(['album-blocked', albumId]);
      qc.setQueryData(['album-blocked', albumId], (old: any) => ({
        ...old, blocked: old.blocked.filter((b: BlockedMember) => b.user_id !== userId)
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      qc.setQueryData(['album-blocked', albumId], ctx.prev);
      showToast('Failed to unblock member', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['album-blocked', albumId] }),
  });

  const deactivateInviteMut = useMutation({
    mutationFn: (inviteId: number) =>
      axios.delete(`${API_URL}/album/${albumId}/invite/${inviteId}`, { withCredentials: true }),
    onMutate: async (inviteId) => {
      await qc.cancelQueries({ queryKey: ['album-invites', albumId] });
      const prev = qc.getQueryData(['album-invites', albumId]);
      qc.setQueryData(['album-invites', albumId], (old: any) => ({
        ...old, invites: old.invites.filter((i: Invite) => i.invite_id !== inviteId)
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      qc.setQueryData(['album-invites', albumId], ctx.prev);
      showToast('Failed to deactivate invite', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['album-invites', albumId] }),
  });

  const privacyMut = useMutation({
    mutationFn: (mode: string) =>
      axios.post(`${API_URL}/album/${albumId}/privacy`, { privacy_mode: mode }, { withCredentials: true }),
    onMutate: (mode) => setPrivacyMode(mode),
    onSuccess: (_res, mode) => showToast(`Privacy mode changed to ${mode}`, 'success'),
    onError: (err: any) => showToast(err.response?.data?.detail || 'Failed to update privacy mode', 'error'),
  });

  const createInviteMut = useMutation({
    mutationFn: () =>
      axios.post(`${API_URL}/album/${albumId}/invite`, {
        expires_days: inviteExpireDays || null,
        max_uses: inviteMaxUses || null,
        access_level: inviteAccessLevel,
      }, { withCredentials: true }),
    onSuccess: (res) => {
      setShowInviteForm(false);
      setInviteExpireDays('');
      setInviteMaxUses('');
      setInviteAccessLevel('full');
      qc.invalidateQueries({ queryKey: ['album-invites', albumId] });
      const inviteUrl = `${window.location.origin}/invite/${res.data.invite.invite_token}`;
      navigator.clipboard.writeText(inviteUrl);
      showToast('Invite link created and copied to clipboard!', 'success');
    },
    onError: (err: any) => showToast(err.response?.data?.detail || 'Failed to create invite link', 'error'),
  });

  const transferAdminMut = useMutation({
    mutationFn: (newAdminId: number) =>
      axios.post(`${API_URL}/album/${albumId}/transfer-admin`, { new_admin_user_id: newAdminId }, { withCredentials: true }),
    onSuccess: () => {
      const target = members.find(m => m.user_id === transferTargetId);
      showToast(`Admin rights transferred to ${target?.username}`, 'success');
      router.push(`/albums/${albumId}`);
    },
    onError: (err: any) => showToast(err.response?.data?.detail || 'Failed to transfer admin', 'error'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRemoveMember = useCallback((userId: number) => {
    setConfirm({
      title: 'Remove Member?',
      message: 'Remove this user from the album?',
      onConfirm: () => { setConfirm(null); removeMemberMut.mutate(userId); },
    });
  }, [removeMemberMut]);

  const handleBlockMember = useCallback((userId: number, username: string) => {
    setConfirm({
      title: `Block ${username}?`,
      message: 'They will be removed from the album and cannot rejoin.',
      onConfirm: () => { setConfirm(null); blockMemberMut.mutate(userId); },
    });
  }, [blockMemberMut]);

  const handleUnblockMember = useCallback((userId: number, username: string) => {
    setConfirm({
      title: `Unblock ${username}?`,
      message: 'They will be able to rejoin via invite.',
      onConfirm: () => { setConfirm(null); unblockMemberMut.mutate(userId); },
    });
  }, [unblockMemberMut]);

  const handleDeactivateInvite = useCallback((inviteId: number) => {
    setConfirm({
      title: 'Deactivate Invite Link?',
      message: 'This invite link will no longer work.',
      onConfirm: () => { setConfirm(null); deactivateInviteMut.mutate(inviteId); },
    });
  }, [deactivateInviteMut]);

  const handleCopyInvite = useCallback((token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    showToast('Invite link copied to clipboard!', 'info');
  }, [showToast]);

  const handleTransferAdmin = useCallback(() => {
    if (!transferTargetId) return;
    const target = members.find(m => m.user_id === transferTargetId);
    setConfirm({
      title: `Transfer Admin to ${target?.username}?`,
      message: 'You will lose admin access and become a regular member.',
      onConfirm: () => { setConfirm(null); transferAdminMut.mutate(transferTargetId); },
    });
  }, [transferTargetId, members, transferAdminMut]);

  const handleRescan = useCallback(async () => {
    setRescanRunning(true);
    setRescanStatus('Starting scan...');
    try {
      const response = await fetch(`${API_URL}/album/${albumId}/rescan`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = JSON.parse(line.replace('data: ', ''));
          if (data.stage === 'scanning') setRescanStatus(`Found ${data.total} images...`);
          else if (data.stage === 'processing') setRescanStatus(`Processing ${data.processed}/${data.total} (${data.skipped} skipped)...`);
          else if (data.stage === 'clustering') setRescanStatus('Grouping faces...');
          else if (data.stage === 'indexing') setRescanStatus('Rebuilding index...');
          else if (data.stage === 'complete') {
            setRescanStatus(`✅ Done! ${data.new_photos} new photos, ${data.faces_detected} new faces, ${data.new_persons} new people.`);
            setRescanRunning(false);
          } else if (data.stage === 'error') {
            setRescanStatus(`❌ Error: ${data.message}`);
            setRescanRunning(false);
          }
        }
      }
    } catch (error: any) {
      setRescanStatus(`❌ Error: ${error.message}`);
      setRescanRunning(false);
    }
  }, [albumId]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (albumLoading) {
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

  if (!(album as any).is_admin) {
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

  return (
    <div className="space-y-8">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      {/* QR Code Modal */}
      {qrInviteToken && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={() => setQrInviteToken(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Scan to Join Album</h3>
            <QRCodeSVG
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${qrInviteToken}`}
              size={220}
              level="M"
              includeMargin
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center break-all font-mono">
              {typeof window !== 'undefined' ? `${window.location.origin}/invite/${qrInviteToken}` : ''}
            </p>
            <button
              onClick={() => setQrInviteToken(null)}
              className="mt-2 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Album Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{(album as any).name}</p>
        </div>
        <Link
          href={`/albums/${albumId}`}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Back to Album
        </Link>
      </div>

      {/* Privacy Mode Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Privacy Mode</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <input
              type="radio"
              id="public"
              name="privacy"
              checked={privacyMode === 'public'}
              onChange={() => privacyMut.mutate('public')}
              className="mt-1"
            />
            <div className="flex-1">
              <label htmlFor="public" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                Public Mode
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
              onChange={() => privacyMut.mutate('private')}
              className="mt-1"
            />
            <div className="flex-1">
              <label htmlFor="private" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                Private Mode
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Each member only sees photos of themselves. Best for privacy-focused events.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Album Members ({members.length})</h2>

        {members.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No members yet. Add users below.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-semibold">
                    {member.profile_photo_path ? (
                      <img
                        src={`${API_URL}/profile-photo/${member.user_id}`}
                        alt={member.username}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      member.username[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{member.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Added {formatDate(member.added_at)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBlockMember(member.user_id, member.username)}
                    className="px-3 py-1 text-sm text-orange-600 hover:bg-orange-50 rounded-md transition"
                    title="Block member"
                  >
                    Block
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Members Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Add Members</h2>

        {availableUsers.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">All users have been added to this album.</p>
        ) : (
          <div className="space-y-3">
            {availableUsers.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-semibold">
                    {user.profile_photo_path ? (
                      <img
                        src={`${API_URL}/profile-photo/${user.user_id}`}
                        alt={user.username}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      user.username[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{user.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Joined {formatDate(user.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => addMemberMut.mutate(user.user_id)}
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-black dark:text-white">Invite Links</h2>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            {showInviteForm ? 'Cancel' : 'Create Invite Link'}
          </button>
        </div>

        {showInviteForm && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expires in (days) — Optional
              </label>
              <input
                type="number"
                value={inviteExpireDays}
                onChange={(e) => setInviteExpireDays(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Leave empty for no expiration"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum uses — Optional
              </label>
              <input
                type="number"
                value={inviteMaxUses}
                onChange={(e) => setInviteMaxUses(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Leave empty for unlimited uses"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Level
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-gray-200 dark:border-gray-600">
                  <input
                    type="radio"
                    name="access_level"
                    value="full"
                    checked={inviteAccessLevel === 'full'}
                    onChange={() => setInviteAccessLevel('full')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Full Access</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Member sees all people and photos in the album</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-gray-200 dark:border-gray-600">
                  <input
                    type="radio"
                    name="access_level"
                    value="partial"
                    checked={inviteAccessLevel === 'partial'}
                    onChange={() => setInviteAccessLevel('partial')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Partial Access</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Member only sees photos they appear in (privacy mode enforced)</p>
                  </div>
                </label>
              </div>
            </div>
            <button
              onClick={() => createInviteMut.mutate()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Generate Invite Link
            </button>
          </div>
        )}

        {invites.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No invite links created yet.</p>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div key={invite.invite_id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${invite.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {invite.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${invite.access_level === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                        {invite.access_level === 'partial' ? 'Partial Access' : 'Full Access'}
                      </span>
                      {invite.expires_at && (
                        <span className="text-xs text-gray-600">
                          Expires: {formatDate(invite.expires_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Created by {invite.created_by_username} on {formatDate(invite.created_at)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Uses: {invite.use_count}{invite.max_uses ? ` / ${invite.max_uses}` : ' (unlimited)'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {invite.is_active && (
                      <>
                        <button
                          onClick={() => handleCopyInvite(invite.invite_token)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => setQrInviteToken(qrInviteToken === invite.invite_token ? null : invite.invite_token)}
                          className="px-3 py-1 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-800"
                          title="Show QR code"
                        >
                          QR Code
                        </button>
                      </>
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

      {/* Blocked Members Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Blocked Members</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Blocked users cannot rejoin this album via invite links.
            </p>
          </div>
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
            {blockedMembers.length} blocked
          </span>
        </div>

        {blockedMembers.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">No blocked members.</p>
        ) : (
          <div className="space-y-3">
            {blockedMembers.map((blocked) => (
              <div key={blocked.user_id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-semibold flex-shrink-0">
                    {blocked.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{blocked.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Blocked {formatDate(blocked.blocked_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblockMember(blocked.user_id, blocked.username)}
                  className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-md border border-green-200 transition"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Re-scan Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Re-scan Folder</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Scan the album folder for new photos added since the last scan. Existing photos are skipped.
            </p>
          </div>
          <button
            onClick={handleRescan}
            disabled={rescanRunning}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
          >
            {rescanRunning && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {rescanRunning ? 'Scanning...' : 'Re-scan Now'}
          </button>
        </div>
        {rescanStatus && (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-3 font-mono">{rescanStatus}</p>
        )}
      </div>

      {/* Transfer Admin Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-red-100 dark:border-red-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Transfer Admin Rights</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Hand over admin control to another member. You will become a regular member.
            </p>
          </div>
          <button
            onClick={() => setShowTransferAdmin(!showTransferAdmin)}
            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 text-sm font-medium"
          >
            {showTransferAdmin ? 'Cancel' : 'Transfer Admin'}
          </button>
        </div>

        {showTransferAdmin && (
          <div className="space-y-4 pt-2">
            {members.length === 0 ? (
              <p className="text-gray-600 text-sm">No other members to transfer admin to. Add members first.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {members.map((member) => (
                    <label
                      key={member.user_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${transferTargetId === member.user_id
                        ? 'border-red-400 bg-red-50 dark:bg-red-900/30'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                    >
                      <input
                        type="radio"
                        name="transfer_target"
                        value={member.user_id}
                        checked={transferTargetId === member.user_id}
                        onChange={() => setTransferTargetId(member.user_id)}
                        className="text-red-600"
                      />
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {member.username[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{member.username}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleTransferAdmin}
                  disabled={!transferTargetId}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Confirm Transfer
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
