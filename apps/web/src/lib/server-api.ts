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
 *
 * 失敗時の挙動:
 * - PUBLIC_API_URL が設定されている (= 本番ビルド) 環境では fetch 失敗・空件数
 *   時に throw して GHA / Workers Builds を赤にする。silent fallback で 0 件
 *   ページを本番にデプロイした事故 (topics ページ全 0 件問題, 2026-04-27) の
 *   再発防止。
 * - PUBLIC_API_URL 未設定 (= ローカル `astro dev`) の場合は従来どおり空配列を
 *   返して dev フローを止めない。
 */

import type { Feed, PostWithFeed } from '@tailf/shared'
import type { ApiResponse, CursorResponse } from './api'

interface ApiBaseUrl {
	url: string
	/** True when PUBLIC_API_URL was set (treated as a production build). */
	isProd: boolean
}

/**
 * Get the API base URL for server-side requests
 *
 * Production: https://tailf.pavegy.workers.dev/api (PUBLIC_API_URL)
 * Local dev:  http://localhost:8788/api (fallback)
 */
function getApiBaseUrl(): ApiBaseUrl {
	const apiUrl = import.meta.env.PUBLIC_API_URL
	if (apiUrl) return { url: apiUrl, isProd: true }
	return { url: 'http://localhost:8788/api', isProd: false }
}

function abortInProd(isProd: boolean, message: string): never | undefined {
	if (isProd) throw new Error(message)
	console.error(message)
	return undefined
}

/**
 * Fetch all posts from API (server-side, for SSG)
 * Fetches in batches until no more data
 */
export async function fetchAllPostsForSSG(): Promise<PostWithFeed[]> {
	const { url: baseUrl, isProd } = getApiBaseUrl()
	const allPosts: PostWithFeed[] = []
	let cursor: string | null = null
	const limit = 100

	while (true) {
		const params = new URLSearchParams()
		params.set('limit', String(limit))
		if (cursor) {
			params.set('cursor', cursor)
		}

		const url = `${baseUrl}/posts?${params.toString()}`
		let response: Response
		try {
			response = await fetch(url)
		} catch (error) {
			abortInProd(
				isProd,
				`[SSG] Network error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return allPosts
		}

		if (!response.ok) {
			abortInProd(isProd, `[SSG] Failed to fetch ${url}: ${response.status}`)
			return allPosts
		}

		const result: CursorResponse<PostWithFeed[]> = await response.json()
		allPosts.push(...result.data)

		if (!result.meta.hasMore || !result.meta.nextCursor) {
			break
		}
		cursor = result.meta.nextCursor
	}

	console.log(`[SSG] Fetched ${allPosts.length} posts`)
	if (isProd && allPosts.length === 0) {
		throw new Error(
			`[SSG] Aborting build: ${baseUrl}/posts returned 0 posts. ` +
				`Refusing to deploy SSG pages with empty data.`,
		)
	}
	return allPosts
}

/**
 * Fetch all feeds from API (server-side, for SSG)
 */
export async function fetchFeedsForSSG(): Promise<Feed[]> {
	const { url: baseUrl, isProd } = getApiBaseUrl()
	const url = `${baseUrl}/feeds?perPage=100`

	let response: Response
	try {
		response = await fetch(url)
	} catch (error) {
		abortInProd(
			isProd,
			`[SSG] Network error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`,
		)
		return []
	}

	if (!response.ok) {
		abortInProd(isProd, `[SSG] Failed to fetch ${url}: ${response.status}`)
		return []
	}

	const result: ApiResponse<Feed[]> = await response.json()
	console.log(`[SSG] Fetched ${result.data.length} feeds`)
	if (isProd && result.data.length === 0) {
		throw new Error(
			`[SSG] Aborting build: ${url} returned 0 feeds. ` +
				`Refusing to deploy SSG pages with empty data.`,
		)
	}
	return result.data
}
