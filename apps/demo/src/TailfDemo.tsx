import { loadFont as loadInterFont } from '@remotion/google-fonts/Inter'
import { loadFont } from '@remotion/google-fonts/ZenKakuGothicNew'
import {
	AbsoluteFill,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion'

// Load fonts - Zen Kaku Gothic New uses numbered subsets for Japanese characters
const { fontFamily: zenKaku } = loadFont()

const { fontFamily: inter } = loadInterFont()

// GitHub Primer color tokens
const colors = {
	// Light mode
	background: '#ffffff',
	foreground: '#1f2328',
	primary: '#0969da',
	muted: '#656d76',
	card: '#f6f8fa',
	border: '#d0d7de',
	hatena: '#00A4DE',
	success: '#1a7f37',
}

// Scene: Intro with logo and tagline
const IntroScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	const logoScale = spring({
		frame,
		fps,
		config: { damping: 12, stiffness: 100 },
	})

	const taglineOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	const taglineY = interpolate(frame, [fps * 0.5, fps * 1], [20, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	const missionOpacity = interpolate(frame, [fps * 1.2, fps * 1.7], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.background,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: zenKaku,
			}}
		>
			{/* Logo */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 16,
					transform: `scale(${logoScale})`,
				}}
			>
				<TerminalIcon size={80} />
				<span
					style={{
						fontSize: 120,
						fontWeight: 700,
						color: colors.foreground,
						fontFamily: inter,
						letterSpacing: '-0.02em',
					}}
				>
					tailf
				</span>
			</div>

			{/* Tagline */}
			<div
				style={{
					marginTop: 32,
					fontSize: 32,
					color: colors.muted,
					opacity: taglineOpacity,
					transform: `translateY(${taglineY}px)`,
					fontFamily: inter,
				}}
			>
				tail -f /dev/techblogs
			</div>

			{/* Mission */}
			<div
				style={{
					marginTop: 48,
					fontSize: 40,
					color: colors.foreground,
					opacity: missionOpacity,
					fontWeight: 700,
				}}
			>
				日本の技術ブログが、もっと見つけやすく・見られやすく
			</div>
		</AbsoluteFill>
	)
}

// Terminal icon component
const TerminalIcon: React.FC<{ size: number }> = ({ size }) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={colors.primary}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			role="img"
			aria-label="Terminal icon"
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	)
}

// Scene: Feature showcase - RSS Feed Registration
const FeedRegistrationScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	const feeds = [
		{ name: '個人ブログ', color: '#8B5CF6' },
		{ name: 'Zenn', color: '#3EA8FF' },
		{ name: 'Qiita', color: '#55C500' },
		{ name: 'はてなブログ', color: '#00A4DE' },
		{ name: 'note', color: '#41C9B4' },
	]

	const headerOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.background,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: zenKaku,
				padding: 80,
			}}
		>
			<h2
				style={{
					fontSize: 48,
					fontWeight: 700,
					color: colors.foreground,
					marginBottom: 24,
					opacity: headerOpacity,
				}}
			>
				RSSフィードを登録するだけ
			</h2>
			<p
				style={{
					fontSize: 28,
					color: colors.muted,
					marginBottom: 60,
					opacity: headerOpacity,
				}}
			>
				あなたの技術ブログをまとめて管理
			</p>

			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 20,
					justifyContent: 'center',
					maxWidth: 900,
				}}
			>
				{feeds.map((feed, index) => {
					const delay = fps * 0.3 + index * 8
					const entryProgress = spring({
						frame: frame - delay,
						fps,
						config: { damping: 15, stiffness: 120 },
					})

					return (
						<div
							key={feed.name}
							style={{
								padding: '16px 32px',
								backgroundColor: feed.color,
								borderRadius: 12,
								color: '#fff',
								fontSize: 24,
								fontWeight: 600,
								transform: `scale(${entryProgress})`,
								opacity: entryProgress,
							}}
						>
							{feed.name}
						</div>
					)
				})}
			</div>
		</AbsoluteFill>
	)
}

// Scene: Feature showcase - Ranking
const RankingScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	const posts = [
		{ title: 'React 19の新機能まとめ', bookmarks: 324 },
		{ title: 'TypeScript 5.5完全ガイド', bookmarks: 256 },
		{ title: 'Cloudflare Workers入門', bookmarks: 189 },
	]

	const headerOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.background,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: zenKaku,
				padding: 80,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 16,
					marginBottom: 48,
					opacity: headerOpacity,
				}}
			>
				<BookmarkIcon size={48} />
				<h2
					style={{
						fontSize: 48,
						fontWeight: 700,
						color: colors.foreground,
					}}
				>
					はてブ人気ランキング
				</h2>
			</div>

			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 20,
					width: '100%',
					maxWidth: 800,
				}}
			>
				{posts.map((post, index) => {
					const delay = fps * 0.3 + index * 12
					const slideIn = spring({
						frame: frame - delay,
						fps,
						config: { damping: 20, stiffness: 100 },
					})

					const translateX = interpolate(slideIn, [0, 1], [100, 0])
					const opacity = slideIn

					return (
						<div
							key={post.title}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '24px 32px',
								backgroundColor: colors.card,
								borderRadius: 12,
								border: `1px solid ${colors.border}`,
								transform: `translateX(${translateX}px)`,
								opacity,
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
								<span
									style={{
										fontSize: 32,
										fontWeight: 700,
										color: colors.primary,
										fontFamily: inter,
									}}
								>
									#{index + 1}
								</span>
								<span
									style={{
										fontSize: 24,
										color: colors.foreground,
									}}
								>
									{post.title}
								</span>
							</div>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									color: colors.hatena,
									fontSize: 24,
									fontWeight: 600,
									fontFamily: inter,
								}}
							>
								<BookmarkIcon size={24} />
								{post.bookmarks}
							</div>
						</div>
					)
				})}
			</div>
		</AbsoluteFill>
	)
}

// Bookmark icon
const BookmarkIcon: React.FC<{ size: number }> = ({ size }) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill={colors.hatena}
			role="img"
			aria-label="Bookmark icon"
		>
			<path d="M17.5 1.917a6.4 6.4 0 0 0-5.5 3.3 6.4 6.4 0 0 0-5.5-3.3A6.8 6.8 0 0 0 0 8.967c0 4.547 4.786 9.513 8.8 12.88a4.974 4.974 0 0 0 6.4 0c4.014-3.367 8.8-8.333 8.8-12.88a6.8 6.8 0 0 0-6.5-7.05" />
		</svg>
	)
}

// Scene: Tech filter feature
const TechFilterScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	const headerOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	const articles = [
		{ title: 'React 19の新機能まとめ', isTech: true },
		{ title: '今日のランチ日記', isTech: false },
		{ title: 'TypeScript 5.5完全ガイド', isTech: true },
		{ title: '旅行の思い出', isTech: false },
		{ title: 'Cloudflare Workers入門', isTech: true },
	]

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.background,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: zenKaku,
				padding: 80,
			}}
		>
			<h2
				style={{
					fontSize: 48,
					fontWeight: 700,
					color: colors.foreground,
					marginBottom: 24,
					opacity: headerOpacity,
				}}
			>
				技術記事だけを絞り込み
			</h2>
			<p
				style={{
					fontSize: 28,
					color: colors.muted,
					marginBottom: 60,
					opacity: headerOpacity,
				}}
			>
				雑記・日記をスキップして技術記事に集中
			</p>

			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 16,
					width: '100%',
					maxWidth: 700,
				}}
			>
				{articles.map((article, index) => {
					const delay = fps * 0.3 + index * 10
					const slideIn = spring({
						frame: frame - delay,
						fps,
						config: { damping: 20, stiffness: 100 },
					})

					const translateX = interpolate(slideIn, [0, 1], [-50, 0])
					const opacity = slideIn

					return (
						<div
							key={article.title}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '20px 28px',
								backgroundColor: article.isTech ? colors.card : '#fafafa',
								borderRadius: 12,
								border: `1px solid ${article.isTech ? colors.primary : colors.border}`,
								transform: `translateX(${translateX}px)`,
								opacity: article.isTech ? opacity : opacity * 0.5,
							}}
						>
							<span
								style={{
									fontSize: 22,
									color: article.isTech ? colors.foreground : colors.muted,
									textDecoration: article.isTech ? 'none' : 'line-through',
								}}
							>
								{article.title}
							</span>
							<span
								style={{
									padding: '6px 16px',
									backgroundColor: article.isTech ? colors.success : colors.muted,
									borderRadius: 20,
									color: '#fff',
									fontSize: 14,
									fontWeight: 600,
								}}
							>
								{article.isTech ? '技術記事' : 'スキップ'}
							</span>
						</div>
					)
				})}
			</div>
		</AbsoluteFill>
	)
}

// Scene: Outro with CTA
const OutroScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	const logoScale = spring({
		frame,
		fps,
		config: { damping: 15, stiffness: 100 },
	})

	const ctaOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	})

	const ctaScale = spring({
		frame: frame - fps * 0.5,
		fps,
		config: { damping: 12, stiffness: 120 },
	})

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.foreground,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: zenKaku,
			}}
		>
			{/* Logo */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 16,
					transform: `scale(${logoScale})`,
				}}
			>
				<svg
					width={60}
					height={60}
					viewBox="0 0 24 24"
					fill="none"
					stroke={colors.primary}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					role="img"
					aria-label="tailf logo"
				>
					<polyline points="4 17 10 11 4 5" />
					<line x1="12" y1="19" x2="20" y2="19" />
				</svg>
				<span
					style={{
						fontSize: 80,
						fontWeight: 700,
						color: colors.background,
						fontFamily: inter,
						letterSpacing: '-0.02em',
					}}
				>
					tailf
				</span>
			</div>

			{/* CTA */}
			<div
				style={{
					marginTop: 48,
					padding: '20px 48px',
					backgroundColor: colors.primary,
					borderRadius: 12,
					opacity: ctaOpacity,
					transform: `scale(${Math.max(0, ctaScale)})`,
				}}
			>
				<span
					style={{
						fontSize: 28,
						fontWeight: 600,
						color: colors.background,
					}}
				>
					今すぐ個人ブログを登録
				</span>
			</div>

			<p
				style={{
					marginTop: 32,
					fontSize: 18,
					color: colors.muted,
					opacity: ctaOpacity,
					fontFamily: inter,
				}}
			>
				tailf.pavegy.workers.dev
			</p>
		</AbsoluteFill>
	)
}

// Main composition
export const TailfDemo: React.FC = () => {
	const { fps } = useVideoConfig()

	// Scene durations in seconds
	const introDuration = 3.5 * fps
	const feedRegistrationDuration = 3 * fps
	const rankingDuration = 3.5 * fps
	const techFilterDuration = 3.5 * fps
	const outroDuration = 2.5 * fps

	return (
		<AbsoluteFill>
			{/* Intro */}
			<Sequence durationInFrames={introDuration} premountFor={fps}>
				<IntroScene />
			</Sequence>

			{/* Feed Registration */}
			<Sequence from={introDuration} durationInFrames={feedRegistrationDuration} premountFor={fps}>
				<FeedRegistrationScene />
			</Sequence>

			{/* Ranking */}
			<Sequence
				from={introDuration + feedRegistrationDuration}
				durationInFrames={rankingDuration}
				premountFor={fps}
			>
				<RankingScene />
			</Sequence>

			{/* Tech Filter */}
			<Sequence
				from={introDuration + feedRegistrationDuration + rankingDuration}
				durationInFrames={techFilterDuration}
				premountFor={fps}
			>
				<TechFilterScene />
			</Sequence>

			{/* Outro */}
			<Sequence
				from={introDuration + feedRegistrationDuration + rankingDuration + techFilterDuration}
				durationInFrames={outroDuration}
				premountFor={fps}
			>
				<OutroScene />
			</Sequence>
		</AbsoluteFill>
	)
}
