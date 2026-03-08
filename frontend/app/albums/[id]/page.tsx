'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const API_URL = 'http://localhost:8000'

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

export default function AlbumPeoplePage() {
  const params = useParams()
  const router = useRouter()
  const albumId = params.id as string
  
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedPeople, setSelectedPeople] = useState<number[]>([])
  const [showThresholdSlider, setShowThresholdSlider] = useState(false)
  const [threshold, setThreshold] = useState(0.5)
  const [privacyMode, setPrivacyMode] = useState('public')
  const queryClient = useQueryClient()

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => fetchAlbum(albumId),
  })

  const { data: peopleData, isLoading, error } = useQuery({
    queryKey: ['people', albumId],
    queryFn: () => fetchPeople(albumId),
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
      alert('Please select at least 2 people to merge')
      return
    }

    const targetId = selectedPeople[0]
    const sourceIds = selectedPeople.slice(1)

    try {
      for (const sourceId of sourceIds) {
        await axios.post(`${API_URL}/person/${sourceId}/merge/${targetId}`, {}, { withCredentials: true })
      }

      alert(`Successfully merged ${sourceIds.length} people into ${people.find(p => p.person_id === targetId)?.name || 'Person ' + targetId}`)
      
      queryClient.invalidateQueries({ queryKey: ['people', albumId] })
      queryClient.invalidateQueries({ queryKey: ['album', albumId] })
      
      setMergeMode(false)
      setSelectedPeople([])
    } catch (error) {
      alert('Failed to merge people')
    }
  }

  const handleAutoMerge = async () => {
    try {
      const response = await axios.post(`${API_URL}/auto-merge?threshold=${threshold}`, {}, { withCredentials: true })
      
      alert(response.data.message)
      
      if (response.data.merged_count > 0) {
        await queryClient.invalidateQueries({ queryKey: ['people', albumId] })
        await queryClient.refetchQueries({ queryKey: ['people', albumId] })
        await queryClient.invalidateQueries({ queryKey: ['album', albumId] })
      }
      
      setShowThresholdSlider(false)
    } catch (error) {
      alert('Failed to auto-merge people')
    }
  }

  const handleRecluster = async () => {
    if (!confirm('This will re-cluster all faces and may find missing people. This will reset all person names. Continue?')) {
      return
    }

    try {
      const response = await axios.post(`${API_URL}/recluster`, {}, { withCredentials: true })
      alert(response.data.message)
      queryClient.invalidateQueries({ queryKey: ['people', albumId] })
      queryClient.invalidateQueries({ queryKey: ['album', albumId] })
    } catch (error) {
      alert('Failed to re-cluster faces')
    }
  }

  const cancelMerge = () => {
    setMergeMode(false)
    setSelectedPeople([])
  }

  const handleLeaveAlbum = async () => {
    if (!confirm('Are you sure you want to leave this album? You will lose access to all photos and people in this album.')) {
      return
    }

    try {
      await axios.post(`${API_URL}/album/${albumId}/leave`, {}, { withCredentials: true })
      alert('You have left the album')
      router.push('/albums')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to leave album')
    }
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
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Albums
        </button>
        
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No People Found</h2>
          <p className="text-gray-600">This album doesn't have any detected faces yet</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Albums
      </button>

      {/* Privacy Mode Banner */}
      {privacyMode === 'private' && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="font-semibold text-purple-900">Private Mode Active</h3>
              <p className="text-sm text-purple-700 mt-1">
                You're only seeing photos of yourself in this album. Other members can only see their own photos.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{album?.name || 'Album'}</h1>
          <p className="text-gray-600 mt-1">{people.length} people found</p>
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

      {album?.is_admin && mergeMode && (
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
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {people.map((person) => (
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
      className={`bg-white rounded-lg shadow hover:shadow-lg transition-all p-4 block relative ${
        isSelected ? 'ring-4 ring-blue-500' : ''
      }`}
      prefetch={false}
      onClick={handleClick}
    >
      {mergeMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
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
        {person.thumbnail && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse bg-gray-300 w-full h-full"></div>
              </div>
            )}
            {isVisible && (
              <img
                src={`${API_URL}/person/${person.person_id}/face-thumbnail?size=300`}
                alt={person.name}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
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
        <div className="font-semibold text-gray-900 truncate" title={person.name}>
          {person.name}
        </div>
        <div className="text-sm text-gray-600">{person.photo_count} photos</div>
      </div>
    </Link>
  )
}
