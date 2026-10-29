import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { Env } from '..'
import { createDb, type Database } from '../db'
import { adminRoute } from './admin'

type Statement = { sql: string; params: unknown[] }

function createFakeD1() {
	const statements: Statement[] = []
	const d1 = {
		prepare(sql: string) {
			const statement: Statement = { sql, params: [] }
			statements.push(statement)
			const stmt = {
				bind: (...bound: unknown[]) => {
					statement.params = bound
					return stmt
				},
				all: async () => ({ results: [] }),
				first: async () => null,
				run: async () => ({ success: true }),
				raw: async () => [],
			}
			return stmt
		},
	}
	return { d1: d1 as unknown as D1Database, statements }
}

describe('POST /admin/posts/resync-thumbnails', () => {
	it('A1: only considers posts of feeds that use images', async () => {
		const { d1, statements } = createFakeD1()
		const app = new Hono<{ Bindings: Env; Variables: { db: Database } }>()
		app.use('*', async (c, next) => {
			c.set('db', createDb(d1))
			await next()
		})
		app.route('/admin', adminRoute)

		const res = await app.request(
			'/admin/posts/resync-thumbnails',
			{ method: 'POST', headers: { Authorization: 'Bearer secret' } },
			{ ADMIN_SECRET: 'secret' } as Env,
		)

		expect(res.status).toBe(200)
		const candidateQuery = statements.find(({ sql }) => /from "posts"/i.test(sql))
		expect(candidateQuery?.sql).toMatch(/"thumbnail_url" is null/i)
		expect(candidateQuery?.sql).toMatch(
			/"feed_id" in \(select "id" from "feeds" where "feeds"\."use_images" = \?\)/i,
		)
		expect(candidateQuery?.params).toEqual([1])
	})
})
