/**
 * URL query params と同期するフック
 */
import { useCallback, useEffect, useState } from 'react'

type ParamValue = string | boolean | number | undefined

interface UseQueryParamOptions<T> {
	defaultValue: T
	parse?: (value: string | null) => T
	serialize?: (value: T) => string | undefined
}

/**
 * 単一のquery paramと同期するstate
 */
export function useQueryParam<T extends ParamValue>(
	key: string,
	options: UseQueryParamOptions<T>,
): [T, (value: T) => void] {
	const { defaultValue, parse, serialize } = options

	// デフォルトのparse/serialize
	const parseValue =
		parse ??
		((v: string | null): T => {
			if (v === null) return defaultValue
			if (typeof defaultValue === 'boolean') return (v === 'true') as T
			if (typeof defaultValue === 'number') return Number(v) as T
			return v as T
		})

	const serializeValue =
		serialize ??
		((v: T): string | undefined => {
			if (v === defaultValue) return undefined
			if (v === undefined) return undefined
			return String(v)
		})

	// 初期値をURLから読み取り
	const getInitialValue = (): T => {
		if (typeof window === 'undefined') return defaultValue
		const params = new URLSearchParams(window.location.search)
		return parseValue(params.get(key))
	}

	const [value, setValue] = useState<T>(getInitialValue)

	// URL変更時に同期（ブラウザバック対応）
	useEffect(() => {
		const handlePopState = () => {
			const params = new URLSearchParams(window.location.search)
			setValue(parseValue(params.get(key)))
		}
		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [key, parseValue])

	// 値変更時にURLを更新
	const setValueWithUrl = useCallback(
		(newValue: T) => {
			setValue(newValue)

			const url = new URL(window.location.href)
			const serialized = serializeValue(newValue)

			if (serialized === undefined) {
				url.searchParams.delete(key)
			} else {
				url.searchParams.set(key, serialized)
			}

			window.history.replaceState({}, '', url.toString())
		},
		[key, serializeValue],
	)

	return [value, setValueWithUrl]
}

/**
 * Boolean型のquery param用ショートカット
 */
export function useBooleanQueryParam(
	key: string,
	defaultValue = false,
): [boolean, (value: boolean) => void] {
	return useQueryParam(key, { defaultValue })
}
