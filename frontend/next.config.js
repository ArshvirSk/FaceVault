/** @type {import('next').NextConfig} */

// Parse the backend URL for Next.js remotePatterns (used for <Image> src validation).
// Falls back to localhost:8000 for local development.
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const parsedUrl = new URL(rawApiUrl)

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: parsedUrl.protocol.replace(':', ''),
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
