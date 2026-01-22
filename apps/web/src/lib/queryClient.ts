/**
 * Singleton QueryClient for sharing cache across Astro islands
 *
 * Astro islands are isolated React trees, but they can share a QueryClient
 * by using a module-level singleton. This ensures:
 * - Single /api/auth/me call instead of multiple (UserMenu + MobileNav)
 * - Shared cache for all queries
 * - Consistent configuration
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000, // 1 minute
			refetchOnWindowFocus: false,
		},
	},
})
