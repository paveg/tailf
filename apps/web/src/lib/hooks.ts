/**
 * TanStack Query hooks for tailf.dev
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CursorResponse } from './api'
import {
	followBlog,
	type GetBlogsParams,
	type GetPostsParams,
	getBlog,
	getBlogs,
	getCurrentUser,
	getFeed,
	getFollowingBlogs,
	getPosts,
	getRankingPosts,
	logout,
	type SearchPostsParams,
	searchPosts,
	unfollowBlog,
} from './api'

/**
 * Factory for creating cursor-based infinite query hooks.
 */
function createCursorInfiniteQuery<T>(
	queryKey: readonly unknown[],
	queryFn: (cursor?: string) => Promise<CursorResponse<T[]>>,
	options?: { enabled?: boolean },
) {
	return useInfiniteQuery({
		queryKey,
		queryFn: ({ pageParam }) => queryFn(pageParam),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
		...options,
	})
}

// Query keys
export const queryKeys = {
	posts: {
		all: ['posts'] as const,
		list: (limit?: number) => ['posts', 'list', { limit }] as const,
		search: (q: string, limit?: number) => ['posts', 'search', { q, limit }] as const,
		ranking: (period: 'week' | 'month', limit: number) =>
			['posts', 'ranking', period, limit] as const,
	},
	blogs: {
		all: ['blogs'] as const,
		list: (params?: GetBlogsParams) => ['blogs', 'list', params] as const,
		detail: (id: string) => ['blogs', 'detail', id] as const,
	},
	user: {
		current: ['user', 'current'] as const,
	},
	feed: {
		posts: (limit?: number) => ['feed', 'posts', { limit }] as const,
		following: ['feed', 'following'] as const,
	},
}

// Posts - Infinite scroll with cursor-based pagination
export function useInfinitePosts(limit = 12) {
	return createCursorInfiniteQuery(queryKeys.posts.list(limit), (cursor) =>
		getPosts({ cursor, limit }),
	)
}

export function useInfiniteSearchPosts(q: string, limit = 12) {
	return createCursorInfiniteQuery(
		queryKeys.posts.search(q, limit),
		(cursor) => searchPosts({ q, cursor, limit }),
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

export function useRankingPosts(period: 'week' | 'month' = 'week', limit = 20) {
	return useQuery({
		queryKey: queryKeys.posts.ranking(period, limit),
		queryFn: () => getRankingPosts(period, limit),
	})
}

// Blogs
export function useBlogs(params?: GetBlogsParams) {
	return useQuery({
		queryKey: queryKeys.blogs.list(params),
		queryFn: () => getBlogs(params),
	})
}

export function useBlog(id: string) {
	return useQuery({
		queryKey: queryKeys.blogs.detail(id),
		queryFn: () => getBlog(id),
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
			queryClient.invalidateQueries({ queryKey: queryKeys.feed.posts() })
		},
	})
}

// Feed - Infinite scroll with cursor-based pagination
export function useInfiniteFeed(limit = 12) {
	return createCursorInfiniteQuery(queryKeys.feed.posts(limit), (cursor) =>
		getFeed({ cursor, limit }),
	)
}

// Legacy feed hook
export function useFeed(params?: GetPostsParams) {
	return useQuery({
		queryKey: ['feed', 'legacy', params],
		queryFn: () => getFeed(params),
	})
}

export function useFollowingBlogs() {
	return useQuery({
		queryKey: queryKeys.feed.following,
		queryFn: getFollowingBlogs,
	})
}

// Follow/Unfollow
export function useFollowBlog() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: followBlog,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all })
			queryClient.invalidateQueries({ queryKey: queryKeys.feed.following })
		},
	})
}

export function useUnfollowBlog() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: unfollowBlog,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all })
			queryClient.invalidateQueries({ queryKey: queryKeys.feed.following })
		},
	})
}
