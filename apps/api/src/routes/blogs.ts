import { vValidator } from '@hono/valibot-validator'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { blogs, follows } from '../db/schema'
import { requireAuth } from '../middleware/auth'

type Variables = {
	db: Database
	userId: string
}

export const blogsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get all blogs with pagination
blogsRoute.get(
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
		const result = await db.query.blogs.findMany({
			limit: perPage,
			offset,
			orderBy: [desc(blogs.createdAt)],
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

// Get single blog by ID
blogsRoute.get('/:id', async (c) => {
	const id = c.req.param('id')
	const db = c.get('db')

	const blog = await db.query.blogs.findFirst({
		where: eq(blogs.id, id),
		with: {
			author: true,
			posts: {
				limit: 10,
				orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
			},
		},
	})

	if (!blog) {
		return c.json({ error: 'Blog not found' }, 404)
	}

	return c.json({ data: blog })
})

// Get blog's posts
blogsRoute.get(
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
		const blog = await db.query.blogs.findFirst({
			where: eq(blogs.id, id),
			with: {
				posts: {
					limit: perPage,
					offset,
					orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
				},
			},
		})

		if (!blog) {
			return c.json({ error: 'Blog not found' }, 404)
		}

		return c.json({
			data: blog.posts,
			meta: { page, perPage },
		})
	},
)

// Follow a blog
blogsRoute.post('/:id/follow', requireAuth, async (c) => {
	const blogId = c.req.param('id')
	const db = c.get('db')
	const userId = c.get('userId')

	try {
		await db.insert(follows).values({ userId, blogId }).onConflictDoNothing()
		return c.json({ success: true })
	} catch {
		return c.json({ error: 'Failed to follow' }, 500)
	}
})

// Unfollow a blog
blogsRoute.delete('/:id/follow', requireAuth, async (c) => {
	const blogId = c.req.param('id')
	const db = c.get('db')
	const userId = c.get('userId')

	await db.delete(follows).where(and(eq(follows.userId, userId), eq(follows.blogId, blogId)))
	return c.json({ success: true })
})
