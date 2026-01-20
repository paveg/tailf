import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import { and, desc, eq, gte, inArray, like, lt, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { feeds, posts } from '../db/schema'
import { buildCursorResponse } from '../utils/pagination'

// Tech filter threshold
// 0.65+ = programming/dev articles, 0.55-0.65 = gadget reviews, <0.55 = non-tech
const TECH_SCORE_THRESHOLD = 0.65

// Extended schema with techOnly and official filters
const postsQuerySchema = v.object({
	...cursorPaginationQuerySchema.entries,
	techOnly: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true'),
		),
	),
	official: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true'),
		),
	),
})

/**
 * Get feed IDs filtered by official status
 */
async function getOfficialFeedIds(db: Database, official: boolean): Promise<string[]> {
	const officialFeeds = await db.query.feeds.findMany({
		where: eq(feeds.isOfficial, official),
		columns: { id: true },
	})
	return officialFeeds.map((f) => f.id)
}

type Variables = {
	db: Database
}

export const postsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get latest posts (timeline) - cursor-based pagination
postsRoute.get('/', vValidator('query', postsQuerySchema), async (c) => {
	const { cursor, limit, techOnly, official } = c.req.valid('query')
	const db = c.get('db')

	const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined
	const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

	// Official filter: get feed IDs first, then filter posts
	let officialCondition: SQL | undefined
	if (official !== undefined) {
		const feedIds = await getOfficialFeedIds(db, official)
		if (feedIds.length > 0) {
			officialCondition = inArray(posts.feedId, feedIds)
		} else {
			// No matching feeds, return empty
			return c.json(buildCursorResponse([], limit))
		}
	}

	const conditions = [cursorCondition, techCondition, officialCondition].filter(Boolean)

	const result = await db.query.posts.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		limit: limit + 1,
		orderBy: [desc(posts.publishedAt)],
		with: { feed: { with: { author: true } } },
	})

	return c.json(buildCursorResponse(result, limit))
})

// Search posts - cursor-based pagination
postsRoute.get(
	'/search',
	vValidator(
		'query',
		v.object({
			q: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
			...postsQuerySchema.entries,
		}),
	),
	async (c) => {
		const { q, cursor, limit, techOnly, official } = c.req.valid('query')
		const db = c.get('db')

		const searchTerm = `%${q}%`
		const searchCondition = or(like(posts.title, searchTerm), like(posts.summary, searchTerm))
		const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined
		const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

		// Official filter
		let officialCondition: SQL | undefined
		if (official !== undefined) {
			const feedIds = await getOfficialFeedIds(db, official)
			if (feedIds.length > 0) {
				officialCondition = inArray(posts.feedId, feedIds)
			} else {
				return c.json({
					...buildCursorResponse([], limit),
					meta: { query: q },
				})
			}
		}

		const conditions = [searchCondition, cursorCondition, techCondition, officialCondition].filter(
			Boolean,
		)

		const result = await db.query.posts.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			limit: limit + 1,
			orderBy: [desc(posts.publishedAt)],
			with: { feed: { with: { author: true } } },
		})

		const response = buildCursorResponse(result, limit)
		return c.json({
			...response,
			meta: { ...response.meta, query: q },
		})
	},
)

// Get popular posts by Hatena Bookmark count
postsRoute.get(
	'/ranking',
	vValidator(
		'query',
		v.object({
			period: v.optional(v.picklist(['week', 'month']), 'week'),
			limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
			techOnly: v.optional(
				v.pipe(
					v.string(),
					v.transform((s) => s === 'true'),
				),
			),
		}),
	),
	async (c) => {
		const { period, limit, techOnly } = c.req.valid('query')
		const db = c.get('db')

		// Calculate date threshold
		const now = new Date()
		const threshold = new Date(
			period === 'week'
				? now.getTime() - 7 * 24 * 60 * 60 * 1000
				: now.getTime() - 30 * 24 * 60 * 60 * 1000,
		)

		const dateCondition = gte(posts.publishedAt, threshold)
		const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

		const result = await db.query.posts.findMany({
			where: techCondition ? and(dateCondition, techCondition) : dateCondition,
			limit,
			// Sort by Hatena bookmark count (descending), then by published date
			orderBy: [desc(posts.hatenaBookmarkCount), desc(posts.publishedAt)],
			with: {
				feed: { with: { author: true } },
			},
		})

		return c.json({
			data: result,
			meta: { period },
		})
	},
)
