/**
 * URL normalization utilities
 *
 * 同じブログを重複登録しないために、URLを正規化する
 * - https:// を補完
 * - www. を除去（統一のため）
 * - 末尾スラッシュを除去
 * - ホスト名を小文字に
 *
 * Also exposes hostname / external-URL safety checks used by the
 * outbound HTTP wrapper to defend against SSRF.
 */

import type { FeedType } from '../db/schema'

/** Slide hosting services */
const SLIDE_HOSTS = ['speakerdeck.com', 'slideshare.net', 'docswell.com']

/** Hostnames that always resolve to the local machine. */
const ALWAYS_PRIVATE = new Set(['localhost', '0.0.0.0', '0'])

function ipv4DottedToInt(ip: string): number | null {
	const parts = ip.split('.')
	if (parts.length !== 4) return null
	let total = 0
	for (const part of parts) {
		if (!/^\d+$/.test(part)) return null
		const n = Number(part)
		if (n < 0 || n > 255) return null
		total = total * 256 + n
	}
	return total
}

function isPrivateIPv4Number(n: number): boolean {
	if (!Number.isFinite(n) || n < 0 || n > 0xff_ff_ff_ff) return false
	if (n === 0) return true
	// 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16
	return (
		(n >= 0x0a_00_00_00 && n <= 0x0a_ff_ff_ff) ||
		(n >= 0x7f_00_00_00 && n <= 0x7f_ff_ff_ff) ||
		(n >= 0xa9_fe_00_00 && n <= 0xa9_fe_ff_ff) ||
		(n >= 0xac_10_00_00 && n <= 0xac_1f_ff_ff) ||
		(n >= 0xc0_a8_00_00 && n <= 0xc0_a8_ff_ff)
	)
}

function tryNumericHostToInt(host: string): number | null {
	if (/^0x[0-9a-f]+$/i.test(host)) return Number.parseInt(host.slice(2), 16)
	if (/^0[0-7]+$/.test(host)) return Number.parseInt(host, 8)
	if (/^\d+$/.test(host)) return Number.parseInt(host, 10)
	return null
}

function isPrivateIPv6(host: string): boolean {
	if (host === '::1' || host === '::') return true
	const mappedMatch = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
	if (mappedMatch) {
		const n = ipv4DottedToInt(mappedMatch[1])
		return n !== null && isPrivateIPv4Number(n)
	}
	// ULA: fc00::/7 (fc..–fd..)
	if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return true
	// Link-local: fe80::/10 (fe80–febf)
	if (/^fe[89ab][0-9a-f]?:/.test(host)) return true
	return false
}

/**
 * Returns true when `hostname` resolves to a private/loopback target.
 * Accepts the bracketed-IPv6 form (`[::1]`) for convenience even though
 * `URL.hostname` strips the brackets itself.
 */
export function isPrivateHostname(hostname: string): boolean {
	if (typeof hostname !== 'string' || hostname.length === 0) return false
	const cleaned = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
	if (ALWAYS_PRIVATE.has(cleaned)) return true

	const dottedInt = ipv4DottedToInt(cleaned)
	if (dottedInt !== null) return isPrivateIPv4Number(dottedInt)

	const numericInt = tryNumericHostToInt(cleaned)
	if (numericInt !== null) return isPrivateIPv4Number(numericInt)

	if (cleaned.includes(':')) return isPrivateIPv6(cleaned)

	return false
}

/**
 * Returns true only for absolute http(s) URLs whose hostname is public.
 * Used by the outbound fetch wrapper to keep RSS / OGP fetches off any
 * private-network target.
 */
export function isAllowedExternalUrl(url: string): boolean {
	if (typeof url !== 'string' || url.length === 0) return false
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return false
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
	return !isPrivateHostname(parsed.hostname)
}

/**
 * Detect feed type from URL based on hostname
 */
export function detectFeedType(feedUrl: string): FeedType {
	const hostname = new URL(feedUrl).hostname.toLowerCase().replace(/^www\./, '')
	return SLIDE_HOSTS.some((host) => hostname.includes(host)) ? 'slide' : 'blog'
}

export function normalizeUrl(url: string): string {
	const trimmed = url.trim()
	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

	try {
		const parsed = new URL(withProtocol)
		const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
		let pathname = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, '') : '/'

		// SpeakerDeck: prefer .atom over .rss for cleaner feed format
		if (hostname === 'speakerdeck.com' && pathname.endsWith('.rss')) {
			pathname = pathname.replace(/\.rss$/, '.atom')
		}

		return `https://${hostname}${pathname}${parsed.search}`
	} catch {
		return withProtocol
	}
}
