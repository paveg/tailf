/**
 * Admin routes (protected by ADMIN_SECRET)
 */
import { Hono } from 'hono'
import type { Env } from '..'
import type { Database } from '../db'
import { getDiff, syncOfficialFeeds } from '../services/feed-sync'

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
