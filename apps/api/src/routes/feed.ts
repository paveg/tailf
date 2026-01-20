import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Env } from '..'
import type { Database } from '../db'
import { follows, posts } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { buildCursorResponse } from '../utils/pagination'

type Variables = {
	db: Database
	userId: string
}

export const feedRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get personalized feed (posts from followed blogs) - cursor-based pagination
feedRoute.get('/', vValidator('query', cursorPaginationQuerySchema), requireAuth, async (c) => {
	const { cursor, limit } = c.req.valid('query')
	const db = c.get('db')
	const userId = c.get('userId')

	// Get followed blog IDs
	const userFollows = await db.query.follows.findMany({
		where: eq(follows.userId, userId),
	})

	const blogIds = userFollows.map((f) => f.blogId)

	if (blogIds.length === 0) {
		return c.json({
			data: [],
			meta: { nextCursor: null, hasMore: false },
		})
	}

	// Get posts from followed blogs
	const blogCondition = inArray(posts.blogId, blogIds)
	const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined

	const result = await db.query.posts.findMany({
		where: cursorCondition ? and(blogCondition, cursorCondition) : blogCondition,
		limit: limit + 1,
		orderBy: [desc(posts.publishedAt)],
		with: { blog: true },
	})

	return c.json(buildCursorResponse(result, limit))
})

// Get user's followed blogs
feedRoute.get('/following', requireAuth, async (c) => {
	const db = c.get('db')
	const userId = c.get('userId')

	const userFollows = await db.query.follows.findMany({
		where: eq(follows.userId, userId),
		with: {
			blog: true,
		},
	})

	return c.json({
		data: userFollows.map((f) => f.blog),
	})
})
