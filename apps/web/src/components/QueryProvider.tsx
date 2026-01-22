/**
 * QueryProvider using singleton QueryClient
 *
 * All Astro islands share the same QueryClient instance,
 * ensuring cache is shared across components (e.g., UserMenu and MobileNav
 * both calling useCurrentUser() will share the /api/auth/me response).
 */
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/lib/queryClient'

interface QueryProviderProps {
	children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
