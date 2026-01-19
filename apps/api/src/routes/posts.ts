import { vValidator } from '@hono/valibot-validator'
import { desc, like, or } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { posts } from '../db/schema'

type Variables = {
	db: Database
}

export const postsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get latest posts (timeline)
postsRoute.get(
	'/',
	vValidator(
		'query',
		v.object({
			page: v.optional(v.pipe(v.string(), v.transform(Number)), '1'),
			perPage: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
		}),
	),
	async (c) => {
		const { page, perPage } = c.req.valid('query')
		const db = c.get('db')

		const offset = (page - 1) * perPage
		const result = await db.query.posts.findMany({
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

// Search posts
postsRoute.get(
	'/search',
	vValidator(
		'query',
		v.object({
			q: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
			page: v.optional(v.pipe(v.string(), v.transform(Number)), '1'),
			perPage: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
		}),
	),
	async (c) => {
		const { q, page, perPage } = c.req.valid('query')
		const db = c.get('db')

		const offset = (page - 1) * perPage
		const searchTerm = `%${q}%`

		const result = await db.query.posts.findMany({
			where: or(like(posts.title, searchTerm), like(posts.summary, searchTerm)),
			limit: perPage,
			offset,
			orderBy: [desc(posts.publishedAt)],
			with: {
				blog: true,
			},
		})

		return c.json({
			data: result,
			meta: { page, perPage, query: q },
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
