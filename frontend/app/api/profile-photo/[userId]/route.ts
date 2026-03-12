import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    // Forward the session cookie so the backend can authenticate
    const cookie = request.headers.get('cookie') || ''

    const backendRes = await fetch(`${API_URL}/profile-photo/${params.userId}`, {
        headers: { cookie },
        cache: 'no-store',
    })

    if (!backendRes.ok) {
        return NextResponse.json(
            { detail: 'Profile photo not found' },
            { status: backendRes.status }
        )
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
