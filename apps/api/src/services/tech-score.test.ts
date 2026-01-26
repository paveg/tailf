import { describe, expect, it } from 'vitest'
import { calculateTechScore, isTechPost } from './tech-score'

describe('calculateTechScore', () => {
	describe('high weight keywords', () => {
		it('scores high for programming language mentions', () => {
			expect(calculateTechScore('TypeScript入門')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Python機械学習')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Rust入門ガイド')).toBeGreaterThanOrEqual(0.3)
		})

		it('scores high for framework mentions', () => {
			expect(calculateTechScore('React Hooksの使い方')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Next.jsでブログを作る')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Rails APIモード')).toBeGreaterThanOrEqual(0.3)
		})

		it('scores high for infrastructure keywords', () => {
			expect(calculateTechScore('Kubernetes入門')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Docker Compose解説')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('AWS Lambda活用術')).toBeGreaterThanOrEqual(0.3)
		})

		it('caps at 0.9 for 3 high weight matches', () => {
			const score = calculateTechScore('TypeScript React Next.js開発')
			// 3 high matches = 0.9, plus potential medium/low matches
			expect(score).toBeGreaterThanOrEqual(0.9)
		})
	})

	describe('medium weight keywords', () => {
		it('scores medium for Japanese tech terms', () => {
			expect(calculateTechScore('プログラミング初心者向け')).toBeGreaterThanOrEqual(0.15)
			expect(calculateTechScore('フロントエンド開発')).toBeGreaterThanOrEqual(0.15)
			expect(calculateTechScore('バックエンド設計')).toBeGreaterThanOrEqual(0.15)
		})

		it('scores medium for English tech terms', () => {
			expect(calculateTechScore('Architecture design patterns')).toBeGreaterThanOrEqual(0.15)
			expect(calculateTechScore('Microservices implementation')).toBeGreaterThanOrEqual(0.15)
		})
	})

	describe('low weight keywords', () => {
		it('scores low for general tech terms', () => {
			expect(calculateTechScore('便利なAPIを使う')).toBeGreaterThanOrEqual(0.05)
			expect(calculateTechScore('ツール紹介')).toBeGreaterThanOrEqual(0.05)
		})
	})

	describe('non-tech content', () => {
		it('scores low for non-tech content', () => {
			expect(calculateTechScore('今日の日記')).toBeLessThan(0.3)
			expect(calculateTechScore('旅行の思い出')).toBeLessThan(0.3)
			expect(calculateTechScore('おすすめの本')).toBeLessThan(0.3)
		})

		it('scores 0 for completely unrelated content', () => {
			expect(calculateTechScore('カフェでランチ')).toBe(0)
			expect(calculateTechScore('映画を見た')).toBe(0)
		})
	})

	describe('summary influence', () => {
		it('combines title and summary for scoring', () => {
			const titleOnly = calculateTechScore('ブログを始めました')
			const withSummary = calculateTechScore('ブログを始めました', 'TypeScript React Next.jsで開発')

			expect(withSummary).toBeGreaterThan(titleOnly)
		})

		it('handles undefined summary', () => {
			const score = calculateTechScore('TypeScript入門', undefined)
			expect(score).toBeGreaterThanOrEqual(0.3)
		})

		it('handles empty summary', () => {
			const score = calculateTechScore('TypeScript入門', '')
			expect(score).toBeGreaterThanOrEqual(0.3)
		})
	})

	describe('score capping', () => {
		it('caps score at 1.0', () => {
			// Article with many tech keywords
			const score = calculateTechScore(
				'TypeScript React Next.js開発',
				'プログラミング フロントエンド バックエンド アーキテクチャ API SDK CLI データ ツール 自動化',
			)
			expect(score).toBeLessThanOrEqual(1.0)
		})
	})

	describe('case insensitivity', () => {
		it('handles uppercase keywords', () => {
			expect(calculateTechScore('TYPESCRIPT入門')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('REACT HOOKS')).toBeGreaterThanOrEqual(0.3)
		})

		it('handles mixed case', () => {
			expect(calculateTechScore('TypeScript入門')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('typeScript入門')).toBeGreaterThanOrEqual(0.3)
		})
	})

	describe('real-world examples', () => {
		it('scores high for typical tech blog posts', () => {
			expect(calculateTechScore('React 18のSuspenseを深堀りする')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Rustで高速なCLIツールを作る')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Kubernetesでマイクロサービスをデプロイ')).toBeGreaterThanOrEqual(
				0.3,
			)
		})

		it('scores low for gadget reviews', () => {
			// Gadget reviews should score lower than pure tech content
			const techScore = calculateTechScore('React Hooksの使い方')
			const gadgetScore = calculateTechScore('新しいキーボードを買った')

			expect(techScore).toBeGreaterThan(gadgetScore)
		})
	})

	describe('search and feed related content', () => {
		it('scores high for RSS/feed related articles', () => {
			expect(calculateTechScore('RSSフィードをパースする')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('Atomフィードの仕様を理解する')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('クローラーを実装してブログを収集')).toBeGreaterThanOrEqual(0.3)
		})

		it('scores high for FTS/search related articles', () => {
			expect(calculateTechScore('全文検索エンジンを作る')).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('FTSでブログ記事を検索できるようにした')).toBeGreaterThanOrEqual(
				0.3,
			)
			expect(calculateTechScore('Meilisearchで検索機能を実装')).toBeGreaterThanOrEqual(0.3)
		})

		it('scores high for blog system building articles', () => {
			// This is a real-world example that was scoring too low before
			expect(
				calculateTechScore(
					'好きに書いて、技術記事だけ届く仕組みを作った',
					'全文検索とフィードアグリゲーターを組み合わせて技術記事だけをフィルタリングするシステム',
				),
			).toBeGreaterThanOrEqual(0.3)
			expect(calculateTechScore('静的サイトジェネレーターでブログを構築')).toBeGreaterThanOrEqual(
				0.3,
			)
			expect(calculateTechScore('Jamstackでブログをリニューアル')).toBeGreaterThanOrEqual(0.3)
		})
	})
})

describe('isTechPost', () => {
	it('returns true for tech posts with default threshold', () => {
		expect(isTechPost('TypeScript入門')).toBe(true)
		expect(isTechPost('React開発')).toBe(true)
	})

	it('returns false for non-tech posts with default threshold', () => {
		expect(isTechPost('今日の日記')).toBe(false)
		expect(isTechPost('旅行記')).toBe(false)
	})

	it('respects custom threshold', () => {
		const title = 'プログラミング初心者向け' // Medium keyword only
		const score = calculateTechScore(title)

		// With low threshold, should pass
		expect(isTechPost(title, undefined, 0.1)).toBe(true)
		// With high threshold, might not pass
		if (score < 0.5) {
			expect(isTechPost(title, undefined, 0.5)).toBe(false)
		}
	})

	it('considers summary in tech detection', () => {
		expect(isTechPost('ブログ始めました', 'TypeScript React Next.js開発')).toBe(true)
		expect(isTechPost('ブログ始めました', 'カフェでランチした')).toBe(false)
	})
})
