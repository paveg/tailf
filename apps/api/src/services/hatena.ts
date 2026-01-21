/**
 * Hatena Bookmark API service
 *
 * API endpoint: https://bookmark.hatenaapis.com/count/entry?url=<URL>
 * Returns: number (bookmark count)
 */

import { eq, gte, isNull, or } from 'drizzle-orm'
import type { Database } from '../db'
import { posts } from '../db/schema'

const HATENA_BOOKMARK_API = 'https://bookmark.hatenaapis.com/count/entry'

/**
 * Fetch bookmark count for a single URL
 */
export async function getBookmarkCount(url: string): Promise<number> {
	try {
		const apiUrl = `${HATENA_BOOKMARK_API}?url=${encodeURIComponent(url)}`
		const response = await fetch(apiUrl)

		if (!response.ok) {
			console.warn(`[Hatena] Failed to fetch bookmark count for ${url}: ${response.status}`)
			return 0
		}

		const count = await response.json()
		return typeof count === 'number' ? count : 0
	} catch (error) {
		console.warn(`[Hatena] Error fetching bookmark count for ${url}:`, error)
		return 0
	}
}

/**
 * Fetch bookmark counts for multiple URLs in batch
 * Note: Hatena API doesn't support batch requests, so we fetch sequentially with delay
 */
export async function getBookmarkCounts(
	urls: string[],
	delayMs = 100,
): Promise<Map<string, number>> {
	const counts = new Map<string, number>()

	for (const url of urls) {
		const count = await getBookmarkCount(url)
		counts.set(url, count)

		// Rate limiting: add delay between requests
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs))
		}
	}

	return counts
}

/**
 * Update bookmark counts for recent posts (called by scheduled handler)
 * - Posts with NULL bookmark count (newly fetched)
 * - Posts from last 7 days (refresh existing counts)
 */
export async function updateRecentBookmarkCounts(db: Database): Promise<{ updated: number }> {
	const now = new Date()
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

	// Get posts that need bookmark count update
	// Limit to 30 per run to avoid timeout (Workers has 30s limit)
	const postsToUpdate = await db.query.posts.findMany({
		where: or(isNull(posts.hatenaBookmarkCount), gte(posts.publishedAt, weekAgo)),
		columns: { id: true, url: true },
		limit: 30,
	})

	if (postsToUpdate.length === 0) {
		console.log('[Hatena] No posts to update')
		return { updated: 0 }
	}

	console.log(`[Hatena] Updating bookmark counts for ${postsToUpdate.length} posts`)

	let updated = 0
	for (const post of postsToUpdate) {
		try {
			const count = await getBookmarkCount(post.url)
			await db.update(posts).set({ hatenaBookmarkCount: count }).where(eq(posts.id, post.id))
			updated++
			// Rate limiting: 100ms between requests
			await new Promise((resolve) => setTimeout(resolve, 100))
		} catch (error) {
			console.warn(`[Hatena] Failed to update ${post.id}:`, error)
		}
	}

	console.log(`[Hatena] Updated ${updated} posts`)
	return { updated }
}
