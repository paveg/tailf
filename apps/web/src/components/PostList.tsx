import { usePosts } from '@/lib/hooks'
import { PostCard } from './PostCard'
import { QueryProvider } from './QueryProvider'
import { Skeleton } from './ui/skeleton'

function PostListContent() {
	const { data, isLoading, error } = usePosts({ perPage: 12 })

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<PostCardSkeleton key={i} />
				))}
			</div>
		)
	}

	if (error) {
		return <div className="py-8 text-center text-muted-foreground">記事の取得に失敗しました</div>
	}

	const posts = data?.data ?? []

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

function PostCardSkeleton() {
	return (
		<div className="rounded-lg border p-4">
			<Skeleton className="mb-2 h-4 w-3/4" />
			<Skeleton className="mb-4 h-3 w-full" />
			<div className="flex items-center justify-between">
				<Skeleton className="h-5 w-20" />
				<Skeleton className="h-3 w-16" />
			</div>
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
