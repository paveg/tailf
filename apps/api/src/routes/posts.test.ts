import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

/**
 * Test for posts route logic
 *
 * Since the actual routes depend on D1 database, these tests focus on
 * the query validation and business logic patterns.
 */

describe('Posts Route Query Validation', () => {
	// Test query schema validation
	const postsQuerySchema = v.object({
		cursor: v.optional(v.string()),
		limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
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
		sort: v.optional(v.picklist(['recent', 'popular']), 'recent'),
	})

	it('validates default query params', () => {
		const result = v.safeParse(postsQuerySchema, {})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.limit).toBe(20)
			expect(result.output.sort).toBe('recent')
			expect(result.output.techOnly).toBeUndefined()
			expect(result.output.official).toBeUndefined()
		}
	})

	it('parses techOnly as boolean', () => {
		const resultTrue = v.safeParse(postsQuerySchema, { techOnly: 'true' })
		const resultFalse = v.safeParse(postsQuerySchema, { techOnly: 'false' })

		expect(resultTrue.success).toBe(true)
		expect(resultFalse.success).toBe(true)
		if (resultTrue.success && resultFalse.success) {
			expect(resultTrue.output.techOnly).toBe(true)
			expect(resultFalse.output.techOnly).toBe(false)
		}
	})

	it('parses official as boolean', () => {
		const resultTrue = v.safeParse(postsQuerySchema, { official: 'true' })
		const resultFalse = v.safeParse(postsQuerySchema, { official: 'false' })

		expect(resultTrue.success).toBe(true)
		expect(resultFalse.success).toBe(true)
		if (resultTrue.success && resultFalse.success) {
			expect(resultTrue.output.official).toBe(true)
			expect(resultFalse.output.official).toBe(false)
		}
	})

	it('validates sort option', () => {
		const resultRecent = v.safeParse(postsQuerySchema, { sort: 'recent' })
		const resultPopular = v.safeParse(postsQuerySchema, { sort: 'popular' })
		const resultInvalid = v.safeParse(postsQuerySchema, { sort: 'invalid' })

		expect(resultRecent.success).toBe(true)
		expect(resultPopular.success).toBe(true)
		expect(resultInvalid.success).toBe(false)
	})

	it('parses limit as number', () => {
		const result = v.safeParse(postsQuerySchema, { limit: '50' })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.limit).toBe(50)
		}
	})
})

describe('Ranking Query Validation', () => {
	const rankingQuerySchema = v.object({
		period: v.optional(v.picklist(['week', 'month']), 'week'),
		limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
		techOnly: v.optional(
			v.pipe(
				v.string(),
				v.transform((s) => s === 'true'),
			),
		),
	})

	it('validates default ranking params', () => {
		const result = v.safeParse(rankingQuerySchema, {})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.period).toBe('week')
			expect(result.output.limit).toBe(20)
		}
	})

	it('validates period option', () => {
		const resultWeek = v.safeParse(rankingQuerySchema, { period: 'week' })
		const resultMonth = v.safeParse(rankingQuerySchema, { period: 'month' })
		const resultInvalid = v.safeParse(rankingQuerySchema, { period: 'year' })

		expect(resultWeek.success).toBe(true)
		expect(resultMonth.success).toBe(true)
		expect(resultInvalid.success).toBe(false)
	})
})

describe('Ranking Period Calculation', () => {
	it('calculates week threshold correctly', () => {
		const now = new Date('2024-01-15T12:00:00Z')
		const weekThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

		expect(weekThreshold.toISOString()).toBe('2024-01-08T12:00:00.000Z')
	})

	it('calculates month threshold correctly', () => {
		const now = new Date('2024-01-15T12:00:00Z')
		const monthThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

		expect(monthThreshold.toISOString()).toBe('2023-12-16T12:00:00.000Z')
	})
})

describe('Cursor Parsing for Popular Sort', () => {
	// Helper to parse cursor in the same way as the actual route
	function parseCursor(cursor: string): { count: number; date: Date } {
		const colonIndex = cursor.indexOf(':')
		const countStr = cursor.slice(0, colonIndex)
		const dateStr = cursor.slice(colonIndex + 1)
		return {
			count: Number.parseInt(countStr, 10),
			date: new Date(dateStr),
		}
	}

	it('parses popular sort cursor format', () => {
		const cursor = '42:2024-01-15T12:00:00.000Z'
		const { count, date } = parseCursor(cursor)

		expect(count).toBe(42)
		expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
	})

	it('handles cursor with zero bookmark count', () => {
		const cursor = '0:2024-01-15T12:00:00.000Z'
		const { count, date } = parseCursor(cursor)

		expect(count).toBe(0)
		expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
	})

	it('handles high bookmark counts', () => {
		const cursor = '1000:2024-01-15T12:00:00.000Z'
		const { count, date } = parseCursor(cursor)

		expect(count).toBe(1000)
		expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
	})
})

describe('Search Query Validation', () => {
	const searchQuerySchema = v.object({
		q: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
	})

	it('validates search query length', () => {
		const validResult = v.safeParse(searchQuerySchema, { q: 'React' })
		const emptyResult = v.safeParse(searchQuerySchema, { q: '' })
		const longResult = v.safeParse(searchQuerySchema, { q: 'a'.repeat(101) })

		expect(validResult.success).toBe(true)
		expect(emptyResult.success).toBe(false)
		expect(longResult.success).toBe(false)
	})

	it('accepts Japanese search queries', () => {
		const result = v.safeParse(searchQuerySchema, { q: 'TypeScript入門' })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.q).toBe('TypeScript入門')
		}
	})
})
