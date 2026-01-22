/**
 * Topic assignment for posts
 * Keyword-based topic detection (max 2 topics per post)
 */

// 10 fixed topics
export const TOPIC_IDS = [
	'ai',
	'backend',
	'cloud',
	'data',
	'devops',
	'frontend',
	'mobile',
	'oss',
	'security',
	'web3',
] as const

export type TopicId = (typeof TOPIC_IDS)[number]

// Topic metadata for UI
export const TOPIC_METADATA: Record<TopicId, { name: string }> = {
	ai: { name: 'AI' },
	backend: { name: 'バックエンド' },
	cloud: { name: 'クラウド' },
	data: { name: 'データ' },
	devops: { name: 'DevOps' },
	frontend: { name: 'フロントエンド' },
	mobile: { name: 'モバイル' },
	oss: { name: 'OSS' },
	security: { name: 'セキュリティ' },
	web3: { name: 'Web3' },
}

// Keywords for each topic (case-insensitive matching)
const TOPIC_KEYWORDS: Record<TopicId, string[]> = {
	ai: [
		// AI/ML Tools & Frameworks
		'openai',
		'claude',
		'anthropic',
		'llm',
		'gpt',
		'gpt-4',
		'gpt-3',
		'gemini',
		'copilot',
		'cursor',
		'mcp',
		'langchain',
		'llamaindex',
		'huggingface',
		'transformers',
		'pytorch',
		'tensorflow',
		'keras',
		'scikit-learn',
		'onnx',
		// AI Concepts
		'machine learning',
		'deep learning',
		'neural network',
		'embedding',
		'vector search',
		'rag',
		'fine-tuning',
		'prompt engineering',
		'chatbot',
		'nlp',
		'natural language',
		'computer vision',
		'image recognition',
		// Japanese
		'機械学習',
		'ディープラーニング',
		'深層学習',
		'生成ai',
		'プロンプト',
		'ファインチューニング',
		'ベクトル検索',
		// Note: removed '埋め込み' - too generic (matches DIY content like "鬼目ナット埋め込み")
		'埋め込み表現',
		'ベクトル埋め込み',
		'自然言語処理',
		'画像認識',
		'ニューラルネットワーク',
	],
	backend: [
		// Languages & Frameworks
		'node.js',
		'nodejs',
		'express',
		'hono',
		'fastify',
		'nestjs',
		'fastapi',
		'django',
		'flask',
		'rails',
		'ruby on rails',
		'spring',
		'spring boot',
		'laravel',
		'go言語',
		'golang',
		'rust',
		'python',
		'java',
		'scala',
		'elixir',
		'phoenix',
		// Concepts
		'api',
		'rest api',
		'restful',
		'graphql',
		'grpc',
		'websocket',
		'microservices',
		'monolith',
		'server',
		'backend',
		'middleware',
		'routing',
		'orm',
		'activerecord',
		// Japanese
		'バックエンド',
		'サーバー',
		'サーバーサイド',
		'マイクロサービス',
		'api設計',
	],
	cloud: [
		// Cloud Providers
		'aws',
		'amazon web services',
		'gcp',
		'google cloud',
		'azure',
		'cloudflare',
		'vercel',
		'netlify',
		'heroku',
		'fly.io',
		'render',
		'railway',
		// AWS Services
		'ec2',
		'ecs',
		'eks',
		'fargate',
		'lambda',
		's3',
		'rds',
		'dynamodb',
		'cloudfront',
		'route53',
		'vpc',
		'iam',
		'sqs',
		'sns',
		'karpenter',
		// GCP Services
		'cloud run',
		'cloud functions',
		'bigquery',
		'gke',
		'cloud storage',
		'alloydb',
		'spanner',
		// Container & Orchestration
		'kubernetes',
		'k8s',
		'docker',
		'container',
		'helm',
		'istio',
		'envoy',
		// IaC
		'terraform',
		'pulumi',
		'cloudformation',
		'cdk',
		'ansible',
		// Japanese
		'クラウド',
		'インフラ',
		'コンテナ',
		'オーケストレーション',
		'サーバーレス',
		'serverless',
	],
	data: [
		// Data Warehouses & Databases
		'bigquery',
		'snowflake',
		'redshift',
		'databricks',
		'clickhouse',
		'duckdb',
		'apache spark',
		'spark',
		'hadoop',
		'hive',
		'presto',
		'trino',
		// ETL & Pipelines
		'etl',
		'elt',
		'data pipeline',
		'airflow',
		'dagster',
		'prefect',
		'dbt',
		'fivetran',
		'airbyte',
		// Analytics & Visualization
		'analytics',
		'tableau',
		'looker',
		'metabase',
		'superset',
		'data studio',
		'power bi',
		'redash',
		// Data Engineering
		'data engineering',
		'data warehouse',
		'data lake',
		'data mesh',
		'data modeling',
		'dimensional modeling',
		'star schema',
		// Japanese
		'データ',
		'データ分析',
		'データエンジニアリング',
		'データ基盤',
		'データパイプライン',
		'データウェアハウス',
		'可視化',
		'ビジュアライゼーション',
	],
	devops: [
		// CI/CD
		'ci/cd',
		'cicd',
		'github actions',
		'gitlab ci',
		'jenkins',
		'circleci',
		'travis ci',
		'argo cd',
		'argocd',
		'flux',
		'tekton',
		// Monitoring & Observability
		'prometheus',
		'grafana',
		'datadog',
		'newrelic',
		'new relic',
		'splunk',
		'elastic',
		'kibana',
		'jaeger',
		'zipkin',
		'opentelemetry',
		'otel',
		// SRE
		'sre',
		'site reliability',
		'incident',
		'on-call',
		'postmortem',
		'blameless',
		'slo',
		'sli',
		'error budget',
		'toil',
		'chaos engineering',
		// DevOps Concepts
		'devops',
		'gitops',
		'infrastructure as code',
		'iac',
		'deployment',
		'rollout',
		'canary',
		'blue-green',
		'feature flag',
		// Japanese
		'デプロイ',
		'監視',
		'可観測性',
		'オブザーバビリティ',
		'インシデント',
		'オンコール',
		'障害対応',
		'ポストモーテム',
		'自動化',
		'運用',
		// Dev Environment & Tools
		'dotfiles',
		'devbox',
		'chezmoi',
		'nix',
		'homebrew',
		'brew',
		'zsh',
		'bash',
		'fish',
		'shell',
		'terminal',
		'iterm',
		'wezterm',
		'ghostty',
		'alacritty',
		'tmux',
		'vim',
		'neovim',
		'nvim',
		'emacs',
		// Japanese Dev Environment
		'開発環境',
		'ターミナル',
		'シェル',
		'エディタ',
	],
	frontend: [
		// Frameworks & Libraries
		'react',
		'reactjs',
		'vue',
		'vuejs',
		'angular',
		'svelte',
		'solid',
		'solidjs',
		'astro',
		'next.js',
		'nextjs',
		'nuxt',
		'nuxtjs',
		'remix',
		'gatsby',
		'qwik',
		// Languages & Tools
		'javascript',
		'typescript',
		'html',
		'css',
		'sass',
		'scss',
		'less',
		'tailwind',
		'tailwindcss',
		'styled-components',
		'emotion',
		'css-in-js',
		'css modules',
		// Build Tools
		'webpack',
		'vite',
		'esbuild',
		'rollup',
		'parcel',
		'turbopack',
		'swc',
		'babel',
		// State Management
		'redux',
		'zustand',
		'jotai',
		'recoil',
		'mobx',
		'pinia',
		'vuex',
		// UI
		'ui',
		'ux',
		'component',
		'storybook',
		'chromatic',
		'figma',
		'design system',
		'accessibility',
		'a11y',
		'responsive',
		'animation',
		'framer motion',
		// Japanese
		'フロントエンド',
		'コンポーネント',
		'デザインシステム',
		'アクセシビリティ',
		'レスポンシブ',
		'アニメーション',
	],
	mobile: [
		// Platforms
		'ios',
		'iphone',
		'ipad',
		'android',
		'mobile',
		// Note: removed 'アプリ' and 'app' - too generic (web apps, desktop apps exist)
		// iOS
		'swift',
		'swiftui',
		'uikit',
		'xcode',
		'cocoapods',
		'spm',
		'swift package',
		'combine',
		'core data',
		'app store',
		// Android
		'kotlin',
		'jetpack',
		'jetpack compose',
		'android studio',
		'gradle',
		'room',
		'hilt',
		'dagger',
		'google play',
		// Cross-platform
		'flutter',
		'dart',
		'react native',
		'expo',
		'capacitor',
		'ionic',
		'xamarin',
		'.net maui',
		'kotlin multiplatform',
		'kmp',
		// Japanese
		'モバイル開発',
		'モバイルアプリ',
		'ネイティブアプリ',
		// Note: removed 'スマホ', 'スマートフォン' - too generic (matches gadget reviews)
	],
	oss: [
		// Platforms & Community
		'oss',
		'open source',
		'opensource',
		'github',
		'gitlab',
		'bitbucket',
		'contribution',
		'contributor',
		'maintainer',
		'pull request',
		// Note: removed 'pr' - too short, causes false positives (e.g., "PREDUCTS")
		// Note: removed 'issue', 'fork', 'star' - too generic
		// Community
		'community',
		'hacktoberfest',
		'gsoc',
		'outreachy',
		// Licensing
		'mit license',
		'apache license',
		'gpl',
		'bsd',
		'license',
		// Japanese
		'オープンソース',
		'コントリビュート',
		'コントリビューション',
		'メンテナー',
		'コミュニティ',
		'プルリクエスト',
	],
	security: [
		// Authentication & Authorization
		'authentication',
		'authorization',
		'oauth',
		'oauth2',
		'oidc',
		'openid',
		'jwt',
		'saml',
		'sso',
		'single sign-on',
		'mfa',
		'2fa',
		'passkey',
		'webauthn',
		'fido',
		// Security Concepts
		'security',
		'vulnerability',
		'cve',
		'penetration test',
		'pentest',
		'ctf',
		'xss',
		'csrf',
		'sql injection',
		'injection',
		'owasp',
		// Cryptography
		'encryption',
		'cryptography',
		'tls',
		'ssl',
		'https',
		'certificate',
		'hash',
		'bcrypt',
		'argon2',
		// Tools & Practices
		'firewall',
		'waf',
		'ids',
		'ips',
		'siem',
		'zero trust',
		'devsecops',
		'sast',
		'dast',
		'secrets management',
		'vault',
		// Japanese
		'セキュリティ',
		'脆弱性',
		'認証',
		'認可',
		'暗号化',
		'ペネトレーションテスト',
		'ゼロトラスト',
	],
	web3: [
		// Blockchain
		'blockchain',
		'web3',
		'ethereum',
		'solana',
		'polygon',
		'arbitrum',
		'optimism',
		'avalanche',
		'bitcoin',
		'btc',
		'eth',
		// Smart Contracts
		'smart contract',
		'solidity',
		'vyper',
		'hardhat',
		'foundry',
		'truffle',
		'remix',
		'evm',
		// DeFi & NFT
		'defi',
		'dex',
		'nft',
		'dao',
		'token',
		'erc-20',
		'erc-721',
		'erc-1155',
		'uniswap',
		'opensea',
		// Wallets & Infra
		'metamask',
		'wallet',
		'web3.js',
		'ethers.js',
		'viem',
		'wagmi',
		'ipfs',
		'the graph',
		'chainlink',
		'oracle',
		// Japanese
		'ブロックチェーン',
		'スマートコントラクト',
		'暗号資産',
		'仮想通貨',
		'分散型',
		'dapps',
	],
}

/**
 * Decode HTML entities in text
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
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

/**
 * Assign topics based on keyword matching
 * Returns [mainTopic, subTopic] where subTopic may be undefined
 *
 * @param title - Post title
 * @param summary - Post summary/description (optional)
 * @returns Tuple of [mainTopic, subTopic] (subTopic is undefined if only one match)
 */
export function assignTopics(
	title: string,
	summary?: string,
): { mainTopic: TopicId | null; subTopic: TopicId | null } {
	const rawText = `${title} ${summary ?? ''}`
	const text = decodeHtmlEntities(rawText).toLowerCase()

	// Count keyword matches per topic
	const scores: Array<{ topic: TopicId; score: number }> = []

	for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
		let matchCount = 0
		for (const keyword of keywords) {
			if (text.includes(keyword.toLowerCase())) {
				matchCount++
			}
		}
		if (matchCount > 0) {
			scores.push({ topic: topic as TopicId, score: matchCount })
		}
	}

	// Sort by score desc, return top 2
	scores.sort((a, b) => b.score - a.score)

	return {
		mainTopic: scores[0]?.topic ?? null,
		subTopic: scores[1]?.topic ?? null,
	}
}

/**
 * Convert topic columns to array for API response
 */
export function topicsToArray(
	mainTopic: string | null | undefined,
	subTopic: string | null | undefined,
): string[] {
	return [mainTopic, subTopic].filter((t): t is string => !!t)
}

/**
 * Check if topic is valid
 */
export function isValidTopic(topic: string): topic is TopicId {
	return TOPIC_IDS.includes(topic as TopicId)
}
