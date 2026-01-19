/**
 * API client for tailf.dev backend
 */

import type { ApiError, ApiResponse, Blog, Post, PostWithBlog, User } from '@tailf/shared'

const API_BASE = '/api'

/**
 * Custom API error
 */
export class ApiClientError extends Error {
	constructor(
		message: string,
		public status: number,
		public code?: string,
	) {
		super(message)
		this.name = 'ApiClientError'
	}
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const url = `${API_BASE}${endpoint}`

	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
		credentials: 'include',
	})

	if (!response.ok) {
		const error = (await response.json().catch(() => ({}))) as ApiError
		throw new ApiClientError(
			error.message || `Request failed: ${response.status}`,
			response.status,
			error.error,
		)
	}

	return response.json()
}

// ============================================================
// Auth
// ============================================================

export async function getCurrentUser(): Promise<User | null> {
	const res = await fetchApi<ApiResponse<User | null>>('/auth/me')
	return res.data
}

export async function logout(): Promise<void> {
	await fetchApi('/auth/logout', { method: 'POST' })
}

// ============================================================
// Posts
// ============================================================

export interface GetPostsParams {
	page?: number
	perPage?: number
}

export async function getPosts(params: GetPostsParams = {}): Promise<ApiResponse<PostWithBlog[]>> {
	const searchParams = new URLSearchParams()
	if (params.page) searchParams.set('page', String(params.page))
	if (params.perPage) searchParams.set('perPage', String(params.perPage))

	const query = searchParams.toString()
	return fetchApi<ApiResponse<PostWithBlog[]>>(`/posts${query ? `?${query}` : ''}`)
}

export interface SearchPostsParams {
	q: string
	page?: number
	perPage?: number
}

export async function searchPosts(params: SearchPostsParams): Promise<ApiResponse<Post[]>> {
	const searchParams = new URLSearchParams({ q: params.q })
	if (params.page) searchParams.set('page', String(params.page))
	if (params.perPage) searchParams.set('perPage', String(params.perPage))

	return fetchApi<ApiResponse<Post[]>>(`/posts/search?${searchParams}`)
}

export async function getRankingPosts(
	period: 'week' | 'month' = 'week',
	limit = 20,
): Promise<ApiResponse<Post[]>> {
	const searchParams = new URLSearchParams({
		period,
		limit: String(limit),
	})
	return fetchApi<ApiResponse<Post[]>>(`/posts/ranking?${searchParams}`)
}

// ============================================================
// Blogs
// ============================================================

export interface GetBlogsParams {
	page?: number
	perPage?: number
}

export async function getBlogs(params: GetBlogsParams = {}): Promise<ApiResponse<Blog[]>> {
	const searchParams = new URLSearchParams()
	if (params.page) searchParams.set('page', String(params.page))
	if (params.perPage) searchParams.set('perPage', String(params.perPage))

	const query = searchParams.toString()
	return fetchApi<ApiResponse<Blog[]>>(`/blogs${query ? `?${query}` : ''}`)
}

export async function getBlog(id: string): Promise<ApiResponse<Blog>> {
	return fetchApi<ApiResponse<Blog>>(`/blogs/${id}`)
}

export async function followBlog(blogId: string): Promise<void> {
	await fetchApi(`/blogs/${blogId}/follow`, { method: 'POST' })
}

export async function unfollowBlog(blogId: string): Promise<void> {
	await fetchApi(`/blogs/${blogId}/follow`, { method: 'DELETE' })
}

// ============================================================
// Feed (authenticated)
// ============================================================

export async function getFeed(params: GetPostsParams = {}): Promise<ApiResponse<Post[]>> {
	const searchParams = new URLSearchParams()
	if (params.page) searchParams.set('page', String(params.page))
	if (params.perPage) searchParams.set('perPage', String(params.perPage))

	const query = searchParams.toString()
	return fetchApi<ApiResponse<Post[]>>(`/feed${query ? `?${query}` : ''}`)
}

export async function getFollowingBlogs(): Promise<ApiResponse<Blog[]>> {
	return fetchApi<ApiResponse<Blog[]>>('/feed/following')
}
