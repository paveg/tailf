import { describe, expect, it } from 'vitest'
import { buildCursorResponse } from './pagination'

describe('buildCursorResponse', () => {
	// Helper to create test items
	const createItem = (date: string, bookmarkCount?: number) => ({
		id: `item-${date}`,
		publishedAt: new Date(date),
		hatenaBookmarkCount: bookmarkCount,
	})

	describe('with recent sort (default)', () => {
		it('returns hasMore: false when results <= limit', () => {
			const results = [createItem('2024-01-03T00:00:00Z'), createItem('2024-01-02T00:00:00Z')]

			const response = buildCursorResponse(results, 10)

			expect(response.data).toHaveLength(2)
			expect(response.meta.hasMore).toBe(false)
			expect(response.meta.nextCursor).toBeNull()
		})

		it('returns hasMore: true when results > limit', () => {
			const results = [
				createItem('2024-01-03T00:00:00Z'),
				createItem('2024-01-02T00:00:00Z'),
				createItem('2024-01-01T00:00:00Z'), // extra item (limit + 1)
			]

			const response = buildCursorResponse(results, 2)

			expect(response.data).toHaveLength(2)
			expect(response.meta.hasMore).toBe(true)
			expect(response.meta.nextCursor).toBe('2024-01-02T00:00:00.000Z')
		})

		it('uses ISO string as cursor for recent sort', () => {
			const results = [createItem('2024-01-15T12:30:45.123Z'), createItem('2024-01-14T00:00:00Z')]

			const response = buildCursorResponse(results, 1)

			expect(response.meta.nextCursor).toBe('2024-01-15T12:30:45.123Z')
		})

		it('handles empty results', () => {
			const response = buildCursorResponse([], 10)

			expect(response.data).toHaveLength(0)
			expect(response.meta.hasMore).toBe(false)
			expect(response.meta.nextCursor).toBeNull()
		})

		it('handles exactly limit items (no extra)', () => {
			const results = [
				createItem('2024-01-03T00:00:00Z'),
				createItem('2024-01-02T00:00:00Z'),
				createItem('2024-01-01T00:00:00Z'),
			]

			const response = buildCursorResponse(results, 3)

			expect(response.data).toHaveLength(3)
			expect(response.meta.hasMore).toBe(false)
			expect(response.meta.nextCursor).toBeNull()
		})
	})

	describe('with popular sort', () => {
		it('uses compound cursor format (count:date)', () => {
			const results = [
				createItem('2024-01-03T00:00:00Z', 100),
				createItem('2024-01-02T00:00:00Z', 50),
				createItem('2024-01-01T00:00:00Z', 25), // extra item
			]

			const response = buildCursorResponse(results, 2, 'popular')

			expect(response.data).toHaveLength(2)
			expect(response.meta.hasMore).toBe(true)
			expect(response.meta.nextCursor).toBe('50:2024-01-02T00:00:00.000Z')
		})

		it('handles null bookmark count as 0', () => {
			const results = [
				createItem('2024-01-02T00:00:00Z', null),
				createItem('2024-01-01T00:00:00Z', null), // extra
			]

			const response = buildCursorResponse(results, 1, 'popular')

			expect(response.meta.nextCursor).toBe('0:2024-01-02T00:00:00.000Z')
		})

		it('handles undefined bookmark count as 0', () => {
			const results = [
				createItem('2024-01-02T00:00:00Z', undefined),
				createItem('2024-01-01T00:00:00Z', undefined), // extra
			]

			const response = buildCursorResponse(results, 1, 'popular')

			expect(response.meta.nextCursor).toBe('0:2024-01-02T00:00:00.000Z')
		})

		it('handles high bookmark counts', () => {
			const results = [
				createItem('2024-01-02T00:00:00Z', 9999),
				createItem('2024-01-01T00:00:00Z', 5000), // extra
			]

			const response = buildCursorResponse(results, 1, 'popular')

			expect(response.meta.nextCursor).toBe('9999:2024-01-02T00:00:00.000Z')
		})

		it('handles zero bookmark count', () => {
			const results = [
				createItem('2024-01-02T00:00:00Z', 0),
				createItem('2024-01-01T00:00:00Z', 0), // extra
			]

			const response = buildCursorResponse(results, 1, 'popular')

			expect(response.meta.nextCursor).toBe('0:2024-01-02T00:00:00.000Z')
		})
	})

	describe('edge cases', () => {
		it('preserves all item properties in data', () => {
			const results = [
				{
					id: 'post-1',
					title: 'Test Post',
					publishedAt: new Date('2024-01-01T00:00:00Z'),
					hatenaBookmarkCount: 42,
					customField: 'value',
				},
			]

			const response = buildCursorResponse(results, 10)

			expect(response.data[0]).toEqual(results[0])
			expect(response.data[0].customField).toBe('value')
		})

		it('handles limit of 1', () => {
			const results = [
				createItem('2024-01-02T00:00:00Z'),
				createItem('2024-01-01T00:00:00Z'), // extra
			]

			const response = buildCursorResponse(results, 1)

			expect(response.data).toHaveLength(1)
			expect(response.meta.hasMore).toBe(true)
		})

		it('handles large limit with few results', () => {
			const results = [createItem('2024-01-01T00:00:00Z')]

			const response = buildCursorResponse(results, 1000)

			expect(response.data).toHaveLength(1)
			expect(response.meta.hasMore).toBe(false)
		})
	})
})
