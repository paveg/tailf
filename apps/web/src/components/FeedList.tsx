/**
 * フィード一覧コンポーネント
 *
 * SSG + クライアントフォールバック方式
 */
import type { FeedWithAuthor } from '@tailf/shared'
import { Bookmark, Building2, ExternalLink, Presentation, Rss, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
	useBookmarkedFeeds,
	useBookmarkFeed,
	useCurrentUser,
	useFeeds,
	useUnbookmarkFeed,
} from '@/lib/hooks'
import { useStringQueryParam } from '@/lib/useQueryParams'
import { QueryProvider } from './QueryProvider'
import { SearchInput } from './SearchInput'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Empty } from './ui/empty'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

type SortOption = 'recent' | 'popular'
const SORT_OPTIONS = ['recent', 'popular'] as const

type SourceFilter = 'all' | 'personal' | 'official'
const SOURCE_FILTERS = ['all', 'personal', 'official'] as const

interface FeedListContentProps {
	initialFeeds: FeedWithAuthor[]
}

function FeedListContent({ initialFeeds }: FeedListContentProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [source, setSource] = useStringQueryParam<SourceFilter>('source', 'all', SOURCE_FILTERS)
	const [sort, setSort] = useStringQueryParam<SortOption>('sort', 'recent', SORT_OPTIONS)
	const useClientFetch = initialFeeds.length === 0
	// Convert source filter to API parameter: all=undefined, personal=false, official=true
	const official = source === 'all' ? undefined : source === 'official'
	const { data, isLoading } = useFeeds({ perPage: 100, official })
	const { data: user } = useCurrentUser()
	const { data: bookmarkedData } = useBookmarkedFeeds()
	const bookmarkFeed = useBookmarkFeed()
	const unbookmarkFeed = useUnbookmarkFeed()

	const bookmarkedFeedIds = new Set(bookmarkedData?.data?.map((f) => f.id) ?? [])

	const apiFeeds = data?.data ?? []
	const baseFeeds: FeedWithAuthor[] = useClientFetch
		? apiFeeds
		: initialFeeds.filter((f) => {
				if (source === 'all') return true
				if (source === 'official') return f.isOfficial
				return !f.isOfficial // personal
			})

	// Filter and sort feeds client-side
	const feeds = useMemo(() => {
		let result = baseFeeds

		// Exclude user's own feeds
		if (user) {
			result = result.filter((feed) => feed.authorId !== user.id)
		}

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(
				(feed) =>
					feed.title.toLowerCase().includes(query) ||
					feed.description?.toLowerCase().includes(query) ||
					feed.siteUrl.toLowerCase().includes(query),
			)
		}

		// Sort
		if (sort === 'popular') {
			result = [...result].sort((a, b) => (b.bookmarkCount ?? 0) - (a.bookmarkCount ?? 0))
		}
		// 'recent' is default API order (createdAt desc)

		return result
	}, [baseFeeds, searchQuery, sort, user])

	const isInitialLoading = useClientFetch && isLoading

	const handleBookmarkToggle = (feedId: string, isBookmarked: boolean) => {
		if (isBookmarked) {
			unbookmarkFeed.mutate(feedId, {
				onSuccess: () => toast.success('ブックマークを解除しました'),
				onError: () => toast.error('ブックマーク解除に失敗しました'),
			})
		} else {
			bookmarkFeed.mutate(feedId, {
				onSuccess: () => toast.success('ブックマークに追加しました'),
				onError: () => toast.error('ブックマーク追加に失敗しました'),
			})
		}
	}

	return (
		<div className="space-y-6">
			{/* Search and Controls */}
			<div className="space-y-3">
				<SearchInput
					value={searchQuery}
					onChange={setSearchQuery}
					placeholder="フィードを検索..."
				/>
				<div className="flex items-center justify-between gap-2">
					<Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)}>
						<TabsList className="h-8">
							<TabsTrigger value="recent" className="px-3 text-xs">
								新着
							</TabsTrigger>
							<TabsTrigger value="popular" className="px-3 text-xs">
								人気
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<Tabs value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
						<TabsList className="h-8">
							<TabsTrigger value="all" className="px-3 text-xs">
								すべて
							</TabsTrigger>
							<TabsTrigger value="personal" className="px-3 text-xs">
								個人
							</TabsTrigger>
							<TabsTrigger value="official" className="px-3 text-xs">
								企業
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</div>

			{/* Loading State */}
			{isInitialLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card key={i} className="h-full">
							<CardHeader>
								<div className="flex items-center justify-between">
									<Skeleton className="h-6 w-32" />
									<Skeleton className="h-5 w-16" />
								</div>
								<Skeleton className="mt-2 h-4 w-24" />
							</CardHeader>
						</Card>
					))}
				</div>
			)}

			{/* Empty State */}
			{!isInitialLoading && feeds.length === 0 && (
				<Empty
					icon={Rss}
					title={
						searchQuery
							? '検索結果がありません'
							: source === 'official'
								? '企業ブログがありません'
								: source === 'personal'
									? '個人ブログがありません'
									: 'まだフィードが登録されていません'
					}
				/>
			)}

			{/* Feed Grid */}
			{!isInitialLoading && feeds.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{feeds.map((feed) => {
						const isBookmarked = bookmarkedFeedIds.has(feed.id)
						const bookmarkCount = feed.bookmarkCount ?? 0
						return (
							<Card
								key={feed.id}
								className="group flex h-full flex-col transition-colors hover:border-primary/20 hover:bg-muted/50"
							>
								<CardHeader className="flex flex-1 flex-col gap-3">
									{/* Title row */}
									<div className="flex w-full items-center justify-between gap-2">
										<a
											href={feed.siteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex min-w-0 items-center gap-2"
										>
											{feed.isOfficial && <Building2 className="size-4 shrink-0 text-primary" />}
											<CardTitle className="line-clamp-2 text-base group-hover:text-primary">
												{feed.title}
											</CardTitle>
											<ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
										</a>
										{/* Bookmark button - only show when logged in */}
										{user && feed.authorId !== user.id && (
											<Button
												variant="ghost"
												size="icon"
												className="size-8 shrink-0"
												onClick={() => handleBookmarkToggle(feed.id, isBookmarked)}
												disabled={bookmarkFeed.isPending || unbookmarkFeed.isPending}
											>
												<Bookmark
													className={`size-4 ${isBookmarked ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
												/>
											</Button>
										)}
									</div>

									{/* Description - fixed height area */}
									<p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
										{feed.description || '\u00A0'}
									</p>

									{/* Footer - always at bottom */}
									<div className="mt-auto flex w-full items-center justify-between gap-2 border-t pt-3">
										{/* Left side - author info */}
										<div className="flex min-w-0 flex-1 items-center gap-2">
											{feed.author && (
												<>
													<img
														src={
															feed.author.avatarUrl || `https://github.com/${feed.author.name}.png`
														}
														alt={feed.author.name}
														width={16}
														height={16}
														loading="lazy"
														decoding="async"
														className="size-4 shrink-0 rounded-full"
													/>
													<span className="truncate text-xs text-muted-foreground">
														{feed.author.name}
													</span>
												</>
											)}
										</div>
										{/* Right side - type & bookmark count */}
										<div className="flex shrink-0 items-center gap-2">
											<span className="flex items-center gap-1 text-xs text-muted-foreground">
												{feed.type === 'slide' ? (
													<Presentation className="size-3" />
												) : (
													<Rss className="size-3" />
												)}
												{feed.type === 'slide' ? 'スライド' : 'ブログ'}
											</span>
											{bookmarkCount > 0 && (
												<span className="flex items-center gap-1 text-xs text-muted-foreground">
													<Users className="size-3" />
													{bookmarkCount}
												</span>
											)}
										</div>
									</div>
								</CardHeader>
							</Card>
						)
					})}
				</div>
			)}
		</div>
	)
}

interface FeedListProps {
	initialFeeds?: FeedWithAuthor[]
}

export function FeedList({ initialFeeds = [] }: FeedListProps) {
	return (
		<QueryProvider>
			<FeedListContent initialFeeds={initialFeeds} />
		</QueryProvider>
	)
}
