// User
export interface User {
	id: string
	githubId: string
	name: string
	avatarUrl: string | null
	createdAt: Date
	updatedAt: Date
}

// Feed types
export const FEED_TYPES = ['blog', 'slide'] as const
export type FeedType = (typeof FEED_TYPES)[number]

// Topic types
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

// Topic metadata for UI display
export const TOPICS: ReadonlyArray<{ id: TopicId; name: string }> = [
	{ id: 'ai', name: 'AI' },
	{ id: 'backend', name: 'バックエンド' },
	{ id: 'cloud', name: 'クラウド' },
	{ id: 'data', name: 'データ' },
	{ id: 'devops', name: 'DevOps' },
	{ id: 'frontend', name: 'フロントエンド' },
	{ id: 'mobile', name: 'モバイル' },
	{ id: 'oss', name: 'OSS' },
	{ id: 'security', name: 'セキュリティ' },
	{ id: 'web3', name: 'Web3' },
]

// Feed (RSS/Atom feed source: blog, slide, etc.)
export interface Feed {
	id: string
	title: string
	description: string | null
	feedUrl: string
	siteUrl: string
	type: FeedType
	isOfficial: boolean
	bookmarkCount: number
	authorId: string | null
	createdAt: Date
	updatedAt: Date
}

// Feed with author (for API responses with relations)
export interface FeedWithAuthor extends Feed {
	author: User | null
}

// Post
export interface Post {
	id: string
	title: string
	summary: string | null
	url: string
	thumbnailUrl: string | null
	publishedAt: Date
	feedId: string
	techScore: number | null
	hatenaBookmarkCount: number | null
	// Topic assignment (populated from mainTopic/subTopic columns)
	topics: string[]
	createdAt: Date
}

// Post with feed info (for API responses)
export interface PostWithFeed extends Post {
	feed: {
		title: string
		siteUrl: string
	}
}

// Follow
export interface Follow {
	userId: string
	feedId: string
	createdAt: Date
}

// API Response types
export interface ApiResponse<T> {
	data: T
	meta?: {
		total?: number
		page?: number
		perPage?: number
	}
}

export interface ApiError {
	error: string
	message: string
}
