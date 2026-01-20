import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Format date to yyyy/mm/dd format
 */
export function formatDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}/${month}/${day}`
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
	try {
		return new URL(url).hostname
	} catch {
		return ''
	}
}
