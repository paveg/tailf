import {
	createFeedSchema,
	cursorPaginationQuerySchema,
	paginationSchema,
	searchSchema,
} from '@tailf/shared'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

describe('createFeedSchema', () => {
	it('validates valid feed URL', () => {
		const result = v.safeParse(createFeedSchema, {
			feedUrl: 'https://example.com/feed.xml',
		})
		expect(result.success).toBe(true)
	})

	it('validates with optional fields', () => {
		const result = v.safeParse(createFeedSchema, {
			feedUrl: 'https://example.com/feed.xml',
			title: 'My Blog',
			description: 'A tech blog',
			siteUrl: 'https://example.com',
		})
		expect(result.success).toBe(true)
	})

	it('rejects invalid URL', () => {
		const result = v.safeParse(createFeedSchema, {
			feedUrl: 'not-a-url',
		})
		expect(result.success).toBe(false)
	})

	it('rejects missing feedUrl', () => {
		const result = v.safeParse(createFeedSchema, {})
		expect(result.success).toBe(false)
	})

	it('rejects title over 255 chars', () => {
		const result = v.safeParse(createFeedSchema, {
			feedUrl: 'https://example.com/feed.xml',
			title: 'a'.repeat(256),
		})
		expect(result.success).toBe(false)
	})

	it('rejects description over 1000 chars', () => {
		const result = v.safeParse(createFeedSchema, {
			feedUrl: 'https://example.com/feed.xml',
			description: 'a'.repeat(1001),
		})
		expect(result.success).toBe(false)
	})
})

describe('paginationSchema', () => {
	it('uses defaults for empty input', () => {
		const result = v.safeParse(paginationSchema, {})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.page).toBe(1)
			expect(result.output.perPage).toBe(20)
		}
	})

	it('accepts valid page and perPage', () => {
		const result = v.safeParse(paginationSchema, { page: 5, perPage: 50 })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.page).toBe(5)
			expect(result.output.perPage).toBe(50)
		}
	})

	it('rejects page less than 1', () => {
		const result = v.safeParse(paginationSchema, { page: 0 })
		expect(result.success).toBe(false)
	})

	it('rejects perPage over 100', () => {
		const result = v.safeParse(paginationSchema, { perPage: 101 })
		expect(result.success).toBe(false)
	})
})

describe('cursorPaginationQuerySchema', () => {
	it('uses defaults for empty input', () => {
		const result = v.safeParse(cursorPaginationQuerySchema, {})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.cursor).toBeUndefined()
			expect(result.output.limit).toBe(20)
		}
	})

	it('parses limit as number from string', () => {
		const result = v.safeParse(cursorPaginationQuerySchema, { limit: '50' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.limit).toBe(50)
		}
	})

	it('accepts cursor string', () => {
		const result = v.safeParse(cursorPaginationQuerySchema, {
			cursor: '2024-01-15T12:00:00.000Z',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.cursor).toBe('2024-01-15T12:00:00.000Z')
		}
	})

	it('accepts popular sort cursor format', () => {
		const result = v.safeParse(cursorPaginationQuerySchema, {
			cursor: '42:2024-01-15T12:00:00.000Z',
		})
		expect(result.success).toBe(true)
	})
})

describe('searchSchema', () => {
	it('validates search query', () => {
		const result = v.safeParse(searchSchema, { q: 'React' })
		expect(result.success).toBe(true)
	})

	it('rejects empty query', () => {
		const result = v.safeParse(searchSchema, { q: '' })
		expect(result.success).toBe(false)
	})

	it('rejects query over 100 chars', () => {
		const result = v.safeParse(searchSchema, { q: 'a'.repeat(101) })
		expect(result.success).toBe(false)
	})

	it('accepts Japanese query', () => {
		const result = v.safeParse(searchSchema, { q: 'TypeScript入門' })
		expect(result.success).toBe(true)
	})

	it('includes pagination defaults', () => {
		const result = v.safeParse(searchSchema, { q: 'test' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.output.page).toBe(1)
			expect(result.output.perPage).toBe(20)
		}
	})
})
