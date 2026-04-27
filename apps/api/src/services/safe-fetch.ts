/**
 * Outbound HTTP wrapper used for any URL that originates from RSS feeds
 * or post records (i.e. attacker-controlled).
 *
 * - Validates scheme + hostname before each fetch (no http(s) → reject,
 *   private/loopback target → reject).
 * - Disables automatic redirect following and re-validates each Location
 *   so a 302 → http://[::1]/ chain can't smuggle SSRF past the initial
 *   check.
 * - Caps the response body so a malicious server can't drain memory /
 *   subrequest budget with a multi-GB feed (or a gzip bomb).
 */

import { isAllowedExternalUrl } from '../utils/url'

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const USER_AGENT = 'tailf RSS Aggregator'

export async function safeFetchExternal(initialUrl: string): Promise<string | null> {
	if (!isAllowedExternalUrl(initialUrl)) return null

	let currentUrl = initialUrl
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const response = await fetch(currentUrl, {
			headers: { 'User-Agent': USER_AGENT },
			redirect: 'manual',
		})

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location')
			if (!location) return null
			let nextUrl: string
			try {
				nextUrl = new URL(location, currentUrl).toString()
			} catch {
				return null
			}
			if (!isAllowedExternalUrl(nextUrl)) return null
			currentUrl = nextUrl
			continue
		}

		if (!response.ok) return null
		return await readBodyWithLimit(response, MAX_RESPONSE_BYTES)
	}

	return null
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string | null> {
	const lengthHeader = response.headers.get('content-length')
	if (lengthHeader) {
		const declared = Number(lengthHeader)
		if (Number.isFinite(declared) && declared > maxBytes) return null
	}
	if (!response.body) return null

	const reader = response.body.getReader()
	let received = 0
	const chunks: Uint8Array[] = []
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		received += value.byteLength
		if (received > maxBytes) {
			await reader.cancel()
			return null
		}
		chunks.push(value)
	}

	const buf = new Uint8Array(received)
	let offset = 0
	for (const chunk of chunks) {
		buf.set(chunk, offset)
		offset += chunk.byteLength
	}
	return new TextDecoder().decode(buf)
}
