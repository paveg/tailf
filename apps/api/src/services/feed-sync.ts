/**
 * Feed sync service
 * Syncs official feeds from static list to database
 */
import { count, eq } from 'drizzle-orm'
import { OFFICIAL_FEEDS } from '../data/official-feeds'
import type { Database } from '../db'
import { feedBookmarks, feeds } from '../db/schema'
import { generateId } from '../utils/id'

export interface SyncResult {
	added: string[]
	updated: string[]
	unchanged: string[]
	errors: { url: string; error: string }[]
}

/**
 * Get feeds that need to be added or updated
 */
export async function getDiff(db: Database): Promise<{
	toAdd: typeof OFFICIAL_FEEDS
	toUpdate: Array<{ id: string; label: string; url: string }>
	unchanged: typeof OFFICIAL_FEEDS
}> {
	const existingFeeds = await db.query.feeds.findMany({
		columns: { id: true, feedUrl: true, title: true },
	})

	const existingByUrl = new Map(existingFeeds.map((f) => [f.feedUrl, { id: f.id, title: f.title }]))

	const toAdd: typeof OFFICIAL_FEEDS = []
	const toUpdate: Array<{ id: string; label: string; url: string }> = []
	const unchanged: typeof OFFICIAL_FEEDS = []

	for (const feed of OFFICIAL_FEEDS) {
		const existing = existingByUrl.get(feed.url)
		if (!existing) {
			toAdd.push(feed)
		} else if (existing.title !== feed.label) {
			toUpdate.push({ id: existing.id, label: feed.label, url: feed.url })
		} else {
			unchanged.push(feed)
		}
	}

	return { toAdd, toUpdate, unchanged }
}

/**
 * Sync official feeds to database
 * Adds new feeds and updates labels for existing ones (upsert by URL)
 */
export async function syncOfficialFeeds(db: Database, dryRun = false): Promise<SyncResult> {
	const result: SyncResult = {
		added: [],
		updated: [],
		unchanged: [],
		errors: [],
	}

	const { toAdd, toUpdate, unchanged } = await getDiff(db)

	if (dryRun) {
		return {
			added: toAdd.map((f) => f.label),
			updated: toUpdate.map((f) => f.label),
			unchanged: unchanged.map((f) => f.label),
			errors: [],
		}
	}

	// Add new feeds
	for (const feed of toAdd) {
		try {
			await db.insert(feeds).values({
				id: generateId(),
				title: feed.label,
				feedUrl: feed.url,
				siteUrl: extractSiteUrl(feed.url),
				isOfficial: true,
				type: 'blog',
			})
			result.added.push(feed.label)
		} catch (error) {
			result.errors.push({
				url: feed.url,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	// Update existing feeds with changed labels
	for (const feed of toUpdate) {
		try {
			await db.update(feeds).set({ title: feed.label }).where(eq(feeds.id, feed.id))
			result.updated.push(feed.label)
		} catch (error) {
			result.errors.push({
				url: feed.url,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	result.unchanged = unchanged.map((f) => f.label)

	return result
}

/**
 * Extract site URL from feed URL (best effort)
 */
function extractSiteUrl(feedUrl: string): string {
	try {
		const url = new URL(feedUrl)
		// Remove common feed paths
		const path = url.pathname
			.replace(/\/(feed|rss|atom)(\.xml)?$/i, '')
			.replace(/\/index\.xml$/i, '')
			.replace(/\/feed\/?$/i, '')
		return `${url.origin}${path || '/'}`
	} catch {
		return feedUrl
	}
}

/**
 * Reconcile bookmark counts
 * Recalculates bookmark_count from feed_bookmarks table to fix any drift
 */
export async function reconcileBookmarkCounts(db: Database): Promise<{ updated: number }> {
	console.log('[Reconcile] Starting bookmark count reconciliation')

	// Get actual counts from feed_bookmarks
	const actualCounts = await db
		.select({
			feedId: feedBookmarks.feedId,
			count: count(),
		})
		.from(feedBookmarks)
		.groupBy(feedBookmarks.feedId)

	// Create a map for quick lookup
	const countMap = new Map(actualCounts.map((c) => [c.feedId, c.count]))

	// Get all feeds with their current bookmark counts
	const allFeeds = await db.query.feeds.findMany({
		columns: { id: true, bookmarkCount: true },
	})

	let updated = 0

	// Update feeds where count doesn't match
	for (const feed of allFeeds) {
		const actualCount = countMap.get(feed.id) ?? 0
		if (feed.bookmarkCount !== actualCount) {
			await db.update(feeds).set({ bookmarkCount: actualCount }).where(eq(feeds.id, feed.id))
			updated++
		}
	}

	console.log(`[Reconcile] Updated ${updated} feed bookmark counts`)
	return { updated }
}
