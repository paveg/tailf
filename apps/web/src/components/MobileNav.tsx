/**
 * モバイルナビゲーションコンポーネント
 *
 * ターミナルスタイルのハンバーガーメニュー
 */
import { FileText, Menu, Rss, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'

const navLinks = [
	{ href: '/posts', label: '記事一覧', icon: FileText },
	{ href: '/blogs', label: 'フィード一覧', icon: Rss },
]

export function MobileNav() {
	const [isOpen, setIsOpen] = useState(false)

	// Close menu on route change or escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setIsOpen(false)
		}

		if (isOpen) {
			document.addEventListener('keydown', handleEscape)
			document.body.style.overflow = 'hidden'
		}

		return () => {
			document.removeEventListener('keydown', handleEscape)
			document.body.style.overflow = ''
		}
	}, [isOpen])

	return (
		<div className="md:hidden">
			<Button
				variant="ghost"
				size="icon"
				onClick={() => setIsOpen(!isOpen)}
				aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
				aria-expanded={isOpen}
				className="relative z-50"
			>
				{isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
			</Button>

			{/* Backdrop */}
			{isOpen && (
				<div
					className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
					onClick={() => setIsOpen(false)}
					aria-hidden="true"
				/>
			)}

			{/* Menu Panel */}
			<div
				className={`
					fixed inset-x-0 top-14 z-40 border-b bg-background p-4
					transition-all duration-200 ease-out
					${isOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}
				`}
			>
				<nav className="flex flex-col gap-1">
					{/* Terminal prompt decoration */}
					<div className="mb-2 font-mono text-xs text-muted-foreground">
						<span className="text-primary">~</span> ls -la ./pages
					</div>

					{navLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							onClick={() => setIsOpen(false)}
							className="flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-foreground transition-colors hover:bg-muted active:bg-muted/80"
						>
							<link.icon className="size-5 text-muted-foreground" />
							<span>{link.label}</span>
						</a>
					))}

					{/* Terminal output decoration */}
					<div className="mt-3 border-t pt-3 font-mono text-xs text-muted-foreground">
						<span className="text-green-500">2 items</span> listed
					</div>
				</nav>
			</div>
		</div>
	)
}
