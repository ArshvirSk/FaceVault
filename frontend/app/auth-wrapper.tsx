'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { checkAuth, checkHasUsers } from '@/lib/auth';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function verify() {
      // Skip auth check for landing, auth pages, and invite pages
      if (pathname === '/' || pathname?.startsWith('/auth/') || pathname?.startsWith('/invite/')) {
        setLoading(false);
        return;
      }

      const currentUser = await checkAuth();
      
      if (!currentUser) {
        // Check if any users exist
        const hasUsers = await checkHasUsers();
        if (hasUsers) {
          router.push('/auth/login');
        } else {
          router.push('/auth/register');
        }
      } else {
        setUser(currentUser);
      }
      
      setLoading(false);
    }

    verify();
  }, [pathname, router]);

  // Don't show loading on public pages
  if (pathname === '/' || pathname?.startsWith('/auth/') || pathname?.startsWith('/invite/')) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
