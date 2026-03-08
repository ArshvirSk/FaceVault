'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { useState } from 'react'

const API_URL = 'http://localhost:8000'

interface Album {
  album_id: number
  name: string
  folder_path: string
  created_at: string
  photo_count: number
  person_count: number
}

const fetchAlbums = async (): Promise<Album[]> => {
  const response = await axios.get(`${API_URL}/albums`, { withCredentials: true })
  return response.data.albums
}

export default function AlbumsPage() {
  const { data: albums = [], isLoading, error } = useQuery({
    queryKey: ['albums'],
    queryFn: fetchAlbums,
  })

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading albums...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-red-600 mb-2">Error Loading Albums</h2>
        <p className="text-gray-600">Please try again later</p>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <svg className="w-24 h-24 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Albums Yet</h2>
        <p className="text-gray-600 mb-6">Scan a folder to create your first album</p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Go to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Albums</h1>
        <p className="text-gray-600 mt-1">{albums.length} albums</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {albums.map((album) => (
          <AlbumCard key={album.album_id} album={album} />
        ))}
      </div>
    </div>
  )
}

function AlbumCard({ album }: { album: Album }) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(album.name)
  const queryClient = useQueryClient()

  const formattedDate = new Date(album.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const handleRename = async () => {
    if (!newName.trim()) return
    
    try {
      await axios.post(`${API_URL}/album/${album.album_id}/rename`, {
        name: newName
      }, { withCredentials: true })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      setEditing(false)
    } catch (error) {
      alert('Failed to rename album')
    }
  }

  const handleCancel = () => {
    setNewName(album.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Album Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter album name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') handleCancel()
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRename}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100 group relative">
      <Link href={`/albums/${album.album_id}`}>
        <div className="aspect-video bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 flex items-center justify-center relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute inset-0 opacity-20">
            <div className="grid grid-cols-4 gap-1 p-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-400 rounded"></div>
              ))}
            </div>
          </div>
          
          {/* Icon */}
          <div className="relative z-10 bg-white rounded-2xl p-4 shadow-lg group-hover:scale-110 transition-transform">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>
      </Link>

      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <Link href={`/albums/${album.album_id}`} className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {album.name}
            </h3>
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault()
              setEditing(true)
            }}
            className="ml-2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Rename album"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4 truncate" title={album.folder_path}>
          {album.folder_path}
        </p>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{album.photo_count}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{album.person_count}</span>
            </div>
          </div>
          <span className="text-gray-500">{formattedDate}</span>
        </div>
      </div>
    </div>
  )
}
