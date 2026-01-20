/**
 * モバイルナビゲーションコンポーネント
 *
 * シンプルなアイコンボタン（UserMenuと統一グループ化）
 */
import { FileText, Rss } from 'lucide-react'
import { Button } from './ui/button'

export function MobileNav() {
	return (
		<>
			<Button variant="ghost" size="icon" className="size-8 rounded-none" asChild>
				<a href="/posts" aria-label="記事一覧">
					<FileText className="size-4" />
				</a>
			</Button>
			<div className="h-5 w-px bg-border" />
			<Button variant="ghost" size="icon" className="size-8 rounded-none" asChild>
				<a href="/blogs" aria-label="フィード一覧">
					<Rss className="size-4" />
				</a>
			</Button>
			<div className="h-5 w-px bg-border" />
		</>
	)
}
