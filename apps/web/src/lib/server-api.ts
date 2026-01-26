/**
 * Server-side API client for build-time data fetching
 * Used by Astro pages during SSG
 *
 * 現在の方式: 全件SSG
 * - ビルド時に全記事を取得してHTMLに埋め込む
 * - 実行時のAPIコール不要（検索以外）
 * - 記事数が増えてHTMLサイズが問題になったら、12件SSG + APIに切り替え可能
 *
 * 切り替え方法:
 * 1. fetchPostsForSSG({ limit: 12 }) を復活させる
 * 2. PostList.tsx を useInfinitePosts + initialData 方式に戻す
 * 3. hooks.ts の useInfinitePosts は initialData 対応済み
 */

import type { Feed, PostWithFeed } from '@tailf/shared'
import type { ApiResponse, CursorResponse } from './api'

/**
 * Get the API base URL for server-side requests
 *
 * Production: https://tailf.pavegy.workers.dev/api
 * Local dev:  http://localhost:8788/api
 *
 * Set via PUBLIC_API_URL env var:
 * - Cloudflare Workers Builds: Configure in dashboard
 * - GHA scheduled builds: Set in secrets
 * - Local: Run API with `pnpm dev:api` (uses fallback)
 */
function getApiBaseUrl(): string {
	const apiUrl = import.meta.env.PUBLIC_API_URL
	if (apiUrl) {
		return apiUrl
	}

	// Fallback for local development
	return 'http://localhost:8788/api'
}

/**
 * Fetch all posts from API (server-side, for SSG)
 * Fetches in batches until no more data
 */
export async function fetchAllPostsForSSG(): Promise<PostWithFeed[]> {
	const baseUrl = getApiBaseUrl()
	const allPosts: PostWithFeed[] = []
	let cursor: string | null = null
	const limit = 100 // Fetch in batches of 100

	try {
		while (true) {
			const params = new URLSearchParams()
			params.set('limit', String(limit))
			if (cursor) {
				params.set('cursor', cursor)
			}

			const url = `${baseUrl}/posts?${params.toString()}`
			const response = await fetch(url)

			if (!response.ok) {
				console.error(`[SSG] Failed to fetch posts: ${response.status}`)
				break
			}

			const result: CursorResponse<PostWithFeed[]> = await response.json()
			allPosts.push(...result.data)

			if (!result.meta.hasMore || !result.meta.nextCursor) {
				break
			}
			cursor = result.meta.nextCursor
		}

		console.log(`[SSG] Fetched ${allPosts.length} posts`)
		return allPosts
	} catch (error) {
		console.error('[SSG] Error fetching posts:', error)
		return allPosts // Return what we have so far
	}
}

/**
 * Fetch all feeds from API (server-side, for SSG)
 */
export async function fetchFeedsForSSG(): Promise<Feed[]> {
	const baseUrl = getApiBaseUrl()

	try {
		const url = `${baseUrl}/feeds?perPage=100`
		const response = await fetch(url)

		if (!response.ok) {
			console.error(`[SSG] Failed to fetch feeds: ${response.status}`)
			return []
		}

		const result: ApiResponse<Feed[]> = await response.json()
		console.log(`[SSG] Fetched ${result.data.length} feeds`)
		return result.data
	} catch (error) {
		console.error('[SSG] Error fetching feeds:', error)
		return []
	}
}
