import { vValidator } from '@hono/valibot-validator'
import { createBlogSchema } from '@tailf/shared'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { blogs, follows, posts } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { fetchAndParseFeed } from '../services/rss'
import { calculateTechScoreWithEmbedding } from '../services/tech-score'
import { generateId } from '../utils/id'
import { detectFeedType, normalizeUrl } from '../utils/url'

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

// Get current user's registered blogs
blogsRoute.get('/mine', requireAuth, async (c) => {
	const db = c.get('db')
	const userId = c.get('userId')

	const result = await db.query.blogs.findMany({
		where: eq(blogs.authorId, userId),
		orderBy: [desc(blogs.createdAt)],
		with: {
			posts: {
				limit: 1,
				orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
			},
		},
	})

	// Add post count
	const blogsWithCount = await Promise.all(
		result.map(async (blog) => {
			const postCount = await db.query.posts.findMany({
				where: eq(posts.blogId, blog.id),
				columns: { id: true },
			})
			return {
				...blog,
				postCount: postCount.length,
			}
		}),
	)

	return c.json({ data: blogsWithCount })
})

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

// Register a new blog
blogsRoute.post('/', vValidator('json', createBlogSchema), requireAuth, async (c) => {
	const { feedUrl: rawFeedUrl } = c.req.valid('json')
	const db = c.get('db')
	const userId = c.get('userId')

	// URL正規化
	const feedUrl = normalizeUrl(rawFeedUrl)
	console.log(`[Blog Register] Normalized URL: ${rawFeedUrl} -> ${feedUrl}`)

	try {
		// Check if blog already exists
		const existing = await db.query.blogs.findFirst({
			where: eq(blogs.feedUrl, feedUrl),
		})

		if (existing) {
			return c.json({ error: 'Blog already registered', code: 'BLOG_EXISTS' }, 409)
		}

		// Fetch and parse RSS feed
		console.log(`[Blog Register] Fetching RSS: ${feedUrl}`)
		const feed = await fetchAndParseFeed(feedUrl)
		if (!feed) {
			return c.json({ error: 'Failed to fetch or parse RSS feed', code: 'INVALID_FEED' }, 400)
		}
		console.log(`[Blog Register] Parsed feed: ${feed.title}, ${feed.items.length} items`)

		// Create blog with auto-detected type
		const feedType = detectFeedType(feedUrl)
		const blogId = generateId()
		await db.insert(blogs).values({
			id: blogId,
			title: feed.title,
			description: feed.description,
			feedUrl,
			siteUrl: feed.link || feedUrl,
			type: feedType,
			authorId: userId,
		})
		console.log(`[Blog Register] Feed created: ${blogId} (type: ${feedType})`)

		// Insert posts from feed with embedding-based tech score
		const filteredItems = feed.items.filter((item) => item.title && item.link)
		let importedCount = 0

		for (const item of filteredItems) {
			try {
				const summary = item.description?.slice(0, 500)
				// Use embedding-based tech score (falls back to keyword if AI unavailable)
				const techScore = await calculateTechScoreWithEmbedding(c.env.AI, item.title, summary)

				await db
					.insert(posts)
					.values({
						id: generateId(),
						title: item.title,
						summary,
						url: item.link,
						thumbnailUrl: item.thumbnail,
						publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
						blogId,
						techScore,
					})
					.onConflictDoNothing()
				importedCount++
			} catch (e) {
				console.warn(`[Blog Register] Skip post: ${item.link}`, e)
			}
		}

		if (importedCount > 0) {
			console.log(`[Blog Register] Imported ${importedCount} posts with embedding scores`)
		}

		// Return created blog with posts count
		const blog = await db.query.blogs.findFirst({
			where: eq(blogs.id, blogId),
			with: { author: true },
		})

		return c.json({
			data: blog,
			meta: { postsImported: importedCount },
		})
	} catch (error) {
		console.error('[Blog Register] Error:', error)
		return c.json({ error: 'Failed to register blog', details: String(error) }, 500)
	}
})

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

// Delete a blog (only owner can delete)
blogsRoute.delete('/:id', requireAuth, async (c) => {
	const blogId = c.req.param('id')
	const db = c.get('db')
	const userId = c.get('userId')

	try {
		// Check if blog exists and user is owner
		const blog = await db.query.blogs.findFirst({
			where: eq(blogs.id, blogId),
		})

		if (!blog) {
			return c.json({ error: 'Blog not found' }, 404)
		}

		if (blog.authorId !== userId) {
			return c.json({ error: 'You can only delete your own blogs' }, 403)
		}

		console.log(`[Blog Delete] Deleting blog: ${blogId}`)

		// Use batch for atomic delete (D1 doesn't support Drizzle transactions)
		await db.batch([
			db.delete(posts).where(eq(posts.blogId, blogId)),
			db.delete(follows).where(eq(follows.blogId, blogId)),
			db.delete(blogs).where(eq(blogs.id, blogId)),
		])

		console.log(`[Blog Delete] Blog deleted: ${blogId}`)
		return c.json({ success: true })
	} catch (error) {
		console.error('[Blog Delete] Error:', error)
		return c.json({ error: 'Failed to delete blog', details: String(error) }, 500)
	}
})
