/**
 * API client for tailf.dev backend
 */

import type { ApiError, ApiResponse, Blog, Post, PostWithBlog, User } from '@tailf/shared'

const API_BASE = '/api'

/**
 * Build query string from params object, filtering out undefined/null values
 */
function buildQueryString(params: Record<string, unknown>): string {
	const searchParams = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) {
			searchParams.set(key, String(value))
		}
	}
	const query = searchParams.toString()
	return query ? `?${query}` : ''
}

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
// Posts (cursor-based pagination)
// ============================================================

export interface CursorMeta {
	nextCursor: string | null
	hasMore: boolean
}

export interface CursorResponse<T> {
	data: T
	meta: CursorMeta
}

export interface GetPostsParams {
	cursor?: string
	limit?: number
}

export async function getPosts(
	params: GetPostsParams = {},
): Promise<CursorResponse<PostWithBlog[]>> {
	return fetchApi<CursorResponse<PostWithBlog[]>>(`/posts${buildQueryString(params)}`)
}

export interface SearchPostsParams {
	q: string
	cursor?: string
	limit?: number
}

export async function searchPosts(
	params: SearchPostsParams,
): Promise<CursorResponse<PostWithBlog[]>> {
	return fetchApi<CursorResponse<PostWithBlog[]>>(`/posts/search${buildQueryString(params)}`)
}

export async function getRankingPosts(
	period: 'week' | 'month' = 'week',
	limit = 20,
): Promise<ApiResponse<Post[]>> {
	return fetchApi<ApiResponse<Post[]>>(`/posts/ranking${buildQueryString({ period, limit })}`)
}

// ============================================================
// Blogs
// ============================================================

export interface GetBlogsParams {
	page?: number
	perPage?: number
}

export async function getBlogs(params: GetBlogsParams = {}): Promise<ApiResponse<Blog[]>> {
	return fetchApi<ApiResponse<Blog[]>>(`/blogs${buildQueryString(params)}`)
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
// Feed (authenticated, cursor-based pagination)
// ============================================================

export async function getFeed(
	params: GetPostsParams = {},
): Promise<CursorResponse<PostWithBlog[]>> {
	return fetchApi<CursorResponse<PostWithBlog[]>>(`/feed${buildQueryString(params)}`)
}

export async function getFollowingBlogs(): Promise<ApiResponse<Blog[]>> {
	return fetchApi<ApiResponse<Blog[]>>('/feed/following')
}
