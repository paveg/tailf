import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import { and, desc, gte, like, lt, or } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { posts } from '../db/schema'
import { buildCursorResponse } from '../utils/pagination'

// Tech filter threshold
// 0.65+ = programming/dev articles, 0.55-0.65 = gadget reviews, <0.55 = non-tech
const TECH_SCORE_THRESHOLD = 0.65

// Extended schema with techOnly filter
const postsQuerySchema = v.object({
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
}

export const postsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get latest posts (timeline) - cursor-based pagination
postsRoute.get('/', vValidator('query', postsQuerySchema), async (c) => {
	const { cursor, limit, techOnly } = c.req.valid('query')
	const db = c.get('db')

	const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined
	const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

	const result = await db.query.posts.findMany({
		where: cursorCondition || techCondition ? and(cursorCondition, techCondition) : undefined,
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
		const { q, cursor, limit, techOnly } = c.req.valid('query')
		const db = c.get('db')

		const searchTerm = `%${q}%`
		const searchCondition = or(like(posts.title, searchTerm), like(posts.summary, searchTerm))
		const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined
		const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

		const conditions = [searchCondition, cursorCondition, techCondition].filter(Boolean)

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

// Get popular posts (by recent publish date for now, can add view count later)
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
			orderBy: [desc(posts.publishedAt)],
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
