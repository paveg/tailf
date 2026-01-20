/**
 * 今週の人気記事コンポーネント（トップページ用）
 *
 * はてなブックマーク数を元に、直近1週間の人気記事を表示
 * Gold/Silver/Bronze ranking badges for top 3
 */
import type { PostWithFeed } from '@tailf/shared'
import { Calendar, ExternalLink, Flame, TrendingUp } from 'lucide-react'
import { HatenaBookmarkIcon } from '@/components/icons/HatenaBookmarkIcon'
import { useRankingPosts } from '@/lib/hooks'
import { extractDomain, formatDate } from '@/lib/utils'
import { QueryProvider } from './QueryProvider'
import { Card, CardHeader } from './ui/card'
import { Skeleton } from './ui/skeleton'

const POPULAR_POSTS_LIMIT = 6

// Podium colors for top 3
const RANK_STYLES = {
	1: {
		badge: 'bg-gradient-to-br from-yellow-400 to-amber-500 text-amber-950 shadow-amber-300/50',
		ring: 'ring-2 ring-amber-400/30',
		glow: 'shadow-lg shadow-amber-500/20',
	},
	2: {
		badge: 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 shadow-slate-300/50',
		ring: 'ring-2 ring-slate-300/30',
		glow: 'shadow-lg shadow-slate-400/20',
	},
	3: {
		badge: 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-950 shadow-orange-300/50',
		ring: 'ring-2 ring-orange-400/30',
		glow: 'shadow-lg shadow-orange-500/20',
	},
} as const

interface RankingCardProps {
	post: PostWithFeed & { hatenaBookmarkCount?: number | null }
	rank: number
}

function RankingCard({ post, rank }: RankingCardProps) {
	const isTopThree = rank <= 3
	const rankStyle = RANK_STYLES[rank as keyof typeof RANK_STYLES]

	return (
		<Card
			className={`
				group relative overflow-hidden transition-all duration-300
				hover:bg-muted/50 hover:-translate-y-0.5
				${isTopThree ? `${rankStyle?.ring} ${rankStyle?.glow}` : ''}
			`}
			style={{
				animationDelay: `${rank * 80}ms`,
			}}
		>
			<a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
				<CardHeader className="gap-3 pb-4">
					{/* Top row: Rank + Bookmark count + Date */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{/* Rank Badge */}
							<div
								className={`
									flex size-7 items-center justify-center rounded-full text-xs font-bold shadow-md
									${isTopThree ? rankStyle?.badge : 'bg-muted text-muted-foreground'}
								`}
							>
								{rank}
							</div>

							{/* Hatena Bookmark Count */}
							{post.hatenaBookmarkCount != null && post.hatenaBookmarkCount > 0 && (
								<div className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
									<HatenaBookmarkIcon className="size-3" />
									<span>{post.hatenaBookmarkCount}</span>
								</div>
							)}
						</div>

						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Calendar className="size-3" />
							<time dateTime={new Date(post.publishedAt).toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
						</div>
					</div>

					{/* Title */}
					<h3 className="line-clamp-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
						{post.title}
					</h3>

					{/* Bottom row: Author + Domain + External link */}
					<div className="flex items-center justify-between gap-2">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							{post.feed.author?.avatarUrl && (
								<img
									src={post.feed.author.avatarUrl}
									alt={post.feed.author.name}
									width={20}
									height={20}
									loading="lazy"
									decoding="async"
									className="size-5 shrink-0 rounded-full"
								/>
							)}
							<span className="truncate text-xs text-muted-foreground">
								{post.feed.author?.name ?? post.feed.title}
							</span>
						</div>
						<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/60">
							{extractDomain(post.url)}
							<ExternalLink className="size-3" />
						</span>
					</div>
				</CardHeader>
			</a>
		</Card>
	)
}

function PopularPostsSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: POPULAR_POSTS_LIMIT }).map((_, i) => (
				<Card key={i} className="overflow-hidden">
					<CardHeader className="gap-3 pb-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Skeleton className="size-7 rounded-full" />
								<Skeleton className="h-5 w-12 rounded-full" />
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-4/5" />
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Skeleton className="size-5 rounded-full" />
								<Skeleton className="h-4 w-20" />
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
					</CardHeader>
				</Card>
			))}
		</div>
	)
}

function PopularPostsContent() {
	const { data, isLoading, error } = useRankingPosts('week', POPULAR_POSTS_LIMIT, true)

	const posts = (data?.data ?? []) as (PostWithFeed & { hatenaBookmarkCount?: number | null })[]

	if (isLoading) {
		return <PopularPostsSkeleton />
	}

	if (error) {
		return (
			<div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
				<TrendingUp className="mx-auto mb-2 size-8 opacity-50" />
				<p>人気記事の取得に失敗しました</p>
			</div>
		)
	}

	if (posts.length === 0) {
		return (
			<div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
				<TrendingUp className="mx-auto mb-2 size-8 opacity-50" />
				<p>まだ人気記事がありません</p>
			</div>
		)
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{posts.map((post, index) => (
				<RankingCard key={post.id} post={post} rank={index + 1} />
			))}
		</div>
	)
}

export function PopularPosts() {
	return (
		<section>
			{/* Section Header */}
			<div className="mb-6 flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25">
					<Flame className="size-5 text-white" />
				</div>
				<div>
					<h2 className="text-xl font-bold sm:text-2xl">今週の人気記事</h2>
					<p className="text-xs text-muted-foreground">はてなブックマーク数でランキング</p>
				</div>
			</div>

			<QueryProvider>
				<PopularPostsContent />
			</QueryProvider>
		</section>
	)
}
