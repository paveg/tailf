import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions {
	threshold?: number
	rootMargin?: string
}

export function useIntersectionObserver<T extends Element>(
	options: UseIntersectionObserverOptions = {},
) {
	const { threshold = 0, rootMargin = '100px' } = options
	const [isIntersecting, setIsIntersecting] = useState(false)
	const ref = useRef<T>(null)

	useEffect(() => {
		const element = ref.current
		if (!element) return

		const observer = new IntersectionObserver(
			([entry]) => setIsIntersecting(entry.isIntersecting),
			{
				threshold,
				rootMargin,
			},
		)

		observer.observe(element)
		return () => observer.disconnect()
	}, [threshold, rootMargin])

	return { ref, isIntersecting }
}
