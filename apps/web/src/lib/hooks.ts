/**
 * TanStack Query hooks for tailf.dev
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

// Query keys
export const queryKeys = {
	posts: {
		all: ['posts'] as const,
		list: (params?: GetPostsParams) => ['posts', 'list', params] as const,
		search: (params: SearchPostsParams) => ['posts', 'search', params] as const,
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
		posts: (params?: GetPostsParams) => ['feed', 'posts', params] as const,
		following: ['feed', 'following'] as const,
	},
}

// Posts
export function usePosts(params?: GetPostsParams) {
	return useQuery({
		queryKey: queryKeys.posts.list(params),
		queryFn: () => getPosts(params),
	})
}

export function useSearchPosts(params: SearchPostsParams) {
	return useQuery({
		queryKey: queryKeys.posts.search(params),
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

// Feed
export function useFeed(params?: GetPostsParams) {
	return useQuery({
		queryKey: queryKeys.feed.posts(params),
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
