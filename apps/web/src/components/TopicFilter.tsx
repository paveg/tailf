import { TOPICS, type TopicId } from '@tailf/shared'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

interface TopicFilterProps {
	value: TopicId | null
	onChange: (topic: TopicId | null) => void
}

export function TopicFilter({ value, onChange }: TopicFilterProps) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{/* All button */}
			<Button
				variant={value === null ? 'default' : 'outline'}
				size="sm"
				onClick={() => onChange(null)}
				className="h-7 px-2.5 text-xs"
			>
				すべて
			</Button>

			{/* Topic buttons */}
			{TOPICS.map((topic) => (
				<Button
					key={topic.id}
					variant={value === topic.id ? 'default' : 'outline'}
					size="sm"
					onClick={() => onChange(value === topic.id ? null : topic.id)}
					className={cn('h-7 px-2.5 text-xs', value === topic.id && 'font-medium')}
				>
					{topic.name}
				</Button>
			))}
		</div>
	)
}
