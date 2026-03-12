'use client'

import { checkAuth, logout } from '@/lib/auth'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'

const API_URL = 'http://localhost:8000'

function useDarkMode() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('fv-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('fv-theme', 'light')
    }
  }

  return { dark, toggle }
}

export default function Navigation({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLandingPage = pathname === '/'
  const [user, setUser] = useState<any>(null)
  const { dark, toggle } = useDarkMode()

  useEffect(() => {
    if (!isLandingPage && !pathname?.startsWith('/auth/')) {
      checkAuth().then(setUser)
    }
  }, [isLandingPage, pathname])

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  // Initial of username for avatar fallback
  const initial = user?.username?.[0]?.toUpperCase() ?? '?'

  if (isLandingPage) {
    return <>{children}</>
  }

  return (
    <>
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              FaceVault
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/albums" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Albums
              </Link>
              <Link href="/search" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Search
              </Link>

              {/* Dark mode toggle */}
              <button
                onClick={toggle}
                aria-label="Toggle dark mode"
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {dark ? (
                  // Sun icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.36l-.71.71M5.64 18.36l-.71.71M18.36 18.36l-.71-.71M5.64 5.64l-.71-.71M12 7a5 5 0 100 10A5 5 0 0012 7z" />
                  </svg>
                ) : (
                  // Moon icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>

              {user && (
                <div className="flex items-center gap-3 ml-2 pl-4 border-l border-gray-200 dark:border-gray-700">
                  <Link href="/profile" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      <img
                        src={`${API_URL}/profile-photo/${user.user_id}`}
                        alt={user.username}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className="absolute text-xs font-semibold text-white">{initial}</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors font-medium">
                      {user.username}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
