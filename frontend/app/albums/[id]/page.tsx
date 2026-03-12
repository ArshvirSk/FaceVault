'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog, Toast, type ToastData } from '../../components/Toast'
import { API_URL } from '@/lib/config'

interface Person {
  person_id: number
  name: string
  photo_count: number
  album_id: number | null
  thumbnail?: any
}

interface Album {
  album_id: number
  name: string
  folder_path: string
  photo_count: number
  person_count: number
  is_admin?: boolean
}

const fetchAlbum = async (albumId: string): Promise<Album> => {
  const response = await axios.get(`${API_URL}/albums`, { withCredentials: true })
  const albums = response.data.albums
  return albums.find((a: Album) => a.album_id === parseInt(albumId))
}

const fetchPeople = async (albumId: string) => {
  const response = await axios.get(`${API_URL}/people?album_id=${albumId}`, { withCredentials: true })
  return {
    persons: response.data.persons,
    privacy_mode: response.data.privacy_mode
  }
}

interface AlbumPhoto {
  photo_id: number
  filename: string | null
  timestamp: string | null
}

const fetchAlbumPhotos = async (
  albumId: string,
  sort: string,
  personId: number | null
): Promise<AlbumPhoto[]> => {
  const params: Record<string, string | number> = { sort }
  if (personId !== null) params.person_id = personId
  const response = await axios.get(`${API_URL}/album/${albumId}/photos`, {
    withCredentials: true,
    params,
  })
  return response.data.photos
}

export default function AlbumPeoplePage() {
  const params = useParams()
  const router = useRouter()
  const albumId = params.id as string

  const [mergeMode, setMergeMode] = useState(false)
  const [selectedPeople, setSelectedPeople] = useState<number[]>([])
  const [showThresholdSlider, setShowThresholdSlider] = useState(false)
  const [threshold, setThreshold] = useState(0.5)
  const [privacyMode, setPrivacyMode] = useState('public')
  const [toast, setToast] = useState<ToastData | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const showToast = (message: string, type: ToastData['type']) => setToast({ message, type })
  const queryClient = useQueryClient()

  // Yours / People / Photos switcher
  const [view, setView] = useState<'yours' | 'people' | 'photos'>('yours')
  const [currentUser, setCurrentUser] = useState<{ user_id: number } | null>(null)
  const [yourPeople, setYourPeople] = useState<number[] | null>(null) // person_ids matching the user
  const [yoursLoading, setYoursLoading] = useState(false)
  const [yoursError, setYoursError] = useState<string | null>(null)

  // Photos tab filters
  const [photoSort, setPhotoSort] = useState<'newest' | 'oldest' | 'filename'>('newest')
  const [photoPersonFilter, setPhotoPersonFilter] = useState<number | null>(null)

  // Fetch current user once
  useEffect(() => {
    axios.get(`${API_URL}/auth/me`, { withCredentials: true })
      .then(res => setCurrentUser(res.data))
      .catch(() => { })
  }, [])

  // Upload state
  const [uploadDragging, setUploadDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => fetchAlbum(albumId),
  })

  const { data: peopleData, isLoading, error } = useQuery({
    queryKey: ['people', albumId],
    queryFn: () => fetchPeople(albumId),
  })

  const { data: albumPhotos = [], isFetching: photosFetching } = useQuery({
    queryKey: ['album-photos', albumId, photoSort, photoPersonFilter],
    queryFn: () => fetchAlbumPhotos(albumId, photoSort, photoPersonFilter),
    enabled: view === 'photos',
  })

  const people = peopleData?.persons || []

  useEffect(() => {
    if (peopleData?.privacy_mode) {
      setPrivacyMode(peopleData.privacy_mode)
    }
  }, [peopleData])

  const toggleSelection = (personId: number) => {
    setSelectedPeople(prev =>
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    )
  }

  const handleMerge = async () => {
    if (selectedPeople.length < 2) {
      showToast('Please select at least 2 people to merge', 'error')
      return
    }

    const targetId = selectedPeople[0]
    const sourceIds = selectedPeople.slice(1)

    try {
      for (const sourceId of sourceIds) {
        await axios.post(`${API_URL}/person/${sourceId}/merge/${targetId}`, {}, { withCredentials: true })
      }

      showToast(`Successfully merged ${sourceIds.length} people into ${people.find((p: Person) => p.person_id === targetId)?.name || 'Person ' + targetId}`, 'success')

      queryClient.invalidateQueries({ queryKey: ['people', albumId] })
      queryClient.invalidateQueries({ queryKey: ['album', albumId] })

      setMergeMode(false)
      setSelectedPeople([])
    } catch (error) {
      showToast('Failed to merge people', 'error')
    }
  }

  const handleAutoMerge = async () => {
    try {
      const response = await axios.post(`${API_URL}/auto-merge?threshold=${threshold}`, {}, { withCredentials: true })

      showToast(response.data.message, 'success')

      if (response.data.merged_count > 0) {
        await queryClient.invalidateQueries({ queryKey: ['people', albumId] })
        await queryClient.refetchQueries({ queryKey: ['people', albumId] })
        await queryClient.invalidateQueries({ queryKey: ['album', albumId] })
      }

      setShowThresholdSlider(false)
    } catch (error) {
      showToast('Failed to auto-merge people', 'error')
    }
  }

  const handleRecluster = async () => {
    setConfirm({
      title: 'Re-cluster All Faces?',
      message: 'This will re-cluster all faces and may find missing people. This will reset all person names. Continue?',
      onConfirm: async () => {
        setConfirm(null)
        try {
          const response = await axios.post(`${API_URL}/recluster`, {}, { withCredentials: true })
          showToast(response.data.message, 'success')
          queryClient.invalidateQueries({ queryKey: ['people', albumId] })
          queryClient.invalidateQueries({ queryKey: ['album', albumId] })
        } catch (error) {
          showToast('Failed to re-cluster faces', 'error')
        }
      }
    })
  }

  const cancelMerge = () => {
    setMergeMode(false)
    setSelectedPeople([])
  }

  const handleLeaveAlbum = async () => {
    setConfirm({
      title: 'Leave Album?',
      message: 'Are you sure you want to leave this album? You will lose access to all photos and people in this album.',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await axios.post(`${API_URL}/album/${albumId}/leave`, {}, { withCredentials: true })
          showToast('You have left the album', 'info')
          router.push('/albums')
        } catch (error: any) {
          showToast(error.response?.data?.detail || 'Failed to leave album', 'error')
        }
      }
    })
  }

  const handleUploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) { setUploadStatus('No image files selected.'); return }
    setUploading(true)
    setUploadStatus(`Uploading ${imageFiles.length} photo(s)...`)
    try {
      const formData = new FormData()
      imageFiles.forEach(f => formData.append('files', f))
      const res = await axios.post(`${API_URL}/album/${albumId}/upload`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const d = res.data
      setUploadStatus(`✅ ${d.new_photos} added, ${d.new_faces} faces, ${d.new_persons} new people${d.skipped_duplicates ? `, ${d.skipped_duplicates} duplicates skipped` : ''}.`)
      queryClient.invalidateQueries({ queryKey: ['people', albumId] })
      queryClient.invalidateQueries({ queryKey: ['album', albumId] })
    } catch (e: any) {
      setUploadStatus(`❌ Upload failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setUploading(false)
    }
  }, [albumId, queryClient])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setUploadDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleUploadFiles(files)
  }, [handleUploadFiles])

  const runYoursSearch = useCallback(async (userId: number) => {
    if (yoursLoading) return
    setYoursLoading(true)
    setYoursError(null)
    try {
      // Fetch via Next.js proxy route to avoid CORS (server-side fetch, no preflight)
      const photoRes = await axios.get(`/api/profile-photo/${userId}`, {
        responseType: 'blob',
        withCredentials: true,
      })
      const blob: Blob = photoRes.data
      const formData = new FormData()
      formData.append('file', blob, 'profile.jpg')
      // Search faces using the profile photo
      const searchRes = await axios.post(`${API_URL}/search-face`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      const matchingIds: number[] = Array.from(
        new Set((searchRes.data.photos as any[]).map((p: any) => p.person_id))
      )
      setYourPeople(matchingIds)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Search failed'
      setYoursError(msg)
      setYourPeople([])
    } finally {
      setYoursLoading(false)
    }
  }, [yoursLoading])

  // Auto-trigger face search when current user is loaded
  useEffect(() => {
    if (currentUser && yourPeople === null && !yoursLoading) {
      runYoursSearch(currentUser.user_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  const handleSwitchToYours = useCallback(async () => {
    setView('yours')
    if (yourPeople !== null) return // already fetched
    if (!currentUser) { setYoursError('Not logged in'); return }
    runYoursSearch(currentUser.user_id)
  }, [currentUser, yourPeople, runYoursSearch])

  const displayedPeople = view === 'yours' && yourPeople !== null
    ? people.filter((p: Person) => yourPeople.includes(p.person_id))
    : people

  const displayedPhotos: AlbumPhoto[] = albumPhotos

  const getThresholdLabel = (value: number) => {
    if (value <= 0.4) return 'Very Aggressive'
    if (value <= 0.5) return 'Balanced'
    if (value <= 0.6) return 'Conservative'
    return 'Very Conservative'
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading people...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-red-600 mb-2">Error Loading People</h2>
        <p className="text-gray-600">Please try again later</p>
      </div>
    )
  }

  if (people.length === 0) {
    return (
      <div>
        {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
        {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Albums
        </button>

        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No People Found</h2>
          <p className="text-gray-600 dark:text-gray-400">This album doesn't have any detected faces yet</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Albums
      </button>

      {/* Privacy Mode Banner */}
      {privacyMode === 'private' && (
        <div className="mb-6 bg-purple-50 border border-purple-200 dark:border-purple-800 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-300">Private Mode Active</h3>
              <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                You're only seeing photos of yourself in this album. Other members can only see their own photos.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{album?.name || 'Album'}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{people.length} people found</p>
        </div>

        <div className="flex gap-2">
          {album?.is_admin ? (
            <>
              <Link
                href={`/albums/${albumId}/settings`}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              {!mergeMode ? (
                <>
                  <button
                    onClick={handleRecluster}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Re-cluster All
                  </button>
                  <button
                    onClick={() => setShowThresholdSlider(!showThresholdSlider)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    Auto-Merge Duplicates
                  </button>
                  <button
                    onClick={() => setMergeMode(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Manual Merge
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleMerge}
                    disabled={selectedPeople.length < 2}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Merge Selected ({selectedPeople.length})
                  </button>
                  <button
                    onClick={cancelMerge}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              onClick={handleLeaveAlbum}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Leave Album
            </button>
          )}
        </div>
      </div>

      {album?.is_admin && view === 'people' && mergeMode && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-blue-900 dark:text-blue-300 font-semibold">Merge Mode Active</p>
          <p className="text-blue-800 dark:text-blue-400 text-sm mt-1">
            Select 2 or more people to merge them together. All faces will be combined into the first selected person.
          </p>
        </div>
      )}

      {album?.is_admin && view === 'people' && showThresholdSlider && (
        <div className="mb-6 p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-purple-900 dark:text-purple-300 font-semibold text-lg">Auto-Merge Settings</p>
              <p className="text-purple-800 dark:text-purple-400 text-sm mt-1">
                Adjust the similarity threshold to control how aggressively duplicates are merged.
              </p>
            </div>
            <button
              onClick={() => setShowThresholdSlider(false)}
              className="text-purple-600 hover:text-purple-800"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-purple-900 dark:text-purple-300">
                  Similarity Threshold: {threshold.toFixed(2)}
                </label>
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-3 py-1 rounded-full">
                  {getThresholdLabel(threshold)}
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.7"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400 mt-1">
                <span>More Merges</span>
                <span>Fewer Merges</span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-900">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Threshold Guide:</p>
              <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                <li><span className="font-semibold">0.30-0.40:</span> Very aggressive - may merge different people with similar angles</li>
                <li><span className="font-semibold">0.45-0.55:</span> Balanced - good for most cases, merges clear duplicates</li>
                <li><span className="font-semibold">0.60-0.65:</span> Conservative - only merges very similar faces</li>
                <li><span className="font-semibold">0.70+:</span> Very conservative - only almost identical faces</li>
              </ul>
            </div>

            <button
              onClick={handleAutoMerge}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-semibold"
            >
              Run Auto-Merge with {getThresholdLabel(threshold)} Setting
            </button>
          </div>
        </div>
      )}

      {/* Upload Drop Zone (admin only, shown on People tab) */}
      {album?.is_admin && view === 'people' && (
        <div
          className={`mb-4 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none ${uploadDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setUploadDragging(true) }}
          onDragLeave={() => setUploadDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUploadFiles(Array.from(e.target.files || []))}
          />
          <div className="py-5 px-6 flex items-center gap-4">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {uploading ? 'Uploading...' : 'Drop photos here or click to upload'}
              </p>
              {uploadStatus && (
                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400 font-mono truncate">{uploadStatus}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Yours / People / Photos tab switcher */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        <button
          onClick={handleSwitchToYours}
          className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'yours'
            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          Yours
        </button>
        {album?.is_admin && (
          <button
            onClick={() => setView('people')}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'people'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
            People
          </button>
        )}
        <button
          onClick={() => setView('photos')}
          className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'photos'
            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          Photos
        </button>
      </div>

      {/* Yours loading / error states */}
      {view === 'yours' && yoursLoading && (
        <div className="flex items-center gap-3 py-6 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="text-sm">Scanning for your face…</span>
        </div>
      )}
      {view === 'yours' && !yoursLoading && yoursError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {yoursError === 'No profile photo found'
            ? 'No profile photo set. Upload one in your profile settings to use this feature.'
            : yoursError}
        </div>
      )}
      {view === 'yours' && !yoursLoading && yourPeople !== null && displayedPeople.length === 0 && !yoursError && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No photos of you found in this album.</div>
      )}

      {view === 'photos' ? (
        <div>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort:</label>
              <select
                value={photoSort}
                onChange={(e) => setPhotoSort(e.target.value as 'newest' | 'oldest' | 'filename')}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="filename">Filename A–Z</option>
              </select>
            </div>

            {/* Person filter (admin sees all people, non-admin sees only their matched people) */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Person:</label>
              <select
                value={photoPersonFilter ?? ''}
                onChange={(e) => setPhotoPersonFilter(e.target.value === '' ? null : parseInt(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
              >
                <option value="">All people</option>
                {(album?.is_admin ? people : (yourPeople !== null ? people.filter((p: Person) => yourPeople.includes(p.person_id)) : [])).map((p: Person) => (
                  <option key={p.person_id} value={p.person_id}>{p.name} ({p.photo_count})</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {(photoPersonFilter !== null || photoSort !== 'newest') && (
              <button
                onClick={() => { setPhotoSort('newest'); setPhotoPersonFilter(null) }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear filters
              </button>
            )}

            {/* Loading indicator */}
            {photosFetching && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-400"></div>
                Loading…
              </div>
            )}

            {/* Photo count */}
            {!photosFetching && (
              <span className="ml-auto text-xs text-gray-400">
                {displayedPhotos.length} photo{displayedPhotos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {displayedPhotos.length === 0 && !photosFetching ? (
              <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                {photoPersonFilter !== null ? 'No photos found for this person.' : 'No photos in this album yet.'}
              </div>
            ) : (
              displayedPhotos.map((photo) => (
                <PhotoTile key={`${photo.photo_id}-${photoSort}-${photoPersonFilter}`} photoId={photo.photo_id} />
              ))
            )}
          </div>
        </div>
      ) : (
        (!yoursLoading || view === 'people') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayedPeople.map((person: Person) => (
              <PersonCard
                key={person.person_id}
                person={person}
                mergeMode={mergeMode && view === 'people'}
                isSelected={selectedPeople.includes(person.person_id)}
                onToggleSelect={() => toggleSelection(person.person_id)}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function PhotoTile({ photoId }: { photoId: number }) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const tileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() }
        })
      },
      { rootMargin: '800px', threshold: 0.01 }
    )
    if (tileRef.current) observer.observe(tileRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div
        ref={tileRef}
        className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group relative"
        onClick={() => setShowFull(true)}
      >
        {!imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gray-300 dark:bg-gray-600" />
            )}
            {isVisible && (
              <img
                src={`/api/photo/${photoId}?size=400`}
                alt={`Photo ${photoId}`}
                className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {showFull && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowFull(false)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-sm flex items-center gap-1"
              onClick={() => setShowFull(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
            <img
              src={`/api/photo/${photoId}`}
              alt={`Photo ${photoId}`}
              className="max-w-full max-h-[90vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}

interface PersonCardProps {
  person: Person
  mergeMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
}

function PersonCard({ person, mergeMode, isSelected, onToggleSelect }: PersonCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '1000px',
        threshold: 0.01
      }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    if (mergeMode) {
      e.preventDefault()
      onToggleSelect()
    }
  }

  return (
    <Link
      ref={cardRef}
      href={mergeMode ? '#' : `/person/${person.person_id}`}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all p-4 block relative ${isSelected ? 'ring-4 ring-blue-500' : ''
        }`}
      prefetch={false}
      onClick={handleClick}
    >
      {mergeMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
            }`}>
            {isSelected && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      )}

      <div className="aspect-square bg-gray-200 rounded-md mb-3 overflow-hidden relative">
        {!imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse bg-gray-300 w-full h-full"></div>
              </div>
            )}
            {isVisible && (
              <img
                src={`/api/person/${person.person_id}/face-thumbnail?size=300`}
                alt={person.name}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">👤</span>
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="font-semibold text-gray-900 dark:text-white truncate" title={person.name}>
          {person.name}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{person.photo_count} photos</div>
      </div>
    </Link>
  )
}
