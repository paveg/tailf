/**
 * Cursor utilities for pagination
 */

export interface PopularCursor {
	count: number
	date: Date
}

/**
 * Parse popular sort cursor format: "count:isoDateString"
 * Uses indexOf to handle ISO date strings which contain colons
 */
export function parsePopularCursor(cursor: string): PopularCursor {
	const colonIndex = cursor.indexOf(':')
	return {
		count: Number.parseInt(cursor.slice(0, colonIndex), 10),
		date: new Date(cursor.slice(colonIndex + 1)),
	}
}

/**
 * Build popular sort cursor from count and date
 */
export function buildPopularCursor(count: number, date: Date): string {
	return `${count}:${date.toISOString()}`
}
