/**
 * API client for tailf backend
 */

import type {
	ApiError,
	ApiResponse,
	Feed,
	FeedWithAuthor,
	Post,
	PostWithFeed,
	User,
} from '@tailf/shared'

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
			error.message || error.error || `Request failed: ${response.status}`,
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

export type SortOption = 'recent' | 'popular'

export interface GetPostsParams {
	cursor?: string
	limit?: number
	techOnly?: boolean
	official?: boolean
	sort?: SortOption
}

export async function getPosts(
	params: GetPostsParams = {},
): Promise<CursorResponse<PostWithFeed[]>> {
	return fetchApi<CursorResponse<PostWithFeed[]>>(`/posts${buildQueryString(params)}`)
}

export interface SearchPostsParams {
	q: string
	cursor?: string
	limit?: number
	techOnly?: boolean
	official?: boolean
}

export async function searchPosts(
	params: SearchPostsParams,
): Promise<CursorResponse<PostWithFeed[]>> {
	return fetchApi<CursorResponse<PostWithFeed[]>>(`/posts/search${buildQueryString(params)}`)
}

export async function getRankingPosts(
	period: 'week' | 'month' = 'week',
	limit = 20,
	techOnly = false,
): Promise<ApiResponse<Post[]>> {
	return fetchApi<ApiResponse<Post[]>>(
		`/posts/ranking${buildQueryString({ period, limit, techOnly })}`,
	)
}

// ============================================================
// Feeds
// ============================================================

export interface GetFeedsParams {
	page?: number
	perPage?: number
	official?: boolean
}

export async function getFeeds(
	params: GetFeedsParams = {},
): Promise<ApiResponse<FeedWithAuthor[]>> {
	return fetchApi<ApiResponse<FeedWithAuthor[]>>(`/feeds${buildQueryString(params)}`)
}

export async function getFeedById(id: string): Promise<ApiResponse<Feed>> {
	return fetchApi<ApiResponse<Feed>>(`/feeds/${id}`)
}

export interface RegisterFeedParams {
	feedUrl: string
}

export interface RegisterFeedResponse {
	data: Feed
	meta: { postsImported: number }
}

export async function registerFeed(params: RegisterFeedParams): Promise<RegisterFeedResponse> {
	return fetchApi<RegisterFeedResponse>('/feeds', {
		method: 'POST',
		body: JSON.stringify(params),
	})
}

export async function bookmarkFeed(feedId: string): Promise<void> {
	await fetchApi(`/feeds/${feedId}/bookmark`, { method: 'POST' })
}

export async function unbookmarkFeed(feedId: string): Promise<void> {
	await fetchApi(`/feeds/${feedId}/bookmark`, { method: 'DELETE' })
}

export interface FeedWithPostCount extends Feed {
	postCount: number
}

export async function getMyFeeds(): Promise<ApiResponse<FeedWithPostCount[]>> {
	return fetchApi<ApiResponse<FeedWithPostCount[]>>('/feeds/mine')
}

export async function deleteFeed(feedId: string): Promise<void> {
	await fetchApi(`/feeds/${feedId}`, { method: 'DELETE' })
}

// ============================================================
// User Feed (authenticated, cursor-based pagination)
// ============================================================

export async function getUserFeed(
	params: GetPostsParams = {},
): Promise<CursorResponse<PostWithFeed[]>> {
	return fetchApi<CursorResponse<PostWithFeed[]>>(`/feed${buildQueryString(params)}`)
}

export async function getBookmarkedFeeds(): Promise<ApiResponse<Feed[]>> {
	return fetchApi<ApiResponse<Feed[]>>('/feed/bookmarks')
}
