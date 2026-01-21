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
	'zig',
	'ocaml',
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
	'flutter',
	'swiftui',
	'jetpack compose',
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
	'eks',
	'ecs',
	'fargate',
	'lambda',
	'karpenter',
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
	'alloydb',
	'spanner',
	'opensearch',
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
	// AI/ML Tools
	'openai',
	'claude',
	'llm',
	'gpt',
	'gemini',
	'cursor',
	'copilot',
	'mcp',
	'langchain',
	'llamaindex',
	// 3D/Game/VR
	'unity',
	'unreal',
	'gltf',
	'vrm',
	'webgl',
	'three.js',
	// SRE & Platform
	'sre',
	'platform engineering',
	'istio',
	'envoy',
	'prometheus',
	'grafana',
	'datadog',
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
	// SRE/Platform (Japanese)
	'インシデント',
	'オンコール',
	'可観測性',
	'監視',
	'運用',
	'信頼性',
	'障害対応',
	'ポストモーテム',
	// AI/ML (Japanese)
	'生成ai',
	'プロンプト',
	'ファインチューニング',
	'ベクトル検索',
	'埋め込み',
	'rag',
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
	// SRE/Platform (English)
	'incident',
	'on-call',
	'observability',
	'monitoring',
	'reliability',
	'postmortem',
	'toil',
	'slo',
	'sli',
	'error budget',
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
	// Tech context indicators
	'インターン',
	'intern',
	'チーム',
	'team',
	'移行',
	'migration',
	'リリース',
	'release',
	'本番',
	'production',
	'ステージング',
	'staging',
]

/**
 * Decode HTML entities in text
 * Handles common entities found in RSS feed summaries
 */
function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&hellip;/g, '...')
		.replace(/&nbsp;/g, ' ')
		.replace(/<[^>]*>/g, ' ') // Strip HTML tags
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

/**
 * Count keyword matches in text, up to maxMatches limit
 */
function countMatches(text: string, keywords: readonly string[], maxMatches: number): number {
	let matches = 0
	for (const keyword of keywords) {
		if (text.includes(keyword.toLowerCase()) && ++matches >= maxMatches) break
	}
	return matches
}

/**
 * Calculate tech score for a post based on title and summary
 * @returns Score between 0.0 and 1.0
 */
export function calculateTechScore(title: string, summary?: string): number {
	const rawText = `${title} ${summary ?? ''}`
	const text = decodeHtmlEntities(rawText).toLowerCase()

	const score =
		countMatches(text, HIGH_WEIGHT_KEYWORDS, 3) * 0.3 +
		countMatches(text, MEDIUM_WEIGHT_KEYWORDS, 4) * 0.15 +
		countMatches(text, LOW_WEIGHT_KEYWORDS, 5) * 0.05

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
 * Note: Conference/event reports are NOT included here because
 * tech conference reports (SRE NEXT, KubeCon, etc.) should be treated as tech articles
 */
const NON_TECH_ANCHOR_PHRASES = [
	'転職 キャリア 年収 面接対策 就職活動',
	'日記 振り返り 感想 ポエム 雑記',
	'書評 読書感想 おすすめ本 レビュー',
	// Gadget & Review
	'ガジェット レビュー 買ってよかった デスクツアー 機材紹介',
	'キーボード マウス モニター イヤホン ヘッドホン',
	'旅行記 観光 グルメ 食べ歩き',
	// Non-tech business content
	'採用 求人 募集 面接 会社紹介 オフィス紹介',
	'営業 マーケティング 広報 PR プレスリリース',
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

	const rawText = `${title} ${summary || ''}`
	const text = decodeHtmlEntities(rawText)

	try {
		// Get embeddings
		const [inputResult, anchors] = await Promise.all([
			ai.run('@cf/baai/bge-m3', { text: [text] }),
			getAnchorEmbeddings(ai),
		])

		const inputEmbedding = inputResult.data[0]

		// Calculate max similarity to anchor phrases
		const maxSimilarity = (anchorList: number[][]) =>
			Math.max(...anchorList.map((anchor) => cosineSimilarity(inputEmbedding, anchor)))

		const maxTechSim = maxSimilarity(anchors.tech)
		const maxNonTechSim = maxSimilarity(anchors.nonTech)

		// Score = tech similarity - non-tech penalty, normalized to 0-1
		const rawScore = maxTechSim - maxNonTechSim * 0.5
		const normalizedScore = Math.max(0, Math.min(1, (rawScore + 0.3) / 0.8))

		return normalizedScore
	} catch (error) {
		console.error('[TechScore] Embedding error, falling back to keyword:', error)
		// Fallback to keyword-based scoring
		return calculateTechScore(title, summary)
	}
}
