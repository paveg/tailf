import { vValidator } from '@hono/valibot-validator'
import { desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { follows, posts, sessions } from '../db/schema'

type Variables = {
	db: Database
}

export const feedRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get personalized feed (posts from followed blogs)
feedRoute.get(
	'/',
	vValidator(
		'query',
		v.object({
			page: v.optional(v.pipe(v.string(), v.transform(Number)), '1'),
			perPage: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
		}),
	),
	async (c) => {
		const sessionId = getCookie(c, 'session')
		if (!sessionId) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		const db = c.get('db')

		// Verify session
		const session = await db.query.sessions.findFirst({
			where: eq(sessions.id, sessionId),
		})

		if (!session || session.expiresAt < new Date()) {
			return c.json({ error: 'Session expired' }, 401)
		}

		const { page, perPage } = c.req.valid('query')
		const offset = (page - 1) * perPage

		// Get followed blog IDs
		const userFollows = await db.query.follows.findMany({
			where: eq(follows.userId, session.userId),
		})

		const blogIds = userFollows.map((f) => f.blogId)

		if (blogIds.length === 0) {
			return c.json({
				data: [],
				meta: { page, perPage },
			})
		}

		// Get posts from followed blogs
		const result = await db.query.posts.findMany({
			where: inArray(posts.blogId, blogIds),
			limit: perPage,
			offset,
			orderBy: [desc(posts.publishedAt)],
			with: {
				blog: true,
			},
		})

		return c.json({
			data: result,
			meta: { page, perPage },
		})
	},
)

// Get user's followed blogs
feedRoute.get('/following', async (c) => {
	const sessionId = getCookie(c, 'session')
	if (!sessionId) {
		return c.json({ error: 'Unauthorized' }, 401)
	}

	const db = c.get('db')

	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, sessionId),
	})

	if (!session || session.expiresAt < new Date()) {
		return c.json({ error: 'Session expired' }, 401)
	}

	const userFollows = await db.query.follows.findMany({
		where: eq(follows.userId, session.userId),
		with: {
			blog: true,
		},
	})

	return c.json({
		data: userFollows.map((f) => f.blog),
	})
})
