import { useEffect, useState } from 'react'
import { useInfinitePosts, useInfiniteSearchPosts } from '@/lib/hooks'
import { useDebounce } from '@/lib/useDebounce'
import { useIntersectionObserver } from '@/lib/useIntersectionObserver'
import { PostCard } from './PostCard'
import { QueryProvider } from './QueryProvider'
import { SearchInput } from './SearchInput'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

function PostListContent() {
	const [searchQuery, setSearchQuery] = useState('')
	const debouncedQuery = useDebounce(searchQuery, 300)

	const isSearching = debouncedQuery.length >= 2

	const postsQuery = useInfinitePosts(12)
	const searchQueryResult = useInfiniteSearchPosts(debouncedQuery, 12)

	const activeQuery = isSearching ? searchQueryResult : postsQuery

	const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
		rootMargin: '200px',
	})

	// Trigger fetch when sentinel is visible
	useEffect(() => {
		if (isIntersecting && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
			activeQuery.fetchNextPage()
		}
	}, [
		isIntersecting,
		activeQuery.hasNextPage,
		activeQuery.isFetchingNextPage,
		activeQuery.fetchNextPage,
	])

	const allPosts = activeQuery.data?.pages.flatMap((page) => page.data) ?? []
	const isInitialLoading = activeQuery.isLoading
	const isLoadingMore = activeQuery.isFetchingNextPage
	const showSearchLoading = isSearching && searchQueryResult.isLoading

	return (
		<div className="space-y-6">
			{/* Search Input */}
			<SearchInput value={searchQuery} onChange={setSearchQuery} isLoading={showSearchLoading} />

			{/* Initial Loading */}
			{isInitialLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<PostCardSkeleton key={i} />
					))}
				</div>
			)}

			{/* Error State */}
			{activeQuery.error && (
				<div className="py-8 text-center text-muted-foreground">
					記事の取得に失敗しました
					<Button variant="link" onClick={() => activeQuery.refetch()} className="ml-2">
						再試行
					</Button>
				</div>
			)}

			{/* Empty State */}
			{!isInitialLoading && !activeQuery.error && allPosts.length === 0 && (
				<div className="py-8 text-center text-muted-foreground">
					{isSearching ? '検索結果がありません' : 'まだ記事がありません'}
				</div>
			)}

			{/* Posts Grid */}
			{allPosts.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{allPosts.map((post) => (
						<PostCard key={post.id} post={post} />
					))}
				</div>
			)}

			{/* Loading More Skeleton */}
			{isLoadingMore && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<PostCardSkeleton key={`loading-${i}`} />
					))}
				</div>
			)}

			{/* Intersection Observer Sentinel */}
			<div ref={ref} className="h-1" />

			{/* End of list indicator */}
			{!activeQuery.hasNextPage && allPosts.length > 0 && !isInitialLoading && (
				<p className="text-center text-sm text-muted-foreground">すべての記事を表示しました</p>
			)}
		</div>
	)
}

function PostCardSkeleton() {
	return (
		<div className="rounded-lg border p-4">
			<div className="mb-2 flex items-center gap-2">
				<Skeleton className="size-6 rounded-full" />
				<Skeleton className="h-4 w-20" />
			</div>
			<Skeleton className="mb-2 h-5 w-full" />
			<Skeleton className="h-5 w-3/4" />
		</div>
	)
}

export function PostList() {
	return (
		<QueryProvider>
			<PostListContent />
		</QueryProvider>
	)
}
