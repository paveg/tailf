/**
 * 記事一覧コンポーネント
 *
 * 現在の方式: 全件SSG + クライアント側ページネーション
 * - allPosts: ビルド時に取得した全記事
 * - visibleCount: 表示件数（スクロールで増加）
 * - 検索のみAPIコール
 *
 * 開発環境ではSSGデータがない場合、クライアントサイドでAPIを叩く
 *
 * 12件SSG + API方式に切り替える場合:
 * - allPosts → initialData (CursorResponse型) に変更
 * - useInfinitePosts(12, techOnly, initialData) を使用
 * - visibleCount/filteredPosts のロジックを削除
 */
import type { PostWithFeed } from '@tailf/shared'
import { Code2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInfinitePosts, useInfiniteSearchPosts } from '@/lib/hooks'
import { useDebounce } from '@/lib/useDebounce'
import { useIntersectionObserver } from '@/lib/useIntersectionObserver'
import { PostCard } from './PostCard'
import { QueryProvider } from './QueryProvider'
import { SearchInput } from './SearchInput'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Skeleton } from './ui/skeleton'
import { Switch } from './ui/switch'

const POSTS_PER_PAGE = 12

interface PostListContentProps {
	allPosts: PostWithFeed[]
}

function PostListContent({ allPosts }: PostListContentProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [techOnly, setTechOnly] = useState(false)
	const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE)
	const debouncedQuery = useDebounce(searchQuery, 300)

	const isSearching = debouncedQuery.length >= 2

	// SSGデータがない場合（開発環境）はAPIから取得
	const useClientFetch = allPosts.length === 0
	const apiQuery = useInfinitePosts(12, techOnly)

	// Search uses API (can't pre-build search results)
	const searchQueryResult = useInfiniteSearchPosts(debouncedQuery, 12, techOnly)

	// APIから取得した記事（開発環境用）
	const apiPosts = useMemo(() => {
		return apiQuery.data?.pages.flatMap((page) => page.data) ?? []
	}, [apiQuery.data])

	// 使用する記事データ（SSG or API）
	const sourcePosts = useClientFetch ? apiPosts : allPosts

	// Filter posts client-side
	const filteredPosts = useMemo(() => {
		if (techOnly && !useClientFetch) {
			// SSGの場合はクライアントでフィルタ
			return sourcePosts.filter((post) => (post.techScore ?? 0) >= 0.3)
		}
		return sourcePosts
	}, [sourcePosts, techOnly, useClientFetch])

	// Visible posts (client-side pagination for SSG)
	const visiblePosts = useMemo(() => {
		if (useClientFetch) {
			return filteredPosts // APIの場合は既にページネーション済み
		}
		return filteredPosts.slice(0, visibleCount)
	}, [filteredPosts, visibleCount, useClientFetch])

	const hasMore = useClientFetch
		? (apiQuery.hasNextPage ?? false)
		: visibleCount < filteredPosts.length

	const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
		rootMargin: '200px',
	})

	// Load more when sentinel is visible
	useEffect(() => {
		if (isSearching) return
		if (!isIntersecting || !hasMore) return

		if (useClientFetch) {
			// API経由の場合
			if (!apiQuery.isFetchingNextPage) {
				apiQuery.fetchNextPage()
			}
		} else {
			// SSGの場合
			setVisibleCount((prev) => prev + POSTS_PER_PAGE)
		}
	}, [isIntersecting, hasMore, isSearching, useClientFetch, apiQuery])

	// Load more for search results
	useEffect(() => {
		if (
			isSearching &&
			isIntersecting &&
			searchQueryResult.hasNextPage &&
			!searchQueryResult.isFetchingNextPage
		) {
			searchQueryResult.fetchNextPage()
		}
	}, [
		isSearching,
		isIntersecting,
		searchQueryResult.hasNextPage,
		searchQueryResult.isFetchingNextPage,
		searchQueryResult.fetchNextPage,
	])

	// Reset visible count when filter changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: techOnly is intentionally a trigger to reset pagination
	useEffect(() => {
		setVisibleCount(POSTS_PER_PAGE)
	}, [techOnly])

	// Determine which posts to show
	const displayPosts = isSearching
		? (searchQueryResult.data?.pages.flatMap((page) => page.data) ?? [])
		: visiblePosts

	const isInitialLoading = useClientFetch && apiQuery.isLoading
	const showSearchLoading = isSearching && searchQueryResult.isLoading
	const isLoadingMore = isSearching
		? searchQueryResult.isFetchingNextPage
		: useClientFetch && apiQuery.isFetchingNextPage
	const showEndMessage = isSearching
		? !searchQueryResult.hasNextPage && displayPosts.length > 0
		: !hasMore && displayPosts.length > 0

	return (
		<div className="space-y-6">
			{/* Search Input and Filter */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex-1">
					<SearchInput
						value={searchQuery}
						onChange={setSearchQuery}
						isLoading={showSearchLoading}
					/>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Switch id="tech-only" checked={techOnly} onCheckedChange={setTechOnly} />
					<Label htmlFor="tech-only" className="flex cursor-pointer items-center gap-1.5 text-sm">
						<Code2 className="size-4" />
						技術記事のみ
					</Label>
				</div>
			</div>

			{/* Initial Loading */}
			{(isInitialLoading || showSearchLoading) && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<PostCardSkeleton key={i} />
					))}
				</div>
			)}

			{/* Error State (search only) */}
			{isSearching && searchQueryResult.error && (
				<div className="py-8 text-center text-muted-foreground">
					検索に失敗しました
					<Button variant="link" onClick={() => searchQueryResult.refetch()} className="ml-2">
						再試行
					</Button>
				</div>
			)}

			{/* Empty State */}
			{!isInitialLoading && !showSearchLoading && displayPosts.length === 0 && (
				<div className="py-8 text-center text-muted-foreground">
					{isSearching ? '検索結果がありません' : 'まだ記事がありません'}
				</div>
			)}

			{/* Posts Grid */}
			{displayPosts.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{displayPosts.map((post) => (
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
			{showEndMessage && (
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

interface PostListProps {
	allPosts?: PostWithFeed[]
}

export function PostList({ allPosts = [] }: PostListProps) {
	return (
		<QueryProvider>
			<PostListContent allPosts={allPosts} />
		</QueryProvider>
	)
}
