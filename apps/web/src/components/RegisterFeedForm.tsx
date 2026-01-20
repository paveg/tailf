import { Rss } from 'lucide-react'
import { useState } from 'react'
import { useCurrentUser, useRegisterFeed } from '@/lib/hooks'
import { QueryProvider } from './QueryProvider'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

function RegisterFeedFormContent() {
	const { data: user, isLoading: userLoading } = useCurrentUser()
	const registerFeed = useRegisterFeed()
	const [feedUrl, setFeedUrl] = useState('')

	if (userLoading) {
		return <div className="animate-pulse rounded-lg border p-6">読み込み中...</div>
	}

	if (!user) {
		return (
			<div className="rounded-lg border p-6 text-center">
				<p className="mb-4 text-muted-foreground">フィードを登録するにはログインが必要です</p>
				<Button asChild>
					<a href="/api/auth/github">GitHubでログイン</a>
				</Button>
			</div>
		)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!feedUrl.trim()) return

		try {
			await registerFeed.mutateAsync({ feedUrl: feedUrl.trim() })
			setFeedUrl('')
			alert('フィードを登録しました！')
		} catch (error) {
			let message = 'フィードの登録に失敗しました'
			if (error instanceof Error) {
				if (error.message.includes('already registered')) {
					message = 'このフィードは既に登録されています'
				} else if (error.message.includes('Invalid')) {
					message = 'RSSフィードの取得に失敗しました。URLを確認してください'
				} else {
					message = error.message
				}
			}
			alert(message)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="feedUrl">RSSフィードURL</Label>
				<Input
					id="feedUrl"
					type="url"
					placeholder="https://example.com/feed.xml"
					value={feedUrl}
					onChange={(e) => setFeedUrl(e.target.value)}
					required
				/>
				<p className="text-xs text-muted-foreground">
					ブログやスライドのRSS/AtomフィードURLを入力してください
				</p>
			</div>
			<Button type="submit" disabled={registerFeed.isPending || !feedUrl.trim()}>
				<Rss className="mr-2 size-4" />
				{registerFeed.isPending ? '登録中...' : 'フィードを登録'}
			</Button>
		</form>
	)
}

export function RegisterFeedForm() {
	return (
		<QueryProvider>
			<RegisterFeedFormContent />
		</QueryProvider>
	)
}
