import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import { and, desc, like, lt, or } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { posts } from '../db/schema'
import { buildCursorResponse } from '../utils/pagination'

type Variables = {
	db: Database
}

export const postsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get latest posts (timeline) - cursor-based pagination
postsRoute.get('/', vValidator('query', cursorPaginationQuerySchema), async (c) => {
	const { cursor, limit } = c.req.valid('query')
	const db = c.get('db')

	const result = await db.query.posts.findMany({
		where: cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined,
		limit: limit + 1,
		orderBy: [desc(posts.publishedAt)],
		with: { blog: true },
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
			...cursorPaginationQuerySchema.entries,
		}),
	),
	async (c) => {
		const { q, cursor, limit } = c.req.valid('query')
		const db = c.get('db')

		const searchTerm = `%${q}%`
		const searchCondition = or(like(posts.title, searchTerm), like(posts.summary, searchTerm))
		const cursorCondition = cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined

		const result = await db.query.posts.findMany({
			where: cursorCondition ? and(searchCondition, cursorCondition) : searchCondition,
			limit: limit + 1,
			orderBy: [desc(posts.publishedAt)],
			with: { blog: true },
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
		}),
	),
	async (c) => {
		const { period, limit } = c.req.valid('query')
		const db = c.get('db')

		// Calculate date threshold
		const now = new Date()
		const threshold = new Date(
			period === 'week'
				? now.getTime() - 7 * 24 * 60 * 60 * 1000
				: now.getTime() - 30 * 24 * 60 * 60 * 1000,
		)

		const result = await db.query.posts.findMany({
			where: (posts, { gte }) => gte(posts.publishedAt, threshold),
			limit,
			orderBy: [desc(posts.publishedAt)],
			with: {
				blog: true,
			},
		})

		return c.json({
			data: result,
			meta: { period },
		})
	},
)
