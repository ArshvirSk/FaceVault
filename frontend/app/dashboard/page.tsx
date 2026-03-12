'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { API_URL } from '@/lib/config'

export default function DashboardPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/albums') }, [router])
  return null
}

// ─── legacy component removed ─────────────────────────────────────────────
function _noop() {
  const albums: any[] = []

  const fetchAlbums = async () => {
    try {
      const response = await axios.get(`${API_URL}/albums`, { withCredentials: true })
      setAlbums(response.data.albums)
    } catch (error) {
      console.error('Failed to fetch albums', error)
    }
  }

  useEffect(() => {
    fetchAlbums()
  }, [])

  const handleScan = async () => {
    if (!folderPath) return

    setScanning(true)
    setResult(null)
    setProgress(null)

    try {
      const response = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          folder_path: folderPath,
          album_name: albumName || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))
              setProgress(data)

              if (data.stage === 'complete') {
                setResult(data)
                fetchAlbums()
              } else if (data.stage === 'error') {
                alert('Error: ' + data.message)
              }
            }
          }
        }
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setScanning(false)
    }
  }

  const handleFixData = async () => {
    try {
      const diagResponse = await axios.get(`${API_URL}/diagnostics`, { withCredentials: true })
      const diag = diagResponse.data

      if (diag.faces_without_person > 0 || diag.persons_without_faces > 0) {
        const message = `Found issues:\n- ${diag.faces_without_person} faces without person\n- ${diag.persons_without_faces} persons without faces\n\nFix these issues?`

        if (confirm(message)) {
          const fixResponse = await axios.post(`${API_URL}/fix-data`, {}, { withCredentials: true })
          alert(fixResponse.data.message)
        }
      } else {
        alert('No data integrity issues found!')
      }
    } catch (error) {
      alert('Failed to check/fix data')
    }
  }

  const handleRebuildSearchIndex = async () => {
    try {
      const statusResponse = await axios.get(`${API_URL}/search-index-status`, { withCredentials: true })
      const status = statusResponse.data

      const message = `Current search index:\n- ${status.index_size} faces indexed\n- ${status.face_ids_count} face IDs\n\nRebuild search index?`

      if (confirm(message)) {
        const rebuildResponse = await axios.post(`${API_URL}/rebuild-search-index`, {}, { withCredentials: true })
        alert(rebuildResponse.data.message)
      }
    } catch (error) {
      alert('Failed to rebuild search index')
    }
  }

  const handleMigrateToAlbums = async () => {
    try {
      const response = await axios.post(`${API_URL}/migrate-to-albums`, {}, { withCredentials: true })
      alert(response.data.message)
      fetchAlbums()
    } catch (error) {
      alert('Failed to migrate data')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Scan your photo folders to detect and organize faces</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Scan Folder</h2>
          <div className="flex gap-2">
            <button
              onClick={handleMigrateToAlbums}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
            >
              Migrate to Albums
            </button>
            <button
              onClick={handleRebuildSearchIndex}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              Rebuild Search Index
            </button>
            <button
              onClick={handleFixData}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
            >
              Fix Data Issues
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Album Name (optional)
            </label>
            <input
              type="text"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="e.g., Wedding 2024, Birthday Party"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to use folder name</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Path
            </label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="C:\Users\YourName\Pictures"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || !folderPath}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {scanning ? 'Scanning...' : 'Start Scan'}
          </button>
        </div>

        {progress && scanning && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-blue-900 mb-2">
              {progress.stage === 'scanning' && 'Scanning folder...'}
              {progress.stage === 'processing' && `Processing images (${progress.processed}/${progress.total})`}
              {progress.stage === 'clustering' && 'Grouping faces by person...'}
              {progress.stage === 'indexing' && 'Building search index...'}
            </h3>
            {progress.stage === 'processing' && (
              <div className="space-y-2">
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-blue-800">
                  {progress.faces} faces detected so far
                </p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="font-semibold text-green-900 mb-2">Scan Complete!</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>Images processed: {result.images_processed}</li>
              <li>Faces detected: {result.faces_detected}</li>
              <li>Persons found: {result.persons_found}</li>
            </ul>
          </div>
        )}
      </div>

      {albums.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Your Albums</h2>
          <div className="space-y-3">
            {albums.map((album) => (
              <div key={album.album_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                  <h3 className="font-semibold text-gray-900">{album.name}</h3>
                  <p className="text-sm text-gray-600">{album.folder_path}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {album.photo_count} photos • {album.person_count} people
                  </p>
                </div>
                <Link
                  href={`/albums/${album.album_id}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  View Album
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
