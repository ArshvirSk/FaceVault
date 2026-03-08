'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import { useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const API_URL = 'http://localhost:8000'

interface Photo {
  photo_id: number
  file_path: string
}

const fetchPersonPhotos = async (personId: string): Promise<Photo[]> => {
  const response = await axios.get(`${API_URL}/person/${personId}/photos`)
  return response.data.photos
}

export default function PersonPageVirtualized() {
  const params = useParams()
  const router = useRouter()
  const personId = params.id as string
  const [personName, setPersonName] = useState('')
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['person-photos', personId],
    queryFn: () => fetchPersonPhotos(personId),
    enabled: !!personId,
  })

  // Calculate grid layout
  const COLUMNS = 6
  const ITEM_SIZE = 200 // Approximate size
  const GAP = 16

  // Group photos into rows
  const rows = []
  for (let i = 0; i < photos.length; i += COLUMNS) {
    rows.push(photos.slice(i, i + COLUMNS))
  }

  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE + GAP,
    overscan: 3, // Render 3 extra rows above/below viewport
  })

  // ... rest of the component logic (rename, download, lightbox handlers)

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      {/* Header with back button, rename, download all */}
      
      <div
        ref={parentRef}
        className="h-[calc(100vh-200px)] overflow-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-6 gap-4"
              >
                {row.map((photo, colIndex) => {
                  const photoIndex = virtualRow.index * COLUMNS + colIndex
                  return (
                    <PhotoThumbnail
                      key={photo.photo_id}
                      photo={photo}
                      index={photoIndex}
                      onOpen={openLightbox}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lightbox */}
    </div>
  )
}
