/**
 * Date handling edge case tests
 * These tests verify date parsing, comparison, and formatting across the codebase
 */
import { describe, expect, it } from 'vitest'

describe('Date Parsing Edge Cases', () => {
	describe('ISO 8601 format', () => {
		it('parses standard ISO format', () => {
			const date = new Date('2024-01-15T12:00:00.000Z')
			expect(date.getTime()).toBe(1705320000000)
		})

		it('parses ISO format without milliseconds', () => {
			const date = new Date('2024-01-15T12:00:00Z')
			expect(date.getTime()).toBe(1705320000000)
		})

		it('parses ISO format with timezone offset', () => {
			const dateUtc = new Date('2024-01-15T12:00:00Z')
			const dateJst = new Date('2024-01-15T21:00:00+09:00') // Same moment in JST
			expect(dateUtc.getTime()).toBe(dateJst.getTime())
		})
	})

	describe('RFC 2822 format (RSS pubDate)', () => {
		it('parses RFC 2822 format with GMT', () => {
			const date = new Date('Mon, 15 Jan 2024 12:00:00 GMT')
			expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
		})

		it('parses RFC 2822 format with timezone offset', () => {
			const date = new Date('Mon, 15 Jan 2024 21:00:00 +0900') // JST
			expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
		})

		it('parses RFC 2822 with abbreviated month', () => {
			const date = new Date('Wed, 01 Feb 2024 00:00:00 GMT')
			expect(date.getMonth()).toBe(1) // February = 1 (0-indexed)
		})
	})

	describe('Invalid date handling', () => {
		it('produces Invalid Date for garbage input', () => {
			const date = new Date('not a date')
			expect(Number.isNaN(date.getTime())).toBe(true)
		})

		it('produces Invalid Date for empty string', () => {
			const date = new Date('')
			expect(Number.isNaN(date.getTime())).toBe(true)
		})

		it('handles undefined by returning current date', () => {
			// This is how the RSS parser handles missing pubDate
			const fallback = undefined
			const date = fallback ? new Date(fallback) : new Date()
			expect(Number.isNaN(date.getTime())).toBe(false)
		})
	})
})

describe('Date Comparison Edge Cases', () => {
	describe('Timestamp precision', () => {
		it('distinguishes millisecond differences', () => {
			const date1 = new Date('2024-01-15T12:00:00.000Z')
			const date2 = new Date('2024-01-15T12:00:00.001Z')
			expect(date1 < date2).toBe(true)
			expect(date1.getTime()).not.toBe(date2.getTime())
		})

		it('treats equal timestamps as equal', () => {
			const date1 = new Date('2024-01-15T12:00:00.000Z')
			const date2 = new Date('2024-01-15T12:00:00.000Z')
			expect(date1.getTime()).toBe(date2.getTime())
		})
	})

	describe('Boundary conditions', () => {
		it('handles year boundary (Dec 31 -> Jan 1)', () => {
			const endOfYear = new Date('2023-12-31T23:59:59.999Z')
			const startOfYear = new Date('2024-01-01T00:00:00.000Z')
			expect(endOfYear < startOfYear).toBe(true)
			expect(startOfYear.getTime() - endOfYear.getTime()).toBe(1) // 1ms difference
		})

		it('handles month boundary', () => {
			const endOfJan = new Date('2024-01-31T23:59:59.999Z')
			const startOfFeb = new Date('2024-02-01T00:00:00.000Z')
			expect(endOfJan < startOfFeb).toBe(true)
		})

		it('handles leap year (Feb 29)', () => {
			const leapDay = new Date('2024-02-29T12:00:00Z')
			expect(leapDay.getDate()).toBe(29)
			expect(leapDay.getMonth()).toBe(1) // February
		})
	})

	describe('Relative time calculations', () => {
		it('calculates 7 days ago correctly', () => {
			const now = new Date('2024-01-15T12:00:00Z')
			const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
			expect(weekAgo.toISOString()).toBe('2024-01-08T12:00:00.000Z')
		})

		it('calculates 30 days ago correctly', () => {
			const now = new Date('2024-01-15T12:00:00Z')
			const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
			expect(monthAgo.toISOString()).toBe('2023-12-16T12:00:00.000Z')
		})

		it('handles DST transition (hypothetical)', () => {
			// Note: UTC doesn't have DST, but this tests that calculations stay consistent
			const beforeDst = new Date('2024-03-10T01:00:00Z')
			const afterHour = new Date(beforeDst.getTime() + 60 * 60 * 1000)
			expect(afterHour.getUTCHours()).toBe(2)
		})
	})
})

describe('Cursor Date Parsing', () => {
	// Simulates the cursor parsing logic from posts.ts
	function parseCursor(cursor: string): { count: number; date: Date } {
		const colonIndex = cursor.indexOf(':')
		const countStr = cursor.slice(0, colonIndex)
		const dateStr = cursor.slice(colonIndex + 1)
		return {
			count: Number.parseInt(countStr, 10),
			date: new Date(dateStr),
		}
	}

	it('parses cursor with ISO date correctly', () => {
		const cursor = '42:2024-01-15T12:00:00.000Z'
		const { count, date } = parseCursor(cursor)
		expect(count).toBe(42)
		expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
	})

	it('handles cursor with high bookmark count', () => {
		const cursor = '9999:2024-01-15T12:00:00.000Z'
		const { count, date } = parseCursor(cursor)
		expect(count).toBe(9999)
		expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
	})

	it('handles cursor with zero bookmark count', () => {
		const cursor = '0:2024-01-15T12:00:00.000Z'
		const { count, date } = parseCursor(cursor)
		expect(count).toBe(0)
		expect(date.toISOString()).toBe('2024-01-15T12:00:00.000Z')
	})

	it('correctly splits on first colon only (ISO date has colons)', () => {
		// The bug was using split(':') which broke on ISO dates
		const cursor = '42:2024-01-15T12:30:45.000Z'
		const { count, date } = parseCursor(cursor)
		expect(count).toBe(42)
		expect(date.getUTCHours()).toBe(12)
		expect(date.getUTCMinutes()).toBe(30)
		expect(date.getUTCSeconds()).toBe(45)
	})

	it('handles date at midnight', () => {
		const cursor = '10:2024-01-15T00:00:00.000Z'
		const { date } = parseCursor(cursor)
		expect(date.getUTCHours()).toBe(0)
		expect(date.getUTCMinutes()).toBe(0)
	})

	it('handles date at end of day', () => {
		const cursor = '10:2024-01-15T23:59:59.999Z'
		const { date } = parseCursor(cursor)
		expect(date.getUTCHours()).toBe(23)
		expect(date.getUTCMinutes()).toBe(59)
		expect(date.getUTCSeconds()).toBe(59)
		expect(date.getUTCMilliseconds()).toBe(999)
	})
})

describe('Session Expiry Comparison', () => {
	// Simulates the session expiry check from auth.ts
	function isSessionExpired(expiresAt: Date): boolean {
		return expiresAt < new Date()
	}

	it('returns true for past date', () => {
		const pastDate = new Date('2020-01-01T00:00:00Z')
		expect(isSessionExpired(pastDate)).toBe(true)
	})

	it('returns false for future date', () => {
		const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours from now
		expect(isSessionExpired(futureDate)).toBe(false)
	})

	it('returns true when expired exactly now (edge case)', () => {
		// Note: This test is inherently racy, but demonstrates the edge case
		const now = new Date()
		// A date in the past by even 1ms should be expired
		const justExpired = new Date(now.getTime() - 1)
		expect(isSessionExpired(justExpired)).toBe(true)
	})
})

describe('Ranking Period Threshold', () => {
	// Simulates the ranking threshold calculation from posts.ts
	function getThreshold(period: 'week' | 'month', now: Date): Date {
		return new Date(
			period === 'week'
				? now.getTime() - 7 * 24 * 60 * 60 * 1000
				: now.getTime() - 30 * 24 * 60 * 60 * 1000,
		)
	}

	it('week threshold is exactly 7 days ago', () => {
		const now = new Date('2024-01-15T12:00:00Z')
		const threshold = getThreshold('week', now)
		expect(threshold.toISOString()).toBe('2024-01-08T12:00:00.000Z')
	})

	it('month threshold is exactly 30 days ago', () => {
		const now = new Date('2024-01-15T12:00:00Z')
		const threshold = getThreshold('month', now)
		expect(threshold.toISOString()).toBe('2023-12-16T12:00:00.000Z')
	})

	it('post on threshold boundary is included', () => {
		const now = new Date('2024-01-15T12:00:00Z')
		const threshold = getThreshold('week', now)
		const postDate = new Date('2024-01-08T12:00:00.000Z') // Exactly on threshold

		// Using >= means posts exactly on threshold are included
		expect(postDate >= threshold).toBe(true)
	})

	it('post 1ms before threshold is excluded', () => {
		const now = new Date('2024-01-15T12:00:00Z')
		const threshold = getThreshold('week', now)
		const postDate = new Date('2024-01-08T11:59:59.999Z') // 1ms before threshold

		expect(postDate >= threshold).toBe(false)
	})
})
