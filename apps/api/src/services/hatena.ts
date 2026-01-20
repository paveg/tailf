/**
 * Hatena Bookmark API service
 *
 * API endpoint: https://bookmark.hatenaapis.com/count/entry?url=<URL>
 * Returns: number (bookmark count)
 */

const HATENA_BOOKMARK_API = 'https://bookmark.hatenaapis.com/count/entry'

/**
 * Fetch bookmark count for a single URL
 */
export async function getBookmarkCount(url: string): Promise<number> {
	try {
		const apiUrl = `${HATENA_BOOKMARK_API}?url=${encodeURIComponent(url)}`
		const response = await fetch(apiUrl)

		if (!response.ok) {
			console.warn(`[Hatena] Failed to fetch bookmark count for ${url}: ${response.status}`)
			return 0
		}

		const count = await response.json()
		return typeof count === 'number' ? count : 0
	} catch (error) {
		console.warn(`[Hatena] Error fetching bookmark count for ${url}:`, error)
		return 0
	}
}

/**
 * Fetch bookmark counts for multiple URLs in batch
 * Note: Hatena API doesn't support batch requests, so we fetch sequentially with delay
 */
export async function getBookmarkCounts(
	urls: string[],
	delayMs = 100,
): Promise<Map<string, number>> {
	const counts = new Map<string, number>()

	for (const url of urls) {
		const count = await getBookmarkCount(url)
		counts.set(url, count)

		// Rate limiting: add delay between requests
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs))
		}
	}

	return counts
}
