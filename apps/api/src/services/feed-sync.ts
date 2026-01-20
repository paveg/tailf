/**
 * Feed sync service
 * Syncs official feeds from static list to database
 */
import { OFFICIAL_FEEDS } from '../data/official-feeds'
import type { Database } from '../db'
import { feeds } from '../db/schema'
import { generateId } from '../utils/id'

export interface SyncResult {
	added: string[]
	existing: string[]
	errors: { url: string; error: string }[]
}

/**
 * Get feeds that exist in code but not in DB
 */
export async function getDiff(db: Database): Promise<{ toAdd: typeof OFFICIAL_FEEDS }> {
	const existingFeeds = await db.query.feeds.findMany({
		columns: { feedUrl: true },
	})

	const existingUrls = new Set(existingFeeds.map((f) => f.feedUrl))

	const toAdd = OFFICIAL_FEEDS.filter((feed) => !existingUrls.has(feed.url))

	return { toAdd }
}

/**
 * Sync official feeds to database
 * Only adds new feeds, doesn't update or delete existing ones
 */
export async function syncOfficialFeeds(db: Database, dryRun = false): Promise<SyncResult> {
	const result: SyncResult = {
		added: [],
		existing: [],
		errors: [],
	}

	const { toAdd } = await getDiff(db)

	if (dryRun) {
		return {
			added: toAdd.map((f) => f.label),
			existing: OFFICIAL_FEEDS.filter((f) => !toAdd.includes(f)).map((f) => f.label),
			errors: [],
		}
	}

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

	result.existing = OFFICIAL_FEEDS.filter((f) => !toAdd.includes(f)).map((f) => f.label)

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
