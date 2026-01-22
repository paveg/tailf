/**
 * 新着記事コンポーネント（トップページ用）
 *
 * SSG + クライアントフォールバック方式:
 * - initialPosts: ビルド時に取得した記事（SEO用）
 * - 開発環境ではinitialPostsが空なのでAPIから取得
 */
import type { PostWithFeed } from '@tailf/shared'
import { useInfinitePosts } from '@/lib/hooks'
import { PostCard } from './PostCard'
import { QueryProvider } from './QueryProvider'
import { Skeleton } from './ui/skeleton'

interface RecentPostsContentProps {
	initialPosts: PostWithFeed[]
}

function RecentPostsContent({ initialPosts }: RecentPostsContentProps) {
	// SSGデータがない場合（開発環境）はAPIから取得
	const useClientFetch = initialPosts.length === 0
	const { data, isLoading } = useInfinitePosts(6)

	const apiPosts = data?.pages.flatMap((page) => page.data).slice(0, 6) ?? []
	const posts = useClientFetch ? apiPosts : initialPosts

	if (useClientFetch && isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					// Matches PostCard structure to prevent CLS
					<div key={i} className="overflow-hidden rounded-lg border">
						<Skeleton className="aspect-[2/1] w-full" />
						<div className="space-y-2 p-4">
							<div className="flex items-center gap-3">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-10" />
							</div>
							<Skeleton className="h-5 w-full" />
							<Skeleton className="h-5 w-3/4" />
							<div className="flex items-center gap-2">
								<Skeleton className="size-5 rounded-full" />
								<Skeleton className="h-4 w-24" />
							</div>
						</div>
					</div>
				))}
			</div>
		)
	}

	if (posts.length === 0) {
		return <div className="py-8 text-center text-muted-foreground">まだ記事がありません</div>
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{posts.map((post) => (
				<PostCard key={post.id} post={post} />
			))}
		</div>
	)
}

interface RecentPostsProps {
	initialPosts?: PostWithFeed[]
}

export function RecentPosts({ initialPosts = [] }: RecentPostsProps) {
	return (
		<QueryProvider>
			<RecentPostsContent initialPosts={initialPosts} />
		</QueryProvider>
	)
}
