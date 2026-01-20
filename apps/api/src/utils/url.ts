/**
 * URL normalization utilities
 *
 * 同じブログを重複登録しないために、URLを正規化する
 * - https:// を補完
 * - www. を除去（統一のため）
 * - 末尾スラッシュを除去
 * - ホスト名を小文字に
 */

export function normalizeUrl(url: string): string {
	let normalized = url.trim()

	// プロトコルがなければ https:// を追加
	if (!normalized.match(/^https?:\/\//i)) {
		normalized = `https://${normalized}`
	}

	try {
		const parsed = new URL(normalized)

		// ホスト名を小文字に & www. を除去
		let hostname = parsed.hostname.toLowerCase()
		if (hostname.startsWith('www.')) {
			hostname = hostname.slice(4)
		}

		// パスの末尾スラッシュを除去（ルート以外）
		let pathname = parsed.pathname
		if (pathname.length > 1 && pathname.endsWith('/')) {
			pathname = pathname.slice(0, -1)
		}

		// 再構築
		return `https://${hostname}${pathname}${parsed.search}`
	} catch {
		// パースに失敗した場合はそのまま返す
		return normalized
	}
}
