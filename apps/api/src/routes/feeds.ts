import { vValidator } from '@hono/valibot-validator'
import { createFeedSchema, updateFeedSchema } from '@tailf/shared'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { feedBookmarks, feeds, posts } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { fetchAndParseFeed } from '../services/rss'
import { calculateTechScoreWithEmbedding } from '../services/tech-score'
import { generateId } from '../utils/id'
import { detectFeedType, normalizeUrl } from '../utils/url'

type Variables = {
	db: Database
	userId: string
}

export const feedsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get all feeds with pagination
feedsRoute.get(
	'/',
	vValidator(
		'query',
		v.object({
			page: v.optional(v.pipe(v.string(), v.transform(Number)), '1'),
			perPage: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
			official: v.optional(
				v.pipe(
					v.string(),
					v.transform((s) => s === 'true'),
				),
			),
		}),
	),
	async (c) => {
		const { page, perPage, official } = c.req.valid('query')
		const db = c.get('db')

		const offset = (page - 1) * perPage
		const officialCondition = official !== undefined ? eq(feeds.isOfficial, official) : undefined

		const result = await db.query.feeds.findMany({
			where: officialCondition,
			limit: perPage,
			offset,
			orderBy: [asc(feeds.isOfficial), desc(feeds.createdAt)],
			with: {
				author: true,
			},
		})

		return c.json({
			data: result,
			meta: { page, perPage },
		})
	},
)

// Get current user's registered feeds
feedsRoute.get('/mine', requireAuth, async (c) => {
	const db = c.get('db')
	const userId = c.get('userId')

	const result = await db.query.feeds.findMany({
		where: eq(feeds.authorId, userId),
		orderBy: [desc(feeds.createdAt)],
		with: {
			posts: {
				limit: 1,
				orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
			},
		},
	})

	// Add post count (bookmarkCount is already in the feeds table)
	const feedsWithCount = await Promise.all(
		result.map(async (feed) => {
			const postList = await db.query.posts.findMany({
				where: eq(posts.feedId, feed.id),
				columns: { id: true },
			})
			return {
				...feed,
				postCount: postList.length,
			}
		}),
	)

	return c.json({ data: feedsWithCount })
})

// Get single feed by ID
feedsRoute.get('/:id', async (c) => {
	const id = c.req.param('id')
	const db = c.get('db')

	const feed = await db.query.feeds.findFirst({
		where: eq(feeds.id, id),
		with: {
			author: true,
			posts: {
				limit: 10,
				orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
			},
		},
	})

	if (!feed) {
		return c.json({ error: 'Feed not found' }, 404)
	}

	return c.json({ data: feed })
})

// Get feed's posts
feedsRoute.get(
	'/:id/posts',
	vValidator(
		'query',
		v.object({
			page: v.optional(v.pipe(v.string(), v.transform(Number)), '1'),
			perPage: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
		}),
	),
	async (c) => {
		const id = c.req.param('id')
		const { page, perPage } = c.req.valid('query')
		const db = c.get('db')

		const offset = (page - 1) * perPage
		const feed = await db.query.feeds.findFirst({
			where: eq(feeds.id, id),
			with: {
				posts: {
					limit: perPage,
					offset,
					orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
				},
			},
		})

		if (!feed) {
			return c.json({ error: 'Feed not found' }, 404)
		}

		return c.json({
			data: feed.posts,
			meta: { page, perPage },
		})
	},
)

// Register a new feed
feedsRoute.post('/', vValidator('json', createFeedSchema), requireAuth, async (c) => {
	const { feedUrl: rawFeedUrl } = c.req.valid('json')
	const db = c.get('db')
	const userId = c.get('userId')

	// URL正規化
	const feedUrl = normalizeUrl(rawFeedUrl)
	console.log(`[Feed Register] Normalized URL: ${rawFeedUrl} -> ${feedUrl}`)

	try {
		// Check if feed already exists
		const existing = await db.query.feeds.findFirst({
			where: eq(feeds.feedUrl, feedUrl),
		})

		if (existing) {
			return c.json({ error: 'Feed already registered', code: 'FEED_EXISTS' }, 409)
		}

		// Fetch and parse RSS feed
		console.log(`[Feed Register] Fetching RSS: ${feedUrl}`)
		const parsedFeed = await fetchAndParseFeed(feedUrl)
		if (!parsedFeed) {
			return c.json({ error: 'Failed to fetch or parse RSS feed', code: 'INVALID_FEED' }, 400)
		}
		console.log(
			`[Feed Register] Parsed feed: ${parsedFeed.title}, ${parsedFeed.items.length} items`,
		)

		// Create feed with auto-detected type
		const feedType = detectFeedType(feedUrl)
		const feedId = generateId()
		await db.insert(feeds).values({
			id: feedId,
			title: parsedFeed.title,
			description: parsedFeed.description,
			feedUrl,
			siteUrl: parsedFeed.link || feedUrl,
			type: feedType,
			authorId: userId,
		})
		console.log(`[Feed Register] Feed created: ${feedId} (type: ${feedType})`)

		// Insert posts from feed with embedding-based tech score
		const filteredItems = parsedFeed.items.filter((item) => item.title && item.link)
		let importedCount = 0

		for (const item of filteredItems) {
			try {
				const summary = item.description?.slice(0, 500)
				// Use embedding-based tech score (falls back to keyword if AI unavailable)
				const techScore = await calculateTechScoreWithEmbedding(c.env.AI, item.title, summary)

				await db
					.insert(posts)
					.values({
						id: generateId(),
						title: item.title,
						summary,
						url: item.link,
						thumbnailUrl: item.thumbnail,
						publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
						feedId,
						techScore,
					})
					.onConflictDoNothing()
				importedCount++
			} catch (e) {
				console.warn(`[Feed Register] Skip post: ${item.link}`, e)
			}
		}

		if (importedCount > 0) {
			console.log(`[Feed Register] Imported ${importedCount} posts with embedding scores`)
		}

		// Return created feed with posts count
		const createdFeed = await db.query.feeds.findFirst({
			where: eq(feeds.id, feedId),
			with: { author: true },
		})

		return c.json({
			data: createdFeed,
			meta: { postsImported: importedCount },
		})
	} catch (error) {
		console.error('[Feed Register] Error:', error)
		return c.json({ error: 'Failed to register feed', details: String(error) }, 500)
	}
})

// Update a feed (only owner can update)
feedsRoute.patch('/:id', vValidator('json', updateFeedSchema), requireAuth, async (c) => {
	const feedId = c.req.param('id')
	const updates = c.req.valid('json')
	const db = c.get('db')
	const userId = c.get('userId')

	try {
		// Check if feed exists and user is owner
		const feed = await db.query.feeds.findFirst({
			where: eq(feeds.id, feedId),
		})

		if (!feed) {
			return c.json({ error: 'Feed not found' }, 404)
		}

		if (feed.authorId !== userId) {
			return c.json({ error: 'You can only update your own feeds' }, 403)
		}

		// Build update object with only provided fields
		const updateData: Partial<typeof feeds.$inferInsert> = {
			updatedAt: new Date(),
		}
		if (updates.title !== undefined) updateData.title = updates.title
		if (updates.description !== undefined) updateData.description = updates.description
		if (updates.type !== undefined) updateData.type = updates.type

		await db.update(feeds).set(updateData).where(eq(feeds.id, feedId))

		// Return updated feed
		const updatedFeed = await db.query.feeds.findFirst({
			where: eq(feeds.id, feedId),
			with: { author: true },
		})

		console.log(`[Feed Update] Feed updated: ${feedId}`)
		return c.json({ data: updatedFeed })
	} catch (error) {
		console.error('[Feed Update] Error:', error)
		return c.json({ error: 'Failed to update feed', details: String(error) }, 500)
	}
})

// Bookmark a feed
feedsRoute.post('/:id/bookmark', requireAuth, async (c) => {
	const feedId = c.req.param('id')
	const db = c.get('db')
	const userId = c.get('userId')

	try {
		// Check if already bookmarked
		const existing = await db.query.feedBookmarks.findFirst({
			where: and(eq(feedBookmarks.userId, userId), eq(feedBookmarks.feedId, feedId)),
		})

		if (existing) {
			return c.json({ success: true })
		}

		// Insert bookmark and increment count
		await db.batch([
			db.insert(feedBookmarks).values({ userId, feedId }),
			db
				.update(feeds)
				.set({ bookmarkCount: sql`${feeds.bookmarkCount} + 1` })
				.where(eq(feeds.id, feedId)),
		])
		return c.json({ success: true })
	} catch {
		return c.json({ error: 'Failed to bookmark' }, 500)
	}
})

// Remove bookmark from a feed
feedsRoute.delete('/:id/bookmark', requireAuth, async (c) => {
	const feedId = c.req.param('id')
	const db = c.get('db')
	const userId = c.get('userId')

	// Check if bookmark exists
	const existing = await db.query.feedBookmarks.findFirst({
		where: and(eq(feedBookmarks.userId, userId), eq(feedBookmarks.feedId, feedId)),
	})

	if (!existing) {
		return c.json({ success: true })
	}

	// Delete bookmark and decrement count
	await db.batch([
		db
			.delete(feedBookmarks)
			.where(and(eq(feedBookmarks.userId, userId), eq(feedBookmarks.feedId, feedId))),
		db
			.update(feeds)
			.set({ bookmarkCount: sql`MAX(${feeds.bookmarkCount} - 1, 0)` })
			.where(eq(feeds.id, feedId)),
	])
	return c.json({ success: true })
})

// Delete a feed (only owner can delete)
feedsRoute.delete('/:id', requireAuth, async (c) => {
	const feedId = c.req.param('id')
	const db = c.get('db')
	const userId = c.get('userId')

	try {
		// Check if feed exists and user is owner
		const feed = await db.query.feeds.findFirst({
			where: eq(feeds.id, feedId),
		})

		if (!feed) {
			return c.json({ error: 'Feed not found' }, 404)
		}

		if (feed.authorId !== userId) {
			return c.json({ error: 'You can only delete your own feeds' }, 403)
		}

		console.log(`[Feed Delete] Deleting feed: ${feedId}`)

		// Use batch for atomic delete (D1 doesn't support Drizzle transactions)
		await db.batch([
			db.delete(posts).where(eq(posts.feedId, feedId)),
			db.delete(feedBookmarks).where(eq(feedBookmarks.feedId, feedId)),
			db.delete(feeds).where(eq(feeds.id, feedId)),
		])

		console.log(`[Feed Delete] Feed deleted: ${feedId}`)
		return c.json({ success: true })
	} catch (error) {
		console.error('[Feed Delete] Error:', error)
		return c.json({ error: 'Failed to delete feed', details: String(error) }, 500)
	}
})
