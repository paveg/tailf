/**
 * Returns true only when `url` parses as an absolute http(s) URL.
 *
 * Used to gate RSS-derived URLs before they reach `<a href>` on the
 * frontend. Anything else — javascript:, data:, file:, mailto:,
 * protocol-relative URLs, or unparseable strings — is rejected so that
 * a malicious feed cannot inject script execution via a post link.
 */
export function isSafeUrl(url: string): boolean {
	if (typeof url !== 'string' || url.length === 0) return false
	try {
		const parsed = new URL(url.trim())
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}
