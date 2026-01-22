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
import { Bookmark, Code2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { SortOption } from '@/lib/api'
import {
	useCurrentUser,
	useInfinitePosts,
	useInfiniteSearchPosts,
	useInfiniteUserFeed,
} from '@/lib/hooks'
import { useDebounce } from '@/lib/useDebounce'
import { useIntersectionObserver } from '@/lib/useIntersectionObserver'
import { useBooleanQueryParam, useStringQueryParam } from '@/lib/useQueryParams'

import { PostCard } from './PostCard'
import { QueryProvider } from './QueryProvider'
import { SearchInput } from './SearchInput'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

const POSTS_PER_PAGE = 12

type SourceFilter = 'all' | 'personal' | 'official'
const SOURCE_FILTERS = ['all', 'personal', 'official'] as const

interface PostListContentProps {
	allPosts: PostWithFeed[]
}

const SORT_OPTIONS = ['recent', 'popular'] as const

function PostListContent({ allPosts }: PostListContentProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [techOnly, setTechOnly] = useBooleanQueryParam('tech', true)
	const [bookmarkOnly, setBookmarkOnly] = useBooleanQueryParam('bookmark', false)
	const [source, setSource] = useStringQueryParam<SourceFilter>('source', 'all', SOURCE_FILTERS)
	const [sort, setSort] = useStringQueryParam<SortOption>('sort', 'recent', SORT_OPTIONS)
	const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE)
	const debouncedQuery = useDebounce(searchQuery, 300)
	const { data: user } = useCurrentUser()

	const isSearching = debouncedQuery.length >= 2

	// SSGデータがない場合（開発環境）はAPIから取得
	const useClientFetch = allPosts.length === 0 || bookmarkOnly
	// Convert source filter to API parameter: all=undefined, personal=false, official=true
	const official = source === 'all' ? undefined : source === 'official'
	const apiQuery = useInfinitePosts(12, techOnly, official, sort)
	// ブックマークフィルター用のクエリ
	const bookmarkQuery = useInfiniteUserFeed(12, techOnly)

	// Search uses API (can't pre-build search results)
	const searchQueryResult = useInfiniteSearchPosts(debouncedQuery, 12, techOnly, official)

	// APIから取得した記事
	const apiPosts = useMemo(() => {
		if (bookmarkOnly) {
			return bookmarkQuery.data?.pages.flatMap((page) => page.data) ?? []
		}
		return apiQuery.data?.pages.flatMap((page) => page.data) ?? []
	}, [apiQuery.data, bookmarkQuery.data, bookmarkOnly])

	// 使用するクエリ（ブックマークモードかどうかで切り替え）
	const activeQuery = bookmarkOnly ? bookmarkQuery : apiQuery

	// 使用する記事データ（SSG or API）
	const sourcePosts = useClientFetch ? apiPosts : allPosts

	// Filter and sort posts client-side
	// Note: user's own posts are excluded server-side via excludeAuthorId param
	const filteredPosts = useMemo(() => {
		let posts = sourcePosts

		if (techOnly && !useClientFetch) {
			// SSGの場合はクライアントでフィルタ
			posts = posts.filter((post) => (post.techScore ?? 0) >= 0.3)
		}
		// SSGの場合はクライアントでソート
		if (!useClientFetch && sort === 'popular') {
			posts = [...posts].sort((a, b) => {
				const aCount = a.hatenaBookmarkCount ?? 0
				const bCount = b.hatenaBookmarkCount ?? 0
				if (bCount !== aCount) return bCount - aCount
				return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
			})
		}
		return posts
	}, [sourcePosts, techOnly, useClientFetch, sort])

	// Visible posts (client-side pagination for SSG)
	const visiblePosts = useMemo(() => {
		if (useClientFetch) {
			return filteredPosts // APIの場合は既にページネーション済み
		}
		return filteredPosts.slice(0, visibleCount)
	}, [filteredPosts, visibleCount, useClientFetch])

	const hasMore = useClientFetch
		? (activeQuery.hasNextPage ?? false)
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
			if (!activeQuery.isFetchingNextPage) {
				activeQuery.fetchNextPage()
			}
		} else {
			// SSGの場合
			setVisibleCount((prev) => prev + POSTS_PER_PAGE)
		}
	}, [isIntersecting, hasMore, isSearching, useClientFetch, activeQuery])

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

	// Reset visible count when filter/sort changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: filters are intentionally triggers to reset pagination
	useEffect(() => {
		setVisibleCount(POSTS_PER_PAGE)
	}, [techOnly, source, sort, bookmarkOnly])

	// Determine which posts to show
	const displayPosts = isSearching
		? (searchQueryResult.data?.pages.flatMap((page) => page.data) ?? [])
		: visiblePosts

	// API取得中はローディング表示、SSGデータがある場合はそのまま表示
	const isInitialLoading = useClientFetch && activeQuery.isLoading
	const showSearchLoading = isSearching && searchQueryResult.isLoading
	const isLoadingMore = isSearching
		? searchQueryResult.isFetchingNextPage
		: useClientFetch && activeQuery.isFetchingNextPage
	const showEndMessage = isSearching
		? !searchQueryResult.hasNextPage && displayPosts.length > 0
		: !hasMore && displayPosts.length > 0

	return (
		<div className="space-y-6">
			{/* Search Input and Controls */}
			<div className="space-y-3">
				{/* Search Input */}
				<SearchInput value={searchQuery} onChange={setSearchQuery} isLoading={showSearchLoading} />

				{/* Sort and Filters - responsive layout */}
				{/* Mobile: 2 rows / Desktop: single row */}
				<div className="space-y-2 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
					{/* Row 1 (mobile): Sort + Tech toggle */}
					<div className="flex items-center gap-2 sm:contents">
						<Tabs
							value={sort}
							onValueChange={(v) => setSort(v as SortOption)}
							className="flex-1 sm:flex-none"
						>
							<TabsList className="h-9 w-full sm:h-8 sm:w-auto">
								<TabsTrigger
									value="recent"
									className="flex-1 text-sm sm:flex-none sm:px-3 sm:text-xs"
								>
									新着
								</TabsTrigger>
								<TabsTrigger
									value="popular"
									className="flex-1 text-sm sm:flex-none sm:px-3 sm:text-xs"
								>
									人気
								</TabsTrigger>
							</TabsList>
						</Tabs>

						<div className="flex shrink-0 items-center gap-1 sm:order-last sm:ml-auto">
							{user && (
								<ToggleGroup
									type="single"
									variant="outline"
									size="sm"
									value={bookmarkOnly ? 'bookmark' : ''}
									onValueChange={(value) => setBookmarkOnly(value === 'bookmark')}
								>
									<ToggleGroupItem value="bookmark" className="h-9 px-3 text-sm sm:h-8 sm:text-xs">
										<Bookmark className={bookmarkOnly ? 'fill-primary text-primary' : ''} />
										ブックマーク
									</ToggleGroupItem>
								</ToggleGroup>
							)}
							<ToggleGroup
								type="single"
								variant="outline"
								size="sm"
								value={techOnly ? 'tech' : ''}
								onValueChange={(value) => setTechOnly(value === 'tech')}
							>
								<ToggleGroupItem value="tech" className="h-9 px-3 text-sm sm:h-8 sm:text-xs">
									<Code2 className={techOnly ? 'text-primary' : ''} />
									技術記事
								</ToggleGroupItem>
							</ToggleGroup>
						</div>
					</div>

					{/* Row 2 (mobile): Source filter */}
					<Tabs
						value={source}
						onValueChange={(v) => setSource(v as SourceFilter)}
						className="w-full sm:w-auto"
					>
						<TabsList className="h-9 w-full sm:h-8 sm:w-auto">
							<TabsTrigger value="all" className="flex-1 text-sm sm:flex-none sm:px-3 sm:text-xs">
								すべて
							</TabsTrigger>
							<TabsTrigger
								value="personal"
								className="flex-1 text-sm sm:flex-none sm:px-3 sm:text-xs"
							>
								個人
							</TabsTrigger>
							<TabsTrigger
								value="official"
								className="flex-1 text-sm sm:flex-none sm:px-3 sm:text-xs"
							>
								企業
							</TabsTrigger>
						</TabsList>
					</Tabs>
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
	// Matches PostCard structure to prevent CLS
	return (
		<div className="overflow-hidden rounded-lg border">
			{/* Thumbnail area - matches aspect-[2/1] */}
			<Skeleton className="aspect-[2/1] w-full" />
			{/* CardHeader content */}
			<div className="space-y-2 p-4">
				{/* Date and bookmark count row */}
				<div className="flex items-center gap-3">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-10" />
				</div>
				{/* Title (2 lines) */}
				<Skeleton className="h-5 w-full" />
				<Skeleton className="h-5 w-3/4" />
				{/* Author row */}
				<div className="flex items-center gap-2">
					<Skeleton className="size-5 rounded-full" />
					<Skeleton className="h-4 w-24" />
				</div>
			</div>
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
