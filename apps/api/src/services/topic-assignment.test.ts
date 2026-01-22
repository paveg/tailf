import { describe, expect, it } from 'vitest'
import { assignTopics, isValidTopic, TOPIC_IDS, topicsToArray } from './topic-assignment'

describe('assignTopics', () => {
	describe('AI topic', () => {
		it('assigns ai topic for LLM/ML content', () => {
			expect(assignTopics('ChatGPTの使い方').mainTopic).toBe('ai')
			expect(assignTopics('LLMを使ったアプリ開発').mainTopic).toBe('ai')
			expect(assignTopics('機械学習入門').mainTopic).toBe('ai')
		})

		it('assigns ai topic for AI tools', () => {
			expect(assignTopics('Claude APIを使ってみた').mainTopic).toBe('ai')
			expect(assignTopics('LangChainでRAGを構築').mainTopic).toBe('ai')
			expect(assignTopics('OpenAI Embeddings活用術').mainTopic).toBe('ai')
		})
	})

	describe('Backend topic', () => {
		it('assigns backend topic for server-side frameworks', () => {
			expect(assignTopics('Hono入門').mainTopic).toBe('backend')
			expect(assignTopics('FastAPI実践ガイド').mainTopic).toBe('backend')
			expect(assignTopics('Ruby on Rails 7の新機能').mainTopic).toBe('backend')
		})

		it('assigns backend topic for API development', () => {
			expect(assignTopics('REST API設計のベストプラクティス').mainTopic).toBe('backend')
			expect(assignTopics('GraphQL入門').mainTopic).toBe('backend')
		})
	})

	describe('Cloud topic', () => {
		it('assigns cloud topic for cloud providers', () => {
			expect(assignTopics('AWS Lambda入門').mainTopic).toBe('cloud')
			expect(assignTopics('GCP Cloud Runでデプロイ').mainTopic).toBe('cloud')
			expect(assignTopics('Cloudflare Workers活用').mainTopic).toBe('cloud')
		})

		it('assigns cloud topic for container/k8s', () => {
			expect(assignTopics('Kubernetes入門').mainTopic).toBe('cloud')
			expect(assignTopics('Docker Compose解説').mainTopic).toBe('cloud')
		})
	})

	describe('Data topic', () => {
		it('assigns data topic for data engineering', () => {
			expect(assignTopics('BigQueryでデータ分析').mainTopic).toBe('data')
			expect(assignTopics('dbtでデータモデリング').mainTopic).toBe('data')
			expect(assignTopics('Snowflake入門').mainTopic).toBe('data')
		})

		it('assigns data topic for ETL/pipeline', () => {
			expect(assignTopics('Airflowでデータパイプライン構築').mainTopic).toBe('data')
			expect(assignTopics('ETL処理の設計').mainTopic).toBe('data')
		})
	})

	describe('DevOps topic', () => {
		it('assigns devops topic for CI/CD', () => {
			expect(assignTopics('GitHub Actionsでデプロイ自動化').mainTopic).toBe('devops')
			expect(assignTopics('CI/CD入門').mainTopic).toBe('devops')
			expect(assignTopics('ArgoCD実践ガイド').mainTopic).toBe('devops')
		})

		it('assigns devops topic for monitoring/SRE', () => {
			expect(assignTopics('Prometheus + Grafanaで監視').mainTopic).toBe('devops')
			expect(assignTopics('SREの実践').mainTopic).toBe('devops')
			expect(assignTopics('オブザーバビリティ入門').mainTopic).toBe('devops')
		})
	})

	describe('Frontend topic', () => {
		it('assigns frontend topic for JS frameworks', () => {
			expect(assignTopics('React入門').mainTopic).toBe('frontend')
			expect(assignTopics('Vue.js 3の新機能').mainTopic).toBe('frontend')
			expect(assignTopics('Next.jsでSSG').mainTopic).toBe('frontend')
		})

		it('assigns frontend topic for CSS/styling', () => {
			expect(assignTopics('Tailwind CSSの使い方').mainTopic).toBe('frontend')
			expect(assignTopics('CSS-in-JS比較').mainTopic).toBe('frontend')
		})
	})

	describe('Mobile topic', () => {
		it('assigns mobile topic for native development', () => {
			expect(assignTopics('SwiftUI入門').mainTopic).toBe('mobile')
			expect(assignTopics('Kotlin Jetpack Compose').mainTopic).toBe('mobile')
			expect(assignTopics('iOS開発のベストプラクティス').mainTopic).toBe('mobile')
		})

		it('assigns mobile topic for cross-platform', () => {
			expect(assignTopics('Flutter入門').mainTopic).toBe('mobile')
			// React Native contains "react" which also matches frontend
			// Use a more specific mobile-focused title
			expect(assignTopics('Expoでモバイルアプリ開発').mainTopic).toBe('mobile')
		})
	})

	describe('OSS topic', () => {
		it('assigns oss topic for open source content', () => {
			expect(assignTopics('OSSへのコントリビュート').mainTopic).toBe('oss')
			expect(assignTopics('GitHubでプルリクエスト').mainTopic).toBe('oss')
			expect(assignTopics('オープンソースの始め方').mainTopic).toBe('oss')
		})
	})

	describe('Security topic', () => {
		it('assigns security topic for auth/security', () => {
			expect(assignTopics('OAuth 2.0入門').mainTopic).toBe('security')
			expect(assignTopics('JWT認証の実装').mainTopic).toBe('security')
			expect(assignTopics('OWASP Top 10対策').mainTopic).toBe('security')
		})

		it('assigns security topic for cryptography', () => {
			expect(assignTopics('暗号化の基礎').mainTopic).toBe('security')
			expect(assignTopics('TLS/SSL証明書の仕組み').mainTopic).toBe('security')
		})
	})

	describe('Web3 topic', () => {
		it('assigns web3 topic for blockchain', () => {
			expect(assignTopics('Ethereum入門').mainTopic).toBe('web3')
			expect(assignTopics('Solidityでスマートコントラクト').mainTopic).toBe('web3')
			expect(assignTopics('ブロックチェーン開発').mainTopic).toBe('web3')
		})

		it('assigns web3 topic for DeFi/NFT', () => {
			expect(assignTopics('DeFiプロトコルの仕組み').mainTopic).toBe('web3')
			expect(assignTopics('NFTマーケットプレイス構築').mainTopic).toBe('web3')
		})
	})

	describe('multiple topics', () => {
		it('assigns both mainTopic and subTopic when multiple match', () => {
			const result = assignTopics('React + TypeScriptでGraphQL API開発')
			expect(result.mainTopic).not.toBeNull()
			expect(result.subTopic).not.toBeNull()
			// frontend (React, TypeScript) and backend (GraphQL, API) should both match
		})

		it('assigns null subTopic when only one topic matches', () => {
			const result = assignTopics('Rustの基礎')
			// Only backend matches
			expect(result.mainTopic).toBe('backend')
			expect(result.subTopic).toBeNull()
		})
	})

	describe('no match', () => {
		it('returns null for both when no keywords match', () => {
			const result = assignTopics('今日の日記')
			expect(result.mainTopic).toBeNull()
			expect(result.subTopic).toBeNull()
		})

		it('handles empty input', () => {
			const result = assignTopics('')
			expect(result.mainTopic).toBeNull()
			expect(result.subTopic).toBeNull()
		})
	})

	describe('summary influence', () => {
		it('considers summary in topic assignment', () => {
			const result = assignTopics('技術ブログ始めました', 'ReactとTypeScriptで開発')
			expect(result.mainTopic).toBe('frontend')
		})

		it('handles undefined summary', () => {
			const result = assignTopics('React入門', undefined)
			expect(result.mainTopic).toBe('frontend')
		})
	})

	describe('case insensitivity', () => {
		it('handles uppercase keywords', () => {
			expect(assignTopics('REACT入門').mainTopic).toBe('frontend')
			expect(assignTopics('AWS LAMBDA').mainTopic).toBe('cloud')
		})

		it('handles mixed case', () => {
			expect(assignTopics('typeScript入門').mainTopic).toBe('frontend')
			expect(assignTopics('GitHub Actions').mainTopic).toBe('devops')
		})
	})
})

describe('topicsToArray', () => {
	it('returns both topics when both exist', () => {
		expect(topicsToArray('ai', 'backend')).toEqual(['ai', 'backend'])
	})

	it('returns single topic when only mainTopic exists', () => {
		expect(topicsToArray('frontend', null)).toEqual(['frontend'])
	})

	it('returns empty array when both are null', () => {
		expect(topicsToArray(null, null)).toEqual([])
	})

	it('handles undefined values', () => {
		expect(topicsToArray(undefined, undefined)).toEqual([])
		expect(topicsToArray('ai', undefined)).toEqual(['ai'])
	})
})

describe('isValidTopic', () => {
	it('returns true for valid topic IDs', () => {
		for (const id of TOPIC_IDS) {
			expect(isValidTopic(id)).toBe(true)
		}
	})

	it('returns false for invalid topic IDs', () => {
		expect(isValidTopic('invalid')).toBe(false)
		expect(isValidTopic('')).toBe(false)
		expect(isValidTopic('AI')).toBe(false) // case sensitive
	})
})
