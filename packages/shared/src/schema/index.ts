import * as v from 'valibot'

// Blog registration schema
export const createBlogSchema = v.object({
	feedUrl: v.pipe(v.string(), v.url(), v.maxLength(2048)),
	title: v.optional(v.pipe(v.string(), v.maxLength(255))),
	description: v.optional(v.pipe(v.string(), v.maxLength(1000))),
	siteUrl: v.optional(v.pipe(v.string(), v.url(), v.maxLength(2048))),
})

export type CreateBlogInput = v.InferInput<typeof createBlogSchema>

// Pagination schema (offset-based)
export const paginationSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)), 20),
})

export type PaginationInput = v.InferInput<typeof paginationSchema>

// Cursor-based pagination schema (for query string - values come as strings)
export const cursorPaginationQuerySchema = v.object({
	cursor: v.optional(v.string()),
	limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
})

export type CursorPaginationQueryInput = v.InferInput<typeof cursorPaginationQuerySchema>

// Search schema
export const searchSchema = v.object({
	q: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
	...paginationSchema.entries,
})

export type SearchInput = v.InferInput<typeof searchSchema>
