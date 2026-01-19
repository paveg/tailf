// User
export interface User {
	id: string
	githubId: string
	name: string
	avatarUrl: string | null
	createdAt: Date
	updatedAt: Date
}

// Blog
export interface Blog {
	id: string
	title: string
	description: string | null
	feedUrl: string
	siteUrl: string
	authorId: string | null
	createdAt: Date
	updatedAt: Date
}

// Post
export interface Post {
	id: string
	title: string
	summary: string | null
	url: string
	thumbnailUrl: string | null
	publishedAt: Date
	blogId: string
	createdAt: Date
}

// Post with blog info (for API responses)
export interface PostWithBlog extends Post {
	blog: {
		title: string
		siteUrl: string
	}
}

// Follow
export interface Follow {
	userId: string
	blogId: string
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
