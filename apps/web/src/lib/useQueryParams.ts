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

	// 初期値はdefaultValueを使用（SSRとの整合性のため）
	const [value, setValue] = useState<T>(defaultValue)

	// マウント後にURLから値を読み取り + URL変更時に同期（ブラウザバック対応）
	useEffect(() => {
		// 初回マウント時にURLから値を読み取り
		const params = new URLSearchParams(window.location.search)
		setValue(parseValue(params.get(key)))

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

/**
 * String型のquery param用ショートカット（特定の値のみ許可）
 */
export function useStringQueryParam<T extends string>(
	key: string,
	defaultValue: T,
	allowedValues?: readonly T[],
): [T, (value: T) => void] {
	return useQueryParam(key, {
		defaultValue,
		parse: (v) => {
			if (v === null) return defaultValue
			if (allowedValues && !allowedValues.includes(v as T)) return defaultValue
			return v as T
		},
	})
}
