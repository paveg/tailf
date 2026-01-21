/**
 * Date utilities and duration constants
 */

export const DURATIONS = {
	WEEK_MS: 7 * 24 * 60 * 60 * 1000,
	MONTH_MS: 30 * 24 * 60 * 60 * 1000,
	SESSION_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,
} as const

/**
 * Get threshold date for a given period
 */
export function getThreshold(period: 'week' | 'month', from: Date = new Date()): Date {
	const duration = period === 'week' ? DURATIONS.WEEK_MS : DURATIONS.MONTH_MS
	return new Date(from.getTime() - duration)
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(expiresAt: Date | null | undefined): boolean {
	return !expiresAt || expiresAt < new Date()
}
