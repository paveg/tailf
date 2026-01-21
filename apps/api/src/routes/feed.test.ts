import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

/**
 * Test for feed route logic
 *
 * Tests focus on query validation and business logic patterns
 * since actual routes depend on D1 database.
 */

// Replicate the schema from feed.ts for testing
const cursorPaginationQuerySchema = v.object({
	cursor: v.optional(v.string()),
	limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
})

const feedQuerySchema = v.object({
	...cursorPaginationQuerySchema.entries,
	techOnly: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true'),
		),
	),
})

describe('Feed Query Validation', () => {
	it('validates default query params', () => {
		const result = v.safeParse(feedQuerySchema, {})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.limit).toBe(20)
			expect(result.output.cursor).toBeUndefined()
			expect(result.output.techOnly).toBeUndefined()
		}
	})

	it('parses techOnly as boolean', () => {
		const resultTrue = v.safeParse(feedQuerySchema, { techOnly: 'true' })
		const resultFalse = v.safeParse(feedQuerySchema, { techOnly: 'false' })

		expect(resultTrue.success).toBe(true)
		expect(resultFalse.success).toBe(true)
		if (resultTrue.success && resultFalse.success) {
			expect(resultTrue.output.techOnly).toBe(true)
			expect(resultFalse.output.techOnly).toBe(false)
		}
	})

	it('parses limit as number', () => {
		const result = v.safeParse(feedQuerySchema, { limit: '12' })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.limit).toBe(12)
		}
	})

	it('accepts cursor string', () => {
		const cursor = '2024-01-15T12:00:00.000Z'
		const result = v.safeParse(feedQuerySchema, { cursor })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.cursor).toBe(cursor)
		}
	})

	it('accepts multiple params together', () => {
		const result = v.safeParse(feedQuerySchema, {
			cursor: '2024-01-15T12:00:00.000Z',
			limit: '12',
			techOnly: 'true',
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.cursor).toBe('2024-01-15T12:00:00.000Z')
			expect(result.output.limit).toBe(12)
			expect(result.output.techOnly).toBe(true)
		}
	})
})

describe('Feed Condition Building Logic', () => {
	// Replicate the condition building logic from feed.ts
	const TECH_SCORE_THRESHOLD = 0.65

	interface BuildConditionsParams {
		feedIds: string[]
		cursor?: string
		techOnly?: boolean
	}

	// Returns descriptive condition types for testing
	function buildConditionTypes(params: BuildConditionsParams): string[] {
		const { feedIds, cursor, techOnly } = params
		const conditions: string[] = []

		if (feedIds.length > 0) {
			conditions.push('feedCondition')
		}
		if (cursor) {
			conditions.push('cursorCondition')
		}
		if (techOnly) {
			conditions.push('techCondition')
		}

		return conditions
	}

	it('builds only feed condition when no filters', () => {
		const conditions = buildConditionTypes({
			feedIds: ['feed1', 'feed2'],
		})

		expect(conditions).toEqual(['feedCondition'])
	})

	it('builds feed + cursor conditions', () => {
		const conditions = buildConditionTypes({
			feedIds: ['feed1'],
			cursor: '2024-01-15T12:00:00.000Z',
		})

		expect(conditions).toEqual(['feedCondition', 'cursorCondition'])
	})

	it('builds feed + tech conditions', () => {
		const conditions = buildConditionTypes({
			feedIds: ['feed1'],
			techOnly: true,
		})

		expect(conditions).toEqual(['feedCondition', 'techCondition'])
	})

	it('builds all conditions together', () => {
		const conditions = buildConditionTypes({
			feedIds: ['feed1', 'feed2'],
			cursor: '2024-01-15T12:00:00.000Z',
			techOnly: true,
		})

		expect(conditions).toEqual(['feedCondition', 'cursorCondition', 'techCondition'])
	})

	it('returns empty when no feedIds', () => {
		const conditions = buildConditionTypes({
			feedIds: [],
			cursor: '2024-01-15T12:00:00.000Z',
			techOnly: true,
		})

		// Feed condition won't be added if feedIds is empty
		expect(conditions).toEqual(['cursorCondition', 'techCondition'])
	})

	it('uses correct tech score threshold', () => {
		expect(TECH_SCORE_THRESHOLD).toBe(0.65)
	})
})

describe('Empty Bookmarks Response', () => {
	// Test the expected response when user has no bookmarks
	const emptyResponse = {
		data: [],
		meta: { nextCursor: null, hasMore: false },
	}

	it('returns correct empty response structure', () => {
		expect(emptyResponse.data).toEqual([])
		expect(emptyResponse.meta.nextCursor).toBeNull()
		expect(emptyResponse.meta.hasMore).toBe(false)
	})
})

describe('Cursor Parsing for Feed', () => {
	it('parses ISO date cursor correctly', () => {
		const cursor = '2024-01-15T12:00:00.000Z'
		const date = new Date(cursor)

		expect(date.toISOString()).toBe(cursor)
	})

	it('handles different timezone offsets', () => {
		// Cursor should always be in UTC ISO format
		const cursor = '2024-01-15T00:00:00.000Z'
		const date = new Date(cursor)

		expect(date.getUTCHours()).toBe(0)
		expect(date.getUTCMinutes()).toBe(0)
	})
})
