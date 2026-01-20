import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { follows, posts } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { buildCursorResponse } from '../utils/pagination'

// Tech filter threshold
// 0.65+ = programming/dev articles, 0.55-0.65 = gadget reviews, <0.55 = non-tech
const TECH_SCORE_THRESHOLD = 0.65

// Extended schema with techOnly filter
const feedQuerySchema = v.object({
	...cursorPaginationQuerySchema.entries,
	techOnly: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true'),
		),
	),
})

type Variables = {
	db: Database
	userId: string
}

// User's personalized feed (posts from followed feeds)
export const userFeedRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get personalized feed (posts from followed feeds) - cursor-based pagination
userFeedRoute.get('/', vValidator('query', feedQuerySchema), requireAuth, async (c) => {
	const { cursor, limit, techOnly } = c.req.valid('query')
	const db = c.get('db')
	const userId = c.get('userId')

	// Get followed feed IDs
	const userFollows = await db.query.follows.findMany({
		where: eq(follows.userId, userId),
	})

	const feedIds = userFollows.map((f) => f.feedId)

	if (feedIds.length === 0) {
		return c.json({
			data: [],
			meta: { nextCursor: null, hasMore: false },
		})
	}

	// Get posts from followed feeds
	const feedCondition = inArray(posts.feedId, feedIds)
	const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined
	const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

	const conditions = [feedCondition, cursorCondition, techCondition].filter(Boolean)

	const result = await db.query.posts.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		limit: limit + 1,
		orderBy: [desc(posts.publishedAt)],
		with: { feed: true },
	})

	return c.json(buildCursorResponse(result, limit))
})

// Get user's followed feeds
userFeedRoute.get('/following', requireAuth, async (c) => {
	const db = c.get('db')
	const userId = c.get('userId')

	const userFollows = await db.query.follows.findMany({
		where: eq(follows.userId, userId),
		with: {
			feed: true,
		},
	})

	return c.json({
		data: userFollows.map((f) => f.feed),
	})
})
