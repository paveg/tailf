import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '..'
import { createDb, type Database } from '../db'
import { EMBEDDING_DIM } from '../services/embedding'
import { userFeedRoute } from './feed'
import { feedsRoute } from './feeds'
import { postsRoute } from './posts'

vi.mock('../middleware/auth', () => ({
	requireAuth: async (
		c: { set: (key: string, value: string) => void },
		next: () => Promise<void>,
	) => {
		c.set('userId', 'user-1')
		await next()
	},
}))

/**
 * Public post endpoints must never select the posts.embedding BLOB: it is
 * 4096 bytes per row and serializes to a 4096-number JSON array, which made
 * list responses ~12x larger than necessary.
 *
 * The fake D1 records every SQL string drizzle prepares and answers with
 * canned rows keyed by table, so the handlers run end to end.
 */

type RawRows = unknown[][]

function createFakeD1(respond: (sql: string) => RawRows = () => []) {
	const statements: string[] = []
	const d1 = {
		prepare(sql: string) {
			statements.push(sql)
			const stmt = {
				bind: () => stmt,
				all: async () => ({ results: [] }),
				first: async () => null,
				run: async () => ({ success: true }),
				raw: async () => respond(sql),
			}
			return stmt
		},
	}
	return { d1: d1 as unknown as D1Database, statements }
}

type Variables = { db: Database }

function makeApp(d1: D1Database) {
	const db = createDb(d1)
	const app = new Hono<{ Bindings: Env; Variables: Variables }>()
	app.use('*', async (c, next) => {
		c.set('db', db)
		await next()
	})
	app.route('/api/posts', postsRoute)
	app.route('/api/feed', userFeedRoute)
	app.route('/api/feeds', feedsRoute)
	return app
}

function expectNoEmbeddingColumn(statements: string[]) {
	expect(statements.length).toBeGreaterThan(0)
	for (const sql of statements) {
		expect(sql).not.toMatch(/embedding/i)
	}
}

describe('public post endpoints do not select the embedding column', () => {
	let statements: string[]
	let app: ReturnType<typeof makeApp>

	beforeEach(() => {
		const fake = createFakeD1()
		statements = fake.statements
		app = makeApp(fake.d1)
	})

	it('GET /api/posts', async () => {
		const res = await app.request('/api/posts?limit=12&techOnly=true')

		expect(res.status).toBe(200)
		expectNoEmbeddingColumn(statements)
	})

	it('GET /api/posts/ranking', async () => {
		const res = await app.request('/api/posts/ranking')

		expect(res.status).toBe(200)
		expectNoEmbeddingColumn(statements)
	})

	it('GET /api/posts/search keyword fallback', async () => {
		const res = await app.request('/api/posts/search?q=ab', {}, {} as Env)

		expect(res.status).toBe(200)
		expectNoEmbeddingColumn(statements)
	})

	it('GET /api/feed (personalized timeline)', async () => {
		const fake = createFakeD1((sql) =>
			sql.includes('"feed_bookmarks"') ? [['user-1', 'feed-1', 0]] : [],
		)
		const res = await makeApp(fake.d1).request('/api/feed')

		expect(res.status).toBe(200)
		expect(fake.statements.some((sql) => sql.includes('"posts"'))).toBe(true)
		expectNoEmbeddingColumn(fake.statements)
	})

	it('GET /api/feeds/mine', async () => {
		const res = await app.request('/api/feeds/mine')

		expect(res.status).toBe(200)
		expectNoEmbeddingColumn(statements)
	})

	it('GET /api/feeds/:id', async () => {
		await app.request('/api/feeds/feed-1')

		expectNoEmbeddingColumn(statements)
	})

	it('GET /api/feeds/:id/posts', async () => {
		await app.request('/api/feeds/feed-1/posts')

		expectNoEmbeddingColumn(statements)
	})
})

describe('semantic search', () => {
	it('selects embeddings only for candidate scoring, not for the response rows', async () => {
		const fake = createFakeD1((sql) =>
			sql.startsWith('select "id", "embedding" from "posts"')
				? [['post-1', new Uint8Array(EMBEDDING_DIM * 4)]]
				: [],
		)
		const ai = { run: async () => ({ data: [new Array(EMBEDDING_DIM).fill(1)] }) }

		const res = await makeApp(fake.d1).request('/api/posts/search?q=hono', {}, {
			AI: ai,
		} as unknown as Env)

		expect(res.status).toBe(200)
		const candidateIndex = fake.statements.findIndex((sql) =>
			sql.startsWith('select "id", "embedding" from "posts"'),
		)
		expect(candidateIndex).toBe(0)
		const detailStatements = fake.statements.slice(candidateIndex + 1)
		expect(detailStatements.length).toBeGreaterThan(0)
		expectNoEmbeddingColumn(detailStatements)
	})
})
