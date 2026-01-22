/**
 * Admin routes (protected by ADMIN_SECRET)
 */
import { eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Env } from '..'
import type { Database } from '../db'
import { posts } from '../db/schema'
import { getDiff, syncOfficialFeeds } from '../services/feed-sync'
import { getBookmarkCount } from '../services/hatena'
import { decodeHtmlEntities, parseFeed } from '../services/rss'

type Variables = {
	db: Database
}

export const adminRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Simple auth middleware for admin routes
adminRoute.use('*', async (c, next) => {
	const adminSecret = c.env.ADMIN_SECRET
	if (!adminSecret) {
		return c.json({ error: 'Admin routes not configured' }, 503)
	}

	const authHeader = c.req.header('Authorization')
	if (authHeader !== `Bearer ${adminSecret}`) {
		return c.json({ error: 'Unauthorized' }, 401)
	}

	await next()
})

// GET /admin/feeds/diff - Check what would be synced
adminRoute.get('/feeds/diff', async (c) => {
	const db = c.get('db')
	const { toAdd } = await getDiff(db)

	return c.json({
		data: {
			toAdd: toAdd.map((f) => ({ label: f.label, url: f.url })),
			count: toAdd.length,
		},
	})
})

// POST /admin/feeds/sync - Sync official feeds to DB
adminRoute.post('/feeds/sync', async (c) => {
	const db = c.get('db')
	const result = await syncOfficialFeeds(db)

	return c.json({
		data: result,
		message: `Added ${result.added.length} feeds, ${result.errors.length} errors`,
	})
})

// POST /admin/bookmarks/update - Update Hatena Bookmark counts for posts
adminRoute.post('/bookmarks/update', async (c) => {
	const db = c.get('db')

	// Get posts without bookmark counts (NULL)
	const postsToUpdate = await db.query.posts.findMany({
		where: isNull(posts.hatenaBookmarkCount),
		columns: { id: true, url: true },
		limit: 50, // Process in batches to avoid timeout
	})

	if (postsToUpdate.length === 0) {
		return c.json({ message: 'No posts to update', updated: 0 })
	}

	let updated = 0
	const errors: string[] = []

	for (const post of postsToUpdate) {
		try {
			const count = await getBookmarkCount(post.url)
			await db.update(posts).set({ hatenaBookmarkCount: count }).where(eq(posts.id, post.id))
			updated++
			// Rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100))
		} catch (error) {
			errors.push(`${post.id}: ${error}`)
		}
	}

	return c.json({
		message: `Updated ${updated} posts`,
		updated,
		remaining: postsToUpdate.length - updated,
		errors: errors.length > 0 ? errors : undefined,
	})
})

// POST /admin/posts/fix-entities - Fix HTML entities in post titles and summaries
adminRoute.post('/posts/fix-entities', async (c) => {
	const db = c.get('db')

	// Get all posts
	const allPosts = await db.query.posts.findMany({
		columns: { id: true, title: true, summary: true },
	})

	let updated = 0
	const fixed: string[] = []

	// Check for posts with HTML entities
	const entityPattern = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/

	for (const post of allPosts) {
		const titleHasEntities = entityPattern.test(post.title)
		const summaryHasEntities = post.summary && entityPattern.test(post.summary)

		if (titleHasEntities || summaryHasEntities) {
			const newTitle = decodeHtmlEntities(post.title)
			const newSummary = post.summary ? decodeHtmlEntities(post.summary) : null

			await db
				.update(posts)
				.set({
					title: newTitle,
					summary: newSummary,
				})
				.where(eq(posts.id, post.id))

			updated++
			fixed.push(`${post.title} → ${newTitle}`)
		}
	}

	return c.json({
		message: `Fixed HTML entities in ${updated} posts`,
		updated,
		total: allPosts.length,
		fixed: fixed.length > 0 ? fixed.slice(0, 20) : undefined, // Show first 20 for reference
	})
})

// POST /admin/posts/resync-thumbnails - Resync thumbnails for posts missing them
adminRoute.post('/posts/resync-thumbnails', async (c) => {
	const db = c.get('db')

	// Get posts without thumbnails, grouped by feed
	const postsWithoutThumbnails = await db.query.posts.findMany({
		where: isNull(posts.thumbnailUrl),
		columns: { id: true, url: true, feedId: true },
	})

	if (postsWithoutThumbnails.length === 0) {
		return c.json({ message: 'No posts without thumbnails', updated: 0 })
	}

	// Group posts by feedId
	const postsByFeed = new Map<string, Array<{ id: string; url: string }>>()
	for (const post of postsWithoutThumbnails) {
		const existing = postsByFeed.get(post.feedId) || []
		existing.push({ id: post.id, url: post.url })
		postsByFeed.set(post.feedId, existing)
	}

	// Get feed URLs
	const feedIds = Array.from(postsByFeed.keys())
	const feedRecords = await db.query.feeds.findMany({
		where: (f, { inArray }) => inArray(f.id, feedIds),
		columns: { id: true, feedUrl: true },
	})

	const feedUrlMap = new Map(feedRecords.map((f) => [f.id, f.feedUrl]))

	let updated = 0
	const errors: string[] = []

	// Process each feed
	for (const [feedId, feedPosts] of postsByFeed) {
		const feedUrl = feedUrlMap.get(feedId)
		if (!feedUrl) continue

		try {
			const response = await fetch(feedUrl, {
				headers: { 'User-Agent': 'tailf RSS Aggregator' },
			})
			if (!response.ok) continue

			const xml = await response.text()
			const parsedFeed = parseFeed(xml)
			if (!parsedFeed) continue

			// Create a map of URL to thumbnail
			const thumbnailMap = new Map<string, string>()
			for (const item of parsedFeed.items) {
				if (item.thumbnail) {
					thumbnailMap.set(item.link, item.thumbnail)
				}
			}

			// Update posts with matching thumbnails
			for (const post of feedPosts) {
				const thumbnail = thumbnailMap.get(post.url)
				if (thumbnail) {
					await db.update(posts).set({ thumbnailUrl: thumbnail }).where(eq(posts.id, post.id))
					updated++
				}
			}
		} catch (error) {
			errors.push(`Feed ${feedId}: ${error}`)
		}
	}

	return c.json({
		message: `Updated ${updated} posts with thumbnails`,
		updated,
		totalWithoutThumbnails: postsWithoutThumbnails.length,
		feedsProcessed: postsByFeed.size,
		errors: errors.length > 0 ? errors : undefined,
	})
})
