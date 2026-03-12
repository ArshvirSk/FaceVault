import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
    request: NextRequest,
    { params }: { params: { photoId: string } }
) {
    const { searchParams } = new URL(request.url)
    const size = searchParams.get('size')
    const thumbnail = searchParams.get('thumbnail') === 'true' || size !== null

    const backendUrl = thumbnail
        ? `${API_URL}/photo/${params.photoId}/thumbnail${size ? `?size=${size}` : ''}`
        : `${API_URL}/photo/${params.photoId}`

    const cookie = request.headers.get('cookie') || ''

    const backendRes = await fetch(backendUrl, {
        headers: { cookie },
        cache: 'no-store',
    })

    if (!backendRes.ok) {
        return NextResponse.json({ detail: 'Photo not found' }, { status: backendRes.status })
    }

    const buffer = await backendRes.arrayBuffer()
    const contentType = backendRes.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
        },
    })
}
