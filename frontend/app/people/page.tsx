'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog, Toast, type ToastData } from '../components/Toast'

const API_URL = 'http://localhost:8000'

interface Person {
  person_id: number
  name: string
  photo_count: number
  album_id: number | null
  thumbnail?: any
}

const fetchPeople = async (albumId?: string | null): Promise<Person[]> => {
  const url = albumId ? `${API_URL}/people?album_id=${albumId}` : `${API_URL}/people`
  const response = await axios.get(url, { withCredentials: true })
  return response.data.persons
}

export default function PeoplePage() {
  const searchParams = useSearchParams()
  const albumId = searchParams.get('album')

  const [mergeMode, setMergeMode] = useState(false)
  const [selectedPeople, setSelectedPeople] = useState<number[]>([])
  const [showThresholdSlider, setShowThresholdSlider] = useState(false)
  const [threshold, setThreshold] = useState(0.5)
  const [filterQuery, setFilterQuery] = useState('')
  const [sortBy, setSortBy] = useState<'photos' | 'az' | 'za'>('photos')
  const [toast, setToast] = useState<ToastData | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const queryClient = useQueryClient()

  const showToast = useCallback((message: string, type: ToastData['type']) => setToast({ message, type }), [])

  const { data: people = [], isLoading, error } = useQuery({
    queryKey: ['people', albumId],
    queryFn: () => fetchPeople(albumId),
  })

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
      showToast(`Merged ${sourceIds.length} ${sourceIds.length === 1 ? 'person' : 'people'} into ${people.find(p => p.person_id === targetId)?.name || 'Person ' + targetId}`, 'success')
      queryClient.invalidateQueries({ queryKey: ['people'] })
      setMergeMode(false)
      setSelectedPeople([])
    } catch {
      showToast('Failed to merge people', 'error')
    }
  }

  const handleAutoMerge = async () => {
    try {
      const response = await axios.post(`${API_URL}/auto-merge?threshold=${threshold}`, {}, { withCredentials: true })
      showToast(response.data.message, 'success')
      if (response.data.merged_count > 0) {
        await queryClient.invalidateQueries({ queryKey: ['people'] })
        await queryClient.refetchQueries({ queryKey: ['people'] })
      }
      setShowThresholdSlider(false)
    } catch {
      showToast('Failed to auto-merge people', 'error')
    }
  }

  const handleRecluster = () => {
    setConfirm({
      title: 'Re-cluster All Faces',
      message: 'This will re-cluster all faces and may find missing people. All person names will be reset. Continue?',
      onConfirm: async () => {
        setConfirm(null)
        try {
          const response = await axios.post(`${API_URL}/recluster`, {}, { withCredentials: true })
          showToast(response.data.message, 'success')
          queryClient.invalidateQueries({ queryKey: ['people'] })
        } catch {
          showToast('Failed to re-cluster faces', 'error')
        }
      },
    })
  }

  const cancelMerge = () => {
    setMergeMode(false)
    setSelectedPeople([])
  }

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
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">No People Found</h2>
        <p className="text-gray-600">Scan a folder to detect faces</p>
      </div>
    )
  }

  return (
    <div>
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Confirm"
          danger
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">People {albumId && '- Album View'}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{people.length} people found</p>
          {albumId && (
            <Link href="/people" className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block">
              ← View all people
            </Link>
          )}
        </div>

        <div className="flex gap-2">
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
        </div>
      </div>

      {mergeMode && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-900 font-semibold">Merge Mode Active</p>
          <p className="text-blue-800 text-sm mt-1">
            Select 2 or more people to merge them together. All faces will be combined into the first selected person.
          </p>
        </div>
      )}

      {showThresholdSlider && (
        <div className="mb-6 p-6 bg-purple-50 border border-purple-200 rounded-md">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-purple-900 font-semibold text-lg">Auto-Merge Settings</p>
              <p className="text-purple-800 text-sm mt-1">
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
                <label className="text-sm font-medium text-purple-900">
                  Similarity Threshold: {threshold.toFixed(2)}
                </label>
                <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
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
              <div className="flex justify-between text-xs text-purple-600 mt-1">
                <span>More Merges</span>
                <span>Fewer Merges</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded border border-purple-200">
              <p className="text-xs text-gray-600 mb-2">Threshold Guide:</p>
              <ul className="text-xs text-gray-700 space-y-1">
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

      {/* Name filter + sort */}
      {people.length > 6 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative max-w-sm flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Filter by name…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
          >
            <option value="photos">Most photos</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {(filterQuery.trim() ? people.filter(p => p.name.toLowerCase().includes(filterQuery.toLowerCase())) : people)
          .slice()
          .sort((a, b) => {
            if (sortBy === 'az') return a.name.localeCompare(b.name)
            if (sortBy === 'za') return b.name.localeCompare(a.name)
            return b.photo_count - a.photo_count // 'photos' default
          })
          .map((person) => (
            <PersonCard
              key={person.person_id}
              person={person}
              mergeMode={mergeMode}
              isSelected={selectedPeople.includes(person.person_id)}
              onToggleSelect={() => toggleSelection(person.person_id)}
            />
          ))}
      </div>
    </div>
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
        rootMargin: '1000px', // Start loading 1000px before visible (very aggressive)
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
