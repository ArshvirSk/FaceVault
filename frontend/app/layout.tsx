import type { Metadata } from 'next'
import AuthWrapper from './auth-wrapper'
import './globals.css'
import Navigation from './navigation'
import { Providers } from './providers'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fv-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
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
