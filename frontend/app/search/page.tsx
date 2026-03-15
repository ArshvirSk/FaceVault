'use client'

import { API_URL } from '@/lib/config'
import axios from 'axios'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { Toast, type ToastData } from '../components/Toast'

interface SearchResult {
  photo_id: number
  file_path: string
  person_id: number
  person_name: string
  album_id: number | null
  album_name: string
  similarity: number
  distance: number
}

export default function SearchPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [noResults, setNoResults] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)

      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSearch = async () => {
    if (!selectedFile) return

    setSearching(true)
    setResults([])
    setNoResults(false)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await axios.post(`${API_URL}/search-face`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000 // 30 second timeout
      })

      const photos = response.data.photos || []
      setResults(photos)

      if (photos.length === 0) {
        setNoResults(true)
      }
    } catch (error: any) {
      console.error('Search error:', error)
      if (error.response?.status === 400) {
        setToast({ message: error.response.data.detail || 'No face detected. Please upload a clear photo with a visible face.', type: 'error' })
      } else if (error.code === 'ECONNABORTED') {
        setToast({ message: 'Search timed out. Please try again.', type: 'error' })
      } else {
        setToast({ message: 'Search failed: ' + (error.response?.data?.detail || error.message), type: 'error' })
      }
    } finally {
      setSearching(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResults([])
    setNoResults(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Face Search</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Upload a photo to find similar faces in your collection</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Upload Photo</h2>

          {!previewUrl ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400 mb-2">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">PNG, JPG, WEBP up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-64 object-contain bg-gray-100 dark:bg-gray-700 rounded-lg"
                />
                <button
                  onClick={clearSelection}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedFile?.name}
              </div>

              <button
                onClick={handleSearch}
                disabled={searching}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {searching ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search for Similar Faces
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">How it works</h3>
          <ul className="space-y-2 text-blue-800 dark:text-blue-300">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Upload a photo containing a face</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>AI detects and analyzes the face</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Finds similar faces in your collection</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Results sorted by similarity</span>
            </li>
          </ul>
        </div>
      </div>

      {/* No Results Message */}
      {noResults && !searching && results.length === 0 && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No similar faces found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">This person may not be in your collection yet, or try a clearer photo.</p>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">
            Found {results.length} matching {results.length === 1 ? 'photo' : 'photos'}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map((result) => (
              <Link
                key={result.photo_id}
                href={`/person/${result.person_id}`}
                className="group"
              >
                <div className="bg-white dark:bg-gray-700 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                  <div className="aspect-square bg-gray-200 relative">
                    <img
                      src={`/api/photo/${result.photo_id}?size=300`}
                      alt={result.person_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      {result.similarity}%
                    </div>
                  </div>
                  <div className="p-2 text-center">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-blue-600">
                      {result.person_name}
                    </div>
                    {result.album_name && (
                      <div
                        className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 hover:text-blue-500"
                        title={result.album_name}
                        onClick={e => {
                          e.preventDefault()
                          if (result.album_id) window.location.href = `/albums/${result.album_id}`
                        }}
                      >
                        {result.album_name}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
