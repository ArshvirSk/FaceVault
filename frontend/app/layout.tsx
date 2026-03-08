import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'
import Navigation from './navigation'
import AuthWrapper from './auth-wrapper'

export const metadata: Metadata = {
  title: 'FaceVault',
  description: 'Local AI Face Recognition Photo Organizer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="http://localhost:8000" />
        <link rel="dns-prefetch" href="http://localhost:8000" />
      </head>
      <body>
        <Providers>
          <AuthWrapper>
            <Navigation>
              {children}
            </Navigation>
          </AuthWrapper>
        </Providers>
      </body>
    </html>
  )
}
