'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import { useState, useEffect, useCallback, useRef } from 'react'

const API_URL = 'http://localhost:8000'

interface Photo {
  photo_id: number
  file_path: string
}

const fetchPersonPhotos = async (personId: string): Promise<Photo[]> => {
  const response = await axios.get(`${API_URL}/person/${personId}/photos`)
  return response.data.photos
}

export default function PersonPage() {
  const params = useParams()
  const router = useRouter()
  const personId = params.id as string
  const [personName, setPersonName] = useState('')
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['person-photos', personId],
    queryFn: () => fetchPersonPhotos(personId),
    enabled: !!personId,
  })

  const handleRename = async () => {
    if (!newName.trim()) return
    
    try {
      await axios.post(`${API_URL}/person/${personId}/rename`, {
        name: newName
      }, { withCredentials: true })
      setPersonName(newName)
      setEditing(false)
    } catch (error) {
      alert('Failed to rename person')
    }
  }

  const downloadImage = (photoId: number, filename?: string) => {
    const link = document.createElement('a')
    link.href = `${API_URL}/photo/${photoId}`
    link.download = filename || `photo_${photoId}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAllPhotos = async () => {
    if (!confirm(`Download all ${photos.length} photos for this person?`)) {
      return
    }

    for (let i = 0; i < photos.length; i++) {
      setTimeout(() => {
        downloadImage(photos[i].photo_id, `${personName || 'person_' + personId}_photo_${i + 1}.jpg`)
      }, i * 500)
    }

    alert(`Started downloading ${photos.length} photos. Check your downloads folder.`)
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

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to People
      </button>

      <div className="mb-8 flex items-center justify-between">
        <div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded"
                placeholder="Enter name"
              />
              <button
                onClick={handleRename}
                className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {personName || `Person ${personId}`}
              </h1>
              <button
                onClick={() => {
                  setNewName(personName)
                  setEditing(true)
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Rename
              </button>
            </div>
          )}
          <p className="text-gray-600 mt-1">{photos.length} photos</p>
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

  return (
    <div 
      ref={imgRef}
      className="aspect-square bg-gray-200 rounded overflow-hidden hover:scale-[1.02] hover:shadow-xl transition-all duration-200 cursor-pointer relative group"
      onClick={() => onOpen(index)}
    >
      {/* Blur placeholder - always visible */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400" />
      
      {/* Actual image */}
      {isVisible && (
        <img
          src={`${API_URL}/photo/${photo.photo_id}/thumbnail?size=400`}
          alt={`Photo ${photo.photo_id}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
        <svg 
          className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
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
  showMetadata: boolean
  onToggleMetadata: () => void
}

function Lightbox({ photos, currentIndex, onClose, onPrevious, onNext, onDownload, showMetadata, onToggleMetadata }: LightboxProps) {
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
      nextImg.src = `${API_URL}/photo/${photos[currentIndex + 1].photo_id}`
    }
    
    if (currentIndex > 0) {
      const prevImg = new Image()
      prevImg.src = `${API_URL}/photo/${photos[currentIndex - 1].photo_id}`
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
        className="absolute top-4 right-28 text-white hover:text-gray-300 z-10 p-2 bg-black bg-opacity-50 rounded-full"
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
        className="absolute top-4 right-16 text-white hover:text-gray-300 z-10 p-2 bg-black bg-opacity-50 rounded-full"
        title="Download image"
        aria-label="Download"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
          src={`${API_URL}/photo/${currentPhoto.photo_id}`}
          alt={`Photo ${currentPhoto.photo_id}`}
          className={`max-w-full max-h-[90vh] object-contain transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
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
