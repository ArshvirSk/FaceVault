'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,       // 30 seconds — short enough to re-fetch after login
        gcTime: 5 * 60 * 1000,      // keep cache 5 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: true,        // always re-fetch stale data when a component mounts
        retry: false,                // don't retry on 401/403 — redirect to login instead
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
