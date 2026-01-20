/**
 * Tech score calculation for posts
 * Keyword-based scoring (0.0 - 1.0)
 */

// High confidence tech keywords (weight: 0.3 each, max 3 matches = 0.9)
const HIGH_WEIGHT_KEYWORDS = [
	// Programming languages
	'javascript',
	'typescript',
	'python',
	'rust',
	'go',
	'golang',
	'ruby',
	'java',
	'kotlin',
	'swift',
	'c++',
	'c#',
	'php',
	'scala',
	'elixir',
	'haskell',
	'clojure',
	// Frameworks & Libraries
	'react',
	'vue',
	'angular',
	'next.js',
	'nextjs',
	'nuxt',
	'svelte',
	'astro',
	'rails',
	'django',
	'fastapi',
	'express',
	'hono',
	'spring',
	'laravel',
	// Infrastructure
	'kubernetes',
	'k8s',
	'docker',
	'terraform',
	'aws',
	'gcp',
	'azure',
	'cloudflare',
	'vercel',
	'netlify',
	// Databases
	'postgresql',
	'mysql',
	'mongodb',
	'redis',
	'elasticsearch',
	'dynamodb',
	'sqlite',
	'drizzle',
	'prisma',
	// DevOps & Tools
	'github actions',
	'ci/cd',
	'jenkins',
	'graphql',
	'rest api',
	'grpc',
	'webpack',
	'vite',
	'esbuild',
]

// Medium confidence tech keywords (weight: 0.15 each)
const MEDIUM_WEIGHT_KEYWORDS = [
	// General tech terms (Japanese)
	'プログラミング',
	'エンジニア',
	'エンジニアリング',
	'開発',
	'実装',
	'アーキテクチャ',
	'インフラ',
	'バックエンド',
	'フロントエンド',
	'フルスタック',
	'データベース',
	'アルゴリズム',
	'デプロイ',
	'リファクタリング',
	'テスト',
	'ユニットテスト',
	'コードレビュー',
	'プルリクエスト',
	'マイクロサービス',
	'サーバーレス',
	'コンテナ',
	'仮想化',
	'クラウド',
	'機械学習',
	'ディープラーニング',
	'自然言語処理',
	'コンパイラ',
	'パフォーマンス',
	'セキュリティ',
	'脆弱性',
	'認証',
	'認可',
	// General tech terms (English)
	'programming',
	'engineering',
	'development',
	'implementation',
	'architecture',
	'backend',
	'frontend',
	'fullstack',
	'database',
	'algorithm',
	'deploy',
	'refactoring',
	'testing',
	'code review',
	'pull request',
	'microservices',
	'serverless',
	'container',
	'machine learning',
	'deep learning',
	'nlp',
	'compiler',
	'performance',
	'security',
	'authentication',
	'authorization',
]

// Low confidence keywords (weight: 0.05 each)
const LOW_WEIGHT_KEYWORDS = [
	'api',
	'sdk',
	'cli',
	'gui',
	'ui',
	'ux',
	'データ',
	'data',
	'ツール',
	'tool',
	'自動化',
	'automation',
	'効率化',
	'最適化',
	'optimization',
	'バグ',
	'bug',
	'エラー',
	'error',
	'デバッグ',
	'debug',
	'ログ',
	'log',
	'設定',
	'config',
	'環境',
	'environment',
]

/**
 * Calculate tech score for a post based on title and summary
 * @returns Score between 0.0 and 1.0
 */
export function calculateTechScore(title: string, summary?: string): number {
	const text = `${title} ${summary || ''}`.toLowerCase()

	let score = 0

	// High weight keywords (max contribution: 0.9)
	let highMatches = 0
	for (const keyword of HIGH_WEIGHT_KEYWORDS) {
		if (text.includes(keyword.toLowerCase())) {
			highMatches++
			if (highMatches >= 3) break
		}
	}
	score += highMatches * 0.3

	// Medium weight keywords (max contribution: 0.6)
	let mediumMatches = 0
	for (const keyword of MEDIUM_WEIGHT_KEYWORDS) {
		if (text.includes(keyword.toLowerCase())) {
			mediumMatches++
			if (mediumMatches >= 4) break
		}
	}
	score += mediumMatches * 0.15

	// Low weight keywords (max contribution: 0.25)
	let lowMatches = 0
	for (const keyword of LOW_WEIGHT_KEYWORDS) {
		if (text.includes(keyword.toLowerCase())) {
			lowMatches++
			if (lowMatches >= 5) break
		}
	}
	score += lowMatches * 0.05

	// Cap at 1.0
	return Math.min(score, 1.0)
}

/**
 * Check if a post is considered a tech post
 * @param threshold Minimum score to be considered tech (default: 0.3)
 */
export function isTechPost(title: string, summary?: string, threshold = 0.3): boolean {
	return calculateTechScore(title, summary) >= threshold
}

// ============================================================
// Embedding-based tech score (BGE-M3 via Cloudflare Workers AI)
// ============================================================

/**
 * Representative tech article phrases for comparison
 * These are used as "anchors" to determine if content is tech-related
 */
const TECH_ANCHOR_PHRASES = [
	// Programming & Development
	'React TypeScript フロントエンド開発 コンポーネント実装',
	'Python 機械学習 データ分析 モデル構築',
	'Go言語 バックエンド API設計 マイクロサービス',
	'Rust システムプログラミング メモリ安全 パフォーマンス',
	// Infrastructure & DevOps
	'AWS インフラ構築 Terraform IaC デプロイ自動化',
	'Docker Kubernetes コンテナ オーケストレーション',
	'CI/CD パイプライン GitHub Actions 自動テスト',
	// Database & Architecture
	'データベース設計 SQL PostgreSQL インデックス最適化',
	'システムアーキテクチャ 設計パターン スケーラビリティ',
	// AI & ML
	'LLM プロンプトエンジニアリング RAG ベクトル検索',
	'ディープラーニング ニューラルネットワーク PyTorch',
]

/**
 * Non-tech phrases for negative comparison
 */
const NON_TECH_ANCHOR_PHRASES = [
	'転職 キャリア 年収 面接対策 就職活動',
	'日記 振り返り 感想 ポエム 雑記',
	'勉強会 イベントレポート 参加してきた 登壇',
	'書評 読書感想 おすすめ本 レビュー',
]

// Cache for anchor embeddings (computed once per worker instance)
let techAnchorEmbeddings: number[][] | null = null
let nonTechAnchorEmbeddings: number[][] | null = null

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
	let dotProduct = 0
	let normA = 0
	let normB = 0
	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Get embeddings for anchor phrases (cached)
 */
async function getAnchorEmbeddings(ai: Ai): Promise<{ tech: number[][]; nonTech: number[][] }> {
	if (techAnchorEmbeddings && nonTechAnchorEmbeddings) {
		return { tech: techAnchorEmbeddings, nonTech: nonTechAnchorEmbeddings }
	}

	const [techResult, nonTechResult] = await Promise.all([
		ai.run('@cf/baai/bge-m3', { text: TECH_ANCHOR_PHRASES }),
		ai.run('@cf/baai/bge-m3', { text: NON_TECH_ANCHOR_PHRASES }),
	])

	techAnchorEmbeddings = techResult.data
	nonTechAnchorEmbeddings = nonTechResult.data

	return { tech: techAnchorEmbeddings, nonTech: nonTechAnchorEmbeddings }
}

/**
 * Calculate tech score using BGE-M3 embeddings
 * Compares input text against tech and non-tech anchor phrases
 * Falls back to keyword-based scoring if AI is unavailable
 *
 * @returns Score between 0.0 and 1.0
 */
export async function calculateTechScoreWithEmbedding(
	ai: Ai | undefined,
	title: string,
	summary?: string,
): Promise<number> {
	// Fallback to keyword-based if AI is not available
	if (!ai) {
		return calculateTechScore(title, summary)
	}

	const text = `${title} ${summary || ''}`

	try {
		// Get embeddings
		const [inputResult, anchors] = await Promise.all([
			ai.run('@cf/baai/bge-m3', { text: [text] }),
			getAnchorEmbeddings(ai),
		])

		const inputEmbedding = inputResult.data[0]

		// Calculate max similarity to tech anchors
		let maxTechSim = 0
		for (const anchor of anchors.tech) {
			const sim = cosineSimilarity(inputEmbedding, anchor)
			maxTechSim = Math.max(maxTechSim, sim)
		}

		// Calculate max similarity to non-tech anchors
		let maxNonTechSim = 0
		for (const anchor of anchors.nonTech) {
			const sim = cosineSimilarity(inputEmbedding, anchor)
			maxNonTechSim = Math.max(maxNonTechSim, sim)
		}

		// Score = tech similarity - non-tech penalty, normalized to 0-1
		// If more similar to tech anchors, score is higher
		const rawScore = maxTechSim - maxNonTechSim * 0.5
		const normalizedScore = Math.max(0, Math.min(1, (rawScore + 0.3) / 0.8))

		return normalizedScore
	} catch (error) {
		console.error('[TechScore] Embedding error, falling back to keyword:', error)
		// Fallback to keyword-based scoring
		return calculateTechScore(title, summary)
	}
}
