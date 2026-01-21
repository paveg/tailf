/**
 * TanStack Query hooks for tailf
 */
import type { PostWithFeed } from '@tailf/shared'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CursorResponse, SortOption } from './api'
import {
	bookmarkFeed,
	deleteFeed,
	type GetFeedsParams,
	type GetPostsParams,
	getBookmarkedFeeds,
	getCurrentUser,
	getFeedById,
	getFeeds,
	getMyFeeds,
	getPosts,
	getRankingPosts,
	getUserFeed,
	logout,
	type RegisterFeedParams,
	registerFeed,
	type SearchPostsParams,
	searchPosts,
	unbookmarkFeed,
} from './api'

/**
 * Options for cursor-based infinite query hooks.
 */
interface CursorInfiniteQueryOptions<T> {
	enabled?: boolean
	initialData?: CursorResponse<T[]>
	/** Set to 0 for SWR pattern (always revalidate) */
	staleTime?: number
}

/**
 * Factory for creating cursor-based infinite query hooks.
 * Supports SWR pattern: pass initialData (SSG) + staleTime: 0 to always fetch fresh data from API.
 */
function createCursorInfiniteQuery<T>(
	queryKey: readonly unknown[],
	queryFn: (cursor?: string) => Promise<CursorResponse<T[]>>,
	options?: CursorInfiniteQueryOptions<T>,
) {
	const { initialData, staleTime, ...restOptions } = options ?? {}

	return useInfiniteQuery({
		queryKey,
		queryFn: ({ pageParam }) => queryFn(pageParam),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
		staleTime,
		...(initialData && {
			initialData: {
				pages: [initialData],
				pageParams: [undefined],
			},
		}),
		...restOptions,
	})
}

// Query keys
export const queryKeys = {
	posts: {
		all: ['posts'] as const,
		list: (limit?: number, techOnly?: boolean, official?: boolean, sort?: SortOption) =>
			['posts', 'list', { limit, techOnly, official, sort }] as const,
		search: (q: string, limit?: number, techOnly?: boolean, official?: boolean) =>
			['posts', 'search', { q, limit, techOnly, official }] as const,
		ranking: (period: 'week' | 'month', limit: number, techOnly?: boolean) =>
			['posts', 'ranking', period, limit, techOnly] as const,
	},
	feeds: {
		all: ['feeds'] as const,
		list: (params?: GetFeedsParams) => ['feeds', 'list', params] as const,
		detail: (id: string) => ['feeds', 'detail', id] as const,
		mine: ['feeds', 'mine'] as const,
	},
	user: {
		current: ['user', 'current'] as const,
	},
	userFeed: {
		posts: (limit?: number, techOnly?: boolean) =>
			['userFeed', 'posts', { limit, techOnly }] as const,
		bookmarked: ['userFeed', 'bookmarked'] as const,
	},
}

// Posts - Infinite scroll with cursor-based pagination
export function useInfinitePosts(
	limit = 12,
	techOnly = false,
	official?: boolean,
	sort: SortOption = 'recent',
	initialData?: CursorResponse<PostWithFeed[]>,
) {
	return createCursorInfiniteQuery(
		queryKeys.posts.list(limit, techOnly, official, sort),
		(cursor) => getPosts({ cursor, limit, techOnly, official, sort }),
		{ initialData },
	)
}

export function useInfiniteSearchPosts(
	q: string,
	limit = 12,
	techOnly = false,
	official?: boolean,
) {
	return createCursorInfiniteQuery(
		queryKeys.posts.search(q, limit, techOnly, official),
		(cursor) => searchPosts({ q, cursor, limit, techOnly, official }),
		{ enabled: q.length >= 2 },
	)
}

// Legacy hooks for backward compatibility
export function usePosts(params?: GetPostsParams) {
	return useQuery({
		queryKey: ['posts', 'legacy', params],
		queryFn: () => getPosts(params),
	})
}

export function useSearchPosts(params: SearchPostsParams) {
	return useQuery({
		queryKey: ['posts', 'search-legacy', params],
		queryFn: () => searchPosts(params),
		enabled: params.q.length > 0,
	})
}

export function useRankingPosts(period: 'week' | 'month' = 'week', limit = 20, techOnly = false) {
	return useQuery({
		queryKey: queryKeys.posts.ranking(period, limit, techOnly),
		queryFn: () => getRankingPosts(period, limit, techOnly),
	})
}

// Feeds
export function useFeeds(params?: GetFeedsParams) {
	return useQuery({
		queryKey: queryKeys.feeds.list(params),
		queryFn: () => getFeeds(params),
	})
}

export function useFeed(id: string) {
	return useQuery({
		queryKey: queryKeys.feeds.detail(id),
		queryFn: () => getFeedById(id),
		enabled: !!id,
	})
}

// Auth
export function useCurrentUser() {
	return useQuery({
		queryKey: queryKeys.user.current,
		queryFn: getCurrentUser,
		retry: false,
		staleTime: 5 * 60 * 1000,
	})
}

export function useLogout() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: logout,
		onSuccess: () => {
			queryClient.setQueryData(queryKeys.user.current, null)
			queryClient.invalidateQueries({ queryKey: queryKeys.userFeed.posts() })
		},
	})
}

// User Feed - Infinite scroll with cursor-based pagination
export function useInfiniteUserFeed(limit = 12, techOnly = false) {
	return createCursorInfiniteQuery(queryKeys.userFeed.posts(limit, techOnly), (cursor) =>
		getUserFeed({ cursor, limit, techOnly }),
	)
}

// Legacy user feed hook
export function useUserFeed(params?: GetPostsParams) {
	return useQuery({
		queryKey: ['userFeed', 'legacy', params],
		queryFn: () => getUserFeed(params),
	})
}

export function useBookmarkedFeeds() {
	return useQuery({
		queryKey: queryKeys.userFeed.bookmarked,
		queryFn: getBookmarkedFeeds,
	})
}

// Feed Registration
export function useRegisterFeed() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (params: RegisterFeedParams) => registerFeed(params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
			queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
		},
	})
}

// Bookmark/Unbookmark
export function useBookmarkFeed() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: bookmarkFeed,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
			queryClient.invalidateQueries({ queryKey: queryKeys.userFeed.bookmarked })
		},
	})
}

export function useUnbookmarkFeed() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: unbookmarkFeed,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
			queryClient.invalidateQueries({ queryKey: queryKeys.userFeed.bookmarked })
		},
	})
}

// My Feeds
export function useMyFeeds() {
	return useQuery({
		queryKey: queryKeys.feeds.mine,
		queryFn: getMyFeeds,
	})
}

export function useDeleteFeed() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: deleteFeed,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.feeds.mine })
			queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
			queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
		},
	})
}
