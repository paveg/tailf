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
	'deno',
	'bun',
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
	'remix',
	'solid.js',
	'qwik',
	'htmx',
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
	'pulumi',
	'ansible',
	// Databases & Search
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
	'meilisearch',
	'algolia',
	'typesense',
	'fts',
	'全文検索',
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
	'turborepo',
	'nx',
	'biome',
	'trpc',
	'zod',
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
	'huggingface',
	'ollama',
	'stable diffusion',
	// RSS & Web Crawling
	'rss',
	'atom',
	'feed',
	'クローラー',
	'crawler',
	'scraping',
	'スクレイピング',
	// Static Site & Jamstack
	'ssg',
	'jamstack',
	'hugo',
	'gatsby',
	'eleventy',
	'11ty',
	'静的サイトジェネレーター',
	'静的サイト生成',
	// WebAssembly & Edge
	'webassembly',
	'wasm',
	'edge computing',
	'edge functions',
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
	// Security
	'oauth',
	'jwt',
	'oidc',
	'websocket',
	'webrtc',
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
	// Search & Data (Japanese)
	'検索エンジン',
	'インデックス',
	'クエリ',
	'フィード',
	'アグリゲーター',
	'パーサー',
	'正規表現',
	'構文解析',
	// Web Development (Japanese)
	'静的サイト',
	'動的サイト',
	'レンダリング',
	'ハイドレーション',
	'ルーティング',
	'ミドルウェア',
	'キャッシュ',
	'cdn',
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
	'エンベディング',
	// Git & Version Control (Japanese)
	'ブランチ',
	'マージ',
	'コンフリクト',
	'リベース',
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
	// Search & Web (English)
	'search engine',
	'indexing',
	'parsing',
	'regex',
	'ast',
	'hydration',
	'ssr',
	'csr',
	'isr',
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
	// Version Control (English)
	'git',
	'branch',
	'merge',
	'rebase',
	'monorepo',
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
	// Additional tech context
	'仕組み',
	'システム',
	'system',
	'サーバー',
	'server',
	'クライアント',
	'client',
	'リクエスト',
	'request',
	'レスポンス',
	'response',
	'ライブラリ',
	'library',
	'フレームワーク',
	'framework',
	'パッケージ',
	'package',
	'モジュール',
	'module',
	'関数',
	'function',
	'変数',
	'variable',
	'型',
	'type',
	'スキーマ',
	'schema',
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
// Hybrid tech score (Keyword + Embedding via Cloudflare Workers AI)
// ============================================================

// Weights for hybrid scoring (must sum to 1.0)
const KEYWORD_WEIGHT = 0.4
const EMBEDDING_WEIGHT = 0.6

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
	// Search & Data Processing
	'全文検索 FTS インデックス 検索エンジン クエリ最適化',
	'RSS Atom フィード クローラー アグリゲーター パーサー',
	'正規表現 構文解析 パーサー AST コンパイラ',
	// Web & Static Sites
	'ブログシステム 静的サイト生成 SSG Markdown Jamstack',
	'Webアプリ開発 SPA SSR ハイドレーション レンダリング',
	'WebAssembly WASM エッジコンピューティング CDN キャッシュ',
	// Developer Tools & Workflow
	'開発環境構築 エディタ設定 Vim Neovim 開発効率化',
	'Git バージョン管理 ブランチ戦略 モノレポ CI',
	'リファクタリング コード品質 静的解析 リンター フォーマッター',
	// Security & Auth
	'認証認可 OAuth JWT セッション管理 セキュリティ対策',
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
 * Calculate embedding-only score from a single embedding
 */
function calculateEmbeddingScore(
	inputEmbedding: number[],
	techAnchors: number[][],
	nonTechAnchors: number[][],
): number {
	const maxTechSim = Math.max(
		...techAnchors.map((anchor) => cosineSimilarity(inputEmbedding, anchor)),
	)
	const maxNonTechSim = Math.max(
		...nonTechAnchors.map((anchor) => cosineSimilarity(inputEmbedding, anchor)),
	)

	// Score = tech similarity - non-tech penalty, normalized to 0-1
	const rawScore = maxTechSim - maxNonTechSim * 0.5
	return Math.max(0, Math.min(1, (rawScore + 0.3) / 0.8))
}

/**
 * Calculate hybrid tech score using both keywords and BGE-M3 embeddings
 * Combines keyword-based scoring (40%) with embedding-based scoring (60%)
 * Falls back to keyword-based scoring if AI is unavailable
 *
 * @returns Score between 0.0 and 1.0
 */
export async function calculateTechScoreWithEmbedding(
	ai: Ai | undefined,
	title: string,
	summary?: string,
): Promise<number> {
	const keywordScore = calculateTechScore(title, summary)

	// Fallback to keyword-based if AI is not available
	if (!ai) {
		return keywordScore
	}

	const rawText = `${title} ${summary || ''}`
	const text = decodeHtmlEntities(rawText)

	try {
		// Get embeddings
		const [inputResult, anchors] = await Promise.all([
			ai.run('@cf/baai/bge-m3', { text: [text] }),
			getAnchorEmbeddings(ai),
		])

		const embeddingScore = calculateEmbeddingScore(
			inputResult.data[0],
			anchors.tech,
			anchors.nonTech,
		)

		// Hybrid score: combine keyword and embedding scores
		const hybridScore = keywordScore * KEYWORD_WEIGHT + embeddingScore * EMBEDDING_WEIGHT

		return Math.min(hybridScore, 1.0)
	} catch (error) {
		console.error('[TechScore] Embedding error, falling back to keyword:', error)
		// Fallback to keyword-based scoring
		return keywordScore
	}
}

/**
 * Batch calculate hybrid tech scores using keywords and BGE-M3 embeddings
 * Processes multiple posts in a single API call to avoid subrequest limits
 * Combines keyword-based scoring (40%) with embedding-based scoring (60%)
 *
 * @param ai - Cloudflare Workers AI binding
 * @param posts - Array of posts with title and optional summary
 * @returns Array of scores (0.0-1.0), same order as input
 */
export async function calculateTechScoresBatch(
	ai: Ai | undefined,
	posts: Array<{ title: string; summary?: string }>,
): Promise<number[]> {
	// If no posts, return empty
	if (posts.length === 0) return []

	// Calculate keyword scores for all posts
	const keywordScores = posts.map((p) => calculateTechScore(p.title, p.summary))

	// If no AI, return keyword-only scores
	if (!ai) {
		return keywordScores
	}

	// Prepare texts for embedding
	const texts = posts.map((p) => {
		const rawText = `${p.title} ${p.summary || ''}`
		return decodeHtmlEntities(rawText)
	})

	try {
		// Get embeddings for all texts in one API call
		const [inputResult, anchors] = await Promise.all([
			ai.run('@cf/baai/bge-m3', { text: texts }),
			getAnchorEmbeddings(ai),
		])

		// Calculate hybrid scores for each post
		return inputResult.data.map((inputEmbedding: number[], index: number) => {
			const embeddingScore = calculateEmbeddingScore(inputEmbedding, anchors.tech, anchors.nonTech)
			const keywordScore = keywordScores[index]

			// Hybrid score: combine keyword and embedding scores
			const hybridScore = keywordScore * KEYWORD_WEIGHT + embeddingScore * EMBEDDING_WEIGHT
			return Math.min(hybridScore, 1.0)
		})
	} catch (error) {
		console.error('[TechScore] Batch embedding error, falling back to keyword:', error)
		// Fallback to keyword-based scoring for all posts
		return keywordScores
	}
}
