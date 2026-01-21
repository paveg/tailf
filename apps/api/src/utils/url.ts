/**
 * URL normalization utilities
 *
 * 同じブログを重複登録しないために、URLを正規化する
 * - https:// を補完
 * - www. を除去（統一のため）
 * - 末尾スラッシュを除去
 * - ホスト名を小文字に
 */

import type { FeedType } from '../db/schema'

/** Slide hosting services */
const SLIDE_HOSTS = ['speakerdeck.com', 'slideshare.net', 'docswell.com']

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
