/**
 * Decode HTML entities in text
 * Handles common entities: &amp; &lt; &gt; &quot; &apos; and numeric/hex entities
 */
export function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}

/**
 * Decode HTML entities, strip HTML tags, and normalize whitespace
 * Used for preparing text for keyword matching and scoring
 */
export function cleanTextForScoring(text: string): string {
	return decodeHtmlEntities(text)
		.replace(/&hellip;/g, '...')
		.replace(/&nbsp;/g, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}
