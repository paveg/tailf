import { describe, expect, it } from 'vitest'
import { decodeOffsetCursor, dot, encodeOffsetCursor, rankCandidates } from './semantic-search'

describe('encodeOffsetCursor / decodeOffsetCursor', () => {
	it('round-trips an offset value', () => {
		const cursor = encodeOffsetCursor(120)
		expect(typeof cursor).toBe('string')
		expect(decodeOffsetCursor(cursor)).toBe(120)
	})

	it('encodes 0 (start of results)', () => {
		const cursor = encodeOffsetCursor(0)
		expect(decodeOffsetCursor(cursor)).toBe(0)
	})

	it('decodeOffsetCursor returns 0 for malformed input', () => {
		expect(decodeOffsetCursor('not-base64-!!!')).toBe(0)
		expect(decodeOffsetCursor('eyJqdW5rIjoxfQ==')).toBe(0) // valid base64, wrong shape
		expect(decodeOffsetCursor('')).toBe(0)
	})

	it('decodeOffsetCursor returns 0 for negative or fractional offsets', () => {
		expect(decodeOffsetCursor(encodeOffsetCursor(-5))).toBe(0)
		// Manually craft a cursor with a fractional offset
		const fractional = btoa(JSON.stringify({ offset: 2.7 }))
		expect(decodeOffsetCursor(fractional)).toBe(0)
	})
})

describe('dot', () => {
	it('returns the dot product of two equal-length Float32Arrays', () => {
		const a = new Float32Array([1, 2, 3])
		const b = new Float32Array([4, 5, 6])
		// 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
		expect(dot(a, b)).toBeCloseTo(32, 6)
	})

	it('returns 1 for identical unit vectors', () => {
		const v = new Float32Array([0.6, 0.8, 0])
		expect(dot(v, v)).toBeCloseTo(1, 6)
	})

	it('returns 0 for orthogonal vectors', () => {
		const a = new Float32Array([1, 0, 0])
		const b = new Float32Array([0, 1, 0])
		expect(dot(a, b)).toBe(0)
	})
})

describe('rankCandidates', () => {
	it('returns candidates sorted by score descending', () => {
		const queryVec = new Float32Array([1, 0, 0, 0])
		const candidates = [
			{ id: 'a', vec: new Float32Array([0, 1, 0, 0]) }, // score 0
			{ id: 'b', vec: new Float32Array([1, 0, 0, 0]) }, // score 1
			{ id: 'c', vec: new Float32Array([0.5, 0.5, 0, 0]) }, // score 0.5
		]
		const ranked = rankCandidates(queryVec, candidates)
		expect(ranked.map((r) => r.id)).toEqual(['b', 'c', 'a'])
		expect(ranked[0].score).toBeCloseTo(1, 6)
	})

	it('returns [] for empty candidate list', () => {
		expect(rankCandidates(new Float32Array([1]), [])).toEqual([])
	})
})
