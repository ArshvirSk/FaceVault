'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { checkAuth, logout } from '@/lib/auth'

export default function Navigation({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLandingPage = pathname === '/'
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!isLandingPage && !pathname?.startsWith('/auth/')) {
      checkAuth().then(setUser)
    }
  }, [isLandingPage, pathname])

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  if (isLandingPage) {
    return <>{children}</>
  }

  return (
    <>
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              FaceVault
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/albums" className="text-gray-600 hover:text-gray-900 transition-colors">
                Albums
              </Link>
              <Link href="/search" className="text-gray-600 hover:text-gray-900 transition-colors">
                Search
              </Link>
              {user && (
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-300">
                  <span className="text-sm text-gray-700">
                    {user.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </>
  )
}
