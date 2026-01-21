import { describe, expect, it } from 'vitest'
import { generateId } from './id'

describe('generateId', () => {
	it('returns a valid UUID format', () => {
		const id = generateId()
		// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		expect(id).toMatch(uuidRegex)
	})

	it('returns unique IDs on each call', () => {
		const ids = new Set<string>()
		for (let i = 0; i < 100; i++) {
			ids.add(generateId())
		}
		expect(ids.size).toBe(100)
	})

	it('returns a string', () => {
		expect(typeof generateId()).toBe('string')
	})

	it('returns 36 character string (UUID standard length)', () => {
		expect(generateId()).toHaveLength(36)
	})
})
