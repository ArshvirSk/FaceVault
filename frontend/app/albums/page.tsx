'use client'

import { API_URL } from '@/lib/config'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { useState } from 'react'
import { ConfirmDialog, Toast, type ToastData } from '../components/Toast'

interface Album {
  album_id: number
  name: string
  folder_path: string
  created_at: string
  photo_count: number
  person_count: number
  is_admin: boolean
}

const fetchAlbums = async (): Promise<Album[]> => {
  const response = await axios.get(`${API_URL}/albums`, { withCredentials: true })
  return response.data.albums
}

// ─── Scan Modal ───────────────────────────────────────────────────────────────
function ScanModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [folderPath, setFolderPath] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<any>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  const handleScan = async () => {
    if (!folderPath.trim()) return
    setScanning(true)
    setProgress(null)
    try {
      const response = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder_path: folderPath.trim(), album_name: albumName.trim() || undefined }),
      })
      if (!response.ok) throw new Error('Scan failed')
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = JSON.parse(line.slice(6))
            setProgress(data)
            if (data.stage === 'complete') { onComplete(); setScanning(false); return }
            if (data.stage === 'error') { setToast({ message: 'Error: ' + data.message, type: 'error' }); setScanning(false); return }
          }
        }
      }
    } catch (err: any) {
      setToast({ message: 'Error: ' + err.message, type: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const progressLabel = () => {
    if (!progress) return null
    if (progress.stage === 'scanning') return `Found ${progress.total} images`
    if (progress.stage === 'processing') return `Processing ${progress.processed} / ${progress.total} images • ${progress.faces} faces detected`
    if (progress.stage === 'clustering') return 'Grouping faces by person…'
    if (progress.stage === 'indexing') return 'Building search index…'
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Album</h2>
          <button onClick={onClose} disabled={scanning} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Folder Path</label>
            <input
              type="text"
              value={folderPath}
              onChange={e => setFolderPath(e.target.value)}
              placeholder="C:\Users\You\Pictures\Vacation2025"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={scanning}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && !scanning && handleScan()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Album Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={albumName}
              onChange={e => setAlbumName(e.target.value)}
              placeholder="Uses folder name if left blank"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={scanning}
            />
          </div>

          {scanning && progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="animate-spin w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-sm text-blue-800 font-medium">{progressLabel()}</p>
              </div>
              {progress.stage === 'processing' && progress.total > 0 && (
                <div className="w-full bg-blue-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || !folderPath.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {scanning ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Scan &amp; Create Album
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AlbumsPage() {
  const queryClient = useQueryClient()
  const [showScanModal, setShowScanModal] = useState(false)
  const [filter, setFilter] = useState('')

  const { data: albums = [], isLoading, error } = useQuery({
    queryKey: ['albums'],
    queryFn: fetchAlbums,
  })

  const filtered = filter.trim()
    ? albums.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()))
    : albums

  const handleScanComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['albums'] })
    setShowScanModal(false)
  }

  if (isLoading) {
    return (
      <div className="text-center py-24">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        <p className="mt-3 text-gray-600">Loading albums…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-semibold text-red-600 mb-2">Error Loading Albums</h2>
        <p className="text-gray-600">Please try again later</p>
      </div>
    )
  }

  return (
    <>
      {showScanModal && (
        <ScanModal onClose={() => setShowScanModal(false)} onComplete={handleScanComplete} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Albums</h1>
          {albums.length > 0 && (
            <p className="text-gray-500 dark:text-gray-400 mt-1">{albums.length} album{albums.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <button
          onClick={() => setShowScanModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Album
        </button>
      </div>

      {albums.length === 0 ? (
        /* Empty state */
        <div className="text-center py-24">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No albums yet</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            Scan a folder of photos to create your first album — AI will detect and group faces automatically.
          </p>
          <button
            onClick={() => setShowScanModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Scan Your First Folder
          </button>
        </div>
      ) : (
        <>
          {/* Filter — only show when there are enough albums to warrant it */}
          {albums.length > 4 && (
            <div className="relative mb-6 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter albums…"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-gray-500 py-12 text-center">No albums match &ldquo;{filter}&rdquo;</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map(album => (
                <AlbumCard key={album.album_id} album={album} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function AlbumCard({ album }: { album: Album }) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(album.name)
  const [coverError, setCoverError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)
  const queryClient = useQueryClient()

  const formattedDate = new Date(album.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const handleRename = async () => {
    if (!newName.trim()) return
    try {
      await axios.post(`${API_URL}/album/${album.album_id}/rename`, { name: newName }, { withCredentials: true })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      setEditing(false)
    } catch {
      setToast({ message: 'Failed to rename album', type: 'error' })
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    try {
      await axios.delete(`${API_URL}/album/${album.album_id}`, { withCredentials: true })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
    } catch (error: any) {
      setToast({ message: error.response?.data?.detail || 'Failed to delete album', type: 'error' })
    }
  }

  if (editing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 p-6">
        {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Album Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Enter album name"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') { setNewName(album.name); setEditing(false) }
              }}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleRename} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
            <button onClick={() => { setNewName(album.name); setEditing(false) }} className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100 dark:border-gray-700 group flex flex-col">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${album.name}"?`}
          message="This will permanently remove all photos and people data in this album."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {/* Cover image */}
      <Link href={`/albums/${album.album_id}`} className="block">
        <div className="aspect-video bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 overflow-hidden relative">
          {album.photo_count > 0 && !coverError ? (
            <img
              src={`${API_URL}/album/${album.album_id}/cover?size=400`}
              alt={album.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="bg-white/80 rounded-2xl p-4 shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          )}
          {album.is_admin && (
            <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow">
              Admin
            </div>
          )}
        </div>
      </Link>

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link href={`/albums/${album.album_id}`} className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors" title={album.name}>
              {album.name}
            </h3>
          </Link>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={e => { e.preventDefault(); setEditing(true) }}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
              title="Rename"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {album.is_admin && (
              <>
                <Link
                  href={`/albums/${album.album_id}/settings`}
                  className="p-1.5 text-gray-400 hover:text-purple-600 rounded transition-colors"
                  title="Settings"
                  onClick={e => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                <button
                  onClick={e => { e.preventDefault(); setConfirmDelete(true) }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 truncate" title={album.folder_path}>{album.folder_path}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-auto">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {album.photo_count}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {album.person_count}
          </span>
          <span className="ml-auto">{formattedDate}</span>
        </div>
      </div>
    </div>
  )
}
