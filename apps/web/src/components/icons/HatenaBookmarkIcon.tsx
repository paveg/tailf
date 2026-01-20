/**
 * はてなブックマークアイコン
 */
interface HatenaBookmarkIconProps {
	className?: string
}

export function HatenaBookmarkIcon({ className }: HatenaBookmarkIconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
			role="img"
			aria-labelledby="hatena-bookmark-title"
		>
			<title id="hatena-bookmark-title">はてなブックマーク</title>
			<path d="M20.47 2H3.53A1.45 1.45 0 0 0 2 3.38v17.24A1.45 1.45 0 0 0 3.53 22h16.94a1.45 1.45 0 0 0 1.53-1.38V3.38A1.45 1.45 0 0 0 20.47 2zM8.09 17.33a1.94 1.94 0 0 1-2 2 1.93 1.93 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2zm0-5.72H4v-1.4h1.42V6.11H4V4.72h4.09zm7.91 7.18h-4.39v-1.25h1.42V6.1h-1.42V4.72h4.39z" />
		</svg>
	)
}
