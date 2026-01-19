import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PostCardProps {
	post: {
		id: string
		title: string
		summary?: string | null
		url: string
		publishedAt: string | Date
		thumbnailUrl?: string | null
		blog: {
			title: string
			siteUrl: string
		}
	}
}

function formatDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return new Intl.DateTimeFormat('ja-JP', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	}).format(d)
}

export function PostCard({ post }: PostCardProps) {
	return (
		<Card className="group transition-colors hover:bg-muted/50">
			<a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
				<CardHeader>
					<div className="flex items-center justify-between">
						<Badge variant="secondary">{post.blog.title}</Badge>
						<span className="flex items-center gap-1 text-xs text-muted-foreground">
							<time dateTime={new Date(post.publishedAt).toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
							<ExternalLink className="size-3" />
						</span>
					</div>
					<CardTitle className="line-clamp-2 text-base group-hover:text-primary">
						{post.title}
					</CardTitle>
					{post.summary && (
						<CardDescription className="line-clamp-2">{post.summary}</CardDescription>
					)}
				</CardHeader>
			</a>
		</Card>
	)
}
