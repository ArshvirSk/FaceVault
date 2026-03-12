'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog, Toast, type ToastData } from '../../components/Toast'

const API_URL = 'http://localhost:8000'

interface Photo {
  photo_id: number
  file_path: string
}

interface AlbumRef {
  album_id: number
  name: string
  photo_count: number
}

interface PersonInfo {
  person_id: number
  name: string
  album_id: number | null
  photo_count: number
  albums: AlbumRef[]
}

const fetchPersonPhotos = async (personId: string, albumId?: number | null): Promise<Photo[]> => {
  const url = albumId
    ? `${API_URL}/person/${personId}/photos?album_id=${albumId}`
    : `${API_URL}/person/${personId}/photos`
  const response = await axios.get(url)
  return response.data.photos
}

const fetchPersonInfo = async (personId: string): Promise<PersonInfo> => {
  const response = await axios.get(`${API_URL}/person/${personId}`, { withCredentials: true })
  return response.data
}

export default function PersonPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const personId = params.id as string
  const [personName, setPersonName] = useState('')
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null) // photo_id pending delete

  const showToast = useCallback((message: string, type: ToastData['type']) => setToast({ message, type }), [])

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['person-photos', personId, selectedAlbumId],
    queryFn: () => fetchPersonPhotos(personId, selectedAlbumId),
    enabled: !!personId,
  })

  const { data: personInfo } = useQuery({
    queryKey: ['person-info', personId],
    queryFn: () => fetchPersonInfo(personId),
    enabled: !!personId,
  })

  // Seed name from API on first load only — never overwrite a user-set value
  useEffect(() => {
    if (personInfo?.name && !personName) {
      setPersonName(personInfo.name)
    }
  }, [personInfo?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = async () => {
    if (!newName.trim()) return

    try {
      await axios.post(`${API_URL}/person/${personId}/rename`, {
        name: newName
      }, { withCredentials: true })
      setPersonName(newName)
      setEditing(false)
      // Invalidate cache so the new name is used on next load
      queryClient.invalidateQueries({ queryKey: ['person-info', personId] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
    } catch {
      showToast('Failed to rename person', 'error')
    }
  }

  const downloadImage = (photoId: number, filename?: string) => {
    const link = document.createElement('a')
    link.href = `/api/photo/${photoId}`
    link.download = filename || `photo_${photoId}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAllPhotos = () => {
    const link = document.createElement('a')
    link.href = `${API_URL}/person/${personId}/photos/zip`
    link.download = `${personName || 'person_' + personId}_photos.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDeletePhoto = async (photoId: number) => {
    setConfirmDelete(photoId)
  }

  const doDeletePhoto = async (photoId: number) => {
    setConfirmDelete(null)
    try {
      await axios.delete(`${API_URL}/photo/${photoId}`, { withCredentials: true })
      setSelectedPhotoIndex(null)
      setShowMetadata(false)
      queryClient.invalidateQueries({ queryKey: ['person-photos', personId] })
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Failed to delete photo', 'error')
    }
  }

  const openLightbox = (index: number) => {
    setSelectedPhotoIndex(index)
  }

  const closeLightbox = () => {
    setSelectedPhotoIndex(null)
    setShowMetadata(false)
  }

  const goToPrevious = useCallback(() => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1)
    }
  }, [selectedPhotoIndex])

  const goToNext = useCallback(() => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1)
    }
  }, [selectedPhotoIndex, photos.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return

      if (e.key === 'ArrowLeft') {
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      } else if (e.key === 'Escape') {
        closeLightbox()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhotoIndex, goToPrevious, goToNext])

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const personAlbums = personInfo?.albums || []
  const isMultiAlbum = personAlbums.length > 1

  return (
    <div>
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {confirmDelete !== null && (
        <ConfirmDialog
          title="Delete Photo"
          message="Delete this photo permanently? This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => doDeletePhoto(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {/* Back button */}
      <button
        onClick={() => {
          if (personInfo?.album_id) {
            router.push(`/albums/${personInfo.album_id}`)
          } else {
            router.back()
          }
        }}
        className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Album
      </button>

      <div className="mb-8 flex items-center justify-between">
        <div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
                placeholder="Enter name"
              />
              <button onClick={handleRename} className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              <button onClick={() => setEditing(false)} className="px-4 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {personName || `Person ${personId}`}
              </h1>
              <button
                onClick={() => { setNewName(personName); setEditing(true) }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Rename
              </button>
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-400 mt-1">{photos.length} photo{photos.length !== 1 ? 's' : ''}{isMultiAlbum && selectedAlbumId ? '' : isMultiAlbum ? ' across all albums' : ''}</p>
        </div>

        <button
          onClick={downloadAllPhotos}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download All
        </button>
      </div>

      {/* Album tabs */}
      {isMultiAlbum && (
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            onClick={() => { setSelectedAlbumId(null); setSelectedPhotoIndex(null) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedAlbumId === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            All albums
            <span className="ml-1.5 text-xs opacity-75">({personInfo?.photo_count})</span>
          </button>
          {personAlbums.map(a => (
            <button
              key={a.album_id}
              onClick={() => { setSelectedAlbumId(a.album_id); setSelectedPhotoIndex(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedAlbumId === a.album_id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              {a.name}
              <span className="ml-1.5 text-xs opacity-75">({a.photo_count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
        {photos.map((photo, index) => (
          <PhotoThumbnail
            key={photo.photo_id}
            photo={photo}
            index={index}
            onOpen={openLightbox}
          />
        ))}
      </div>

      {selectedPhotoIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={selectedPhotoIndex}
          onClose={closeLightbox}
          onPrevious={goToPrevious}
          onNext={goToNext}
          onDownload={downloadImage}
          onDelete={handleDeletePhoto}
          showMetadata={showMetadata}
          onToggleMetadata={() => setShowMetadata(!showMetadata)}
        />
      )}
    </div>
  )
}

function PhotoThumbnail({ photo, index, onOpen }: { photo: Photo; index: number; onOpen: (index: number) => void }) {
  const [loaded, setLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [photopeople, setPhotoPeople] = useState<{ person_id: number; name: string }[] | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            // Don't disconnect - keep observing for scroll performance
          }
        })
      },
      {
        rootMargin: '500px',
        threshold: 0.01
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleMouseEnter = async () => {
    setHovered(true)
    if (photopeople === null) {
      try {
        const res = await axios.get(`${API_URL}/photo/${photo.photo_id}/people`, { withCredentials: true })
        setPhotoPeople(res.data.people)
      } catch {
        setPhotoPeople([])
      }
    }
  }

  return (
    <div
      ref={imgRef}
      className="aspect-square bg-gray-200 rounded overflow-hidden hover:scale-[1.02] hover:shadow-xl transition-all duration-200 cursor-pointer relative group"
      onClick={() => onOpen(index)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Blur placeholder - always visible */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400" />

      {/* Actual image */}
      {isVisible && (
        <img
          src={`/api/photo/${photo.photo_id}?size=400`}
          alt={`Photo ${photo.photo_id}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'
            }`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      )}

      {/* Hover overlay — shows people names */}
      <div className={`absolute inset-0 transition-all duration-200 flex flex-col justify-end ${hovered ? 'bg-black/50' : 'bg-black/0 pointer-events-none'
        }`}>
        {hovered && photopeople && photopeople.length > 0 && (
          <div className="p-1.5 flex flex-wrap gap-1">
            {photopeople.map(p => (
              <span key={p.person_id} className="text-white text-[10px] font-medium bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full truncate max-w-full">
                {p.name}
              </span>
            ))}
          </div>
        )}
        {hovered && (!photopeople || photopeople.length === 0) && (
          <div className="p-1.5">
            <span className="text-white/60 text-[10px]">No faces tagged</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface LightboxProps {
  photos: Photo[]
  currentIndex: number
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  onDownload: (photoId: number) => void
  onDelete: (photoId: number) => void
  showMetadata: boolean
  onToggleMetadata: () => void
}

function Lightbox({ photos, currentIndex, onClose, onPrevious, onNext, onDownload, onDelete, showMetadata, onToggleMetadata }: LightboxProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [metadata, setMetadata] = useState<any>(null)
  const currentPhoto = photos[currentIndex]

  useEffect(() => {
    setImageLoaded(false)
  }, [currentIndex])

  useEffect(() => {
    // Fetch metadata for current photo
    const fetchMetadata = async () => {
      try {
        const response = await axios.get(`${API_URL}/photo/${currentPhoto.photo_id}/metadata`)
        const data = response.data

        setMetadata({
          filename: data.filename,
          filepath: data.filepath,
          size: data.size_kb < 1024 ? `${data.size_kb} KB` : `${data.size_mb} MB`,
          dimensions: `${data.dimensions.width} × ${data.dimensions.height}`,
          format: data.format,
          photoId: data.photo_id
        })
      } catch (error) {
        console.error('Failed to fetch metadata:', error)
        setMetadata({
          filename: currentPhoto.file_path.split(/[\\/]/).pop(),
          filepath: currentPhoto.file_path,
          size: 'Unknown',
          dimensions: 'Unknown',
          format: 'Unknown',
          photoId: currentPhoto.photo_id
        })
      }
    }

    fetchMetadata()
  }, [currentPhoto])

  useEffect(() => {
    if (currentIndex < photos.length - 1) {
      const nextImg = new Image()
      nextImg.src = `/api/photo/${photos[currentIndex + 1].photo_id}`
    }

    if (currentIndex > 0) {
      const prevImg = new Image()
      prevImg.src = `/api/photo/${photos[currentIndex - 1].photo_id}`
    }
  }, [currentIndex, photos])

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
        aria-label="Close"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleMetadata()
        }}
        className="absolute top-4 right-40 text-white hover:text-gray-300 z-10 p-2 bg-black bg-opacity-50 rounded-full"
        title="Show metadata"
        aria-label="Info"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDownload(currentPhoto.photo_id)
        }}
        className="absolute top-4 right-28 text-white hover:text-gray-300 z-10 p-2 bg-black bg-opacity-50 rounded-full"
        title="Download image"
        aria-label="Download"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(currentPhoto.photo_id)
        }}
        className="absolute top-4 right-16 text-white hover:text-red-400 z-10 p-2 bg-black bg-opacity-50 rounded-full"
        title="Delete photo"
        aria-label="Delete"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className="absolute top-4 left-4 text-white text-lg z-10 bg-black bg-opacity-50 px-3 py-1 rounded">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Metadata panel */}
      {showMetadata && metadata && (
        <div
          className="absolute top-20 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg z-10 max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-semibold text-lg mb-3 border-b border-gray-600 pb-2">Image Info</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Filename:</span>
              <p className="font-mono text-xs break-all">{metadata.filename}</p>
            </div>
            <div>
              <span className="text-gray-400">Path:</span>
              <p className="font-mono text-xs break-all">{metadata.filepath}</p>
            </div>
            <div>
              <span className="text-gray-400">Dimensions:</span>
              <p>{metadata.dimensions}</p>
            </div>
            <div>
              <span className="text-gray-400">Format:</span>
              <p>{metadata.format}</p>
            </div>
            <div>
              <span className="text-gray-400">File Size:</span>
              <p>{metadata.size}</p>
            </div>
            <div>
              <span className="text-gray-400">Photo ID:</span>
              <p>{metadata.photoId}</p>
            </div>
          </div>
        </div>
      )}

      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPrevious()
          }}
          className="absolute left-4 text-white hover:text-gray-300 z-10 p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition-all"
          aria-label="Previous"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      <div
        className="max-w-7xl max-h-screen p-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        <img
          src={`/api/photo/${currentPhoto.photo_id}`}
          alt={`Photo ${currentPhoto.photo_id}`}
          className={`max-w-full max-h-[90vh] object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {currentIndex < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="absolute right-4 text-white hover:text-gray-300 z-10 p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition-all"
          aria-label="Next"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
