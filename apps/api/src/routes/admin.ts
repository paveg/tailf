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
