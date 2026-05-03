import { describe, expect, it } from 'vitest'
import { decodeEmbedding, encodeEmbedding, normalize } from './embedding'

describe('normalize', () => {
	it('returns a unit vector', () => {
		const v = new Float32Array([3, 4, 0, 0])
		const out = normalize(v)
		const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0))
		expect(norm).toBeCloseTo(1, 6)
		expect(out[0]).toBeCloseTo(0.6, 6)
		expect(out[1]).toBeCloseTo(0.8, 6)
	})

	it('returns the input unchanged for the zero vector', () => {
		const v = new Float32Array([0, 0, 0, 0])
		const out = normalize(v)
		expect(Array.from(out)).toEqual([0, 0, 0, 0])
	})
})

describe('encodeEmbedding / decodeEmbedding', () => {
	it('round-trips Float32Array through Uint8Array losslessly', () => {
		const v = new Float32Array([0.1, -0.2, 0.3, 0.4])
		const blob = encodeEmbedding(v)
		expect(blob).toBeInstanceOf(Uint8Array)
		expect(blob.byteLength).toBe(16)
		const back = decodeEmbedding(blob)
		expect(back).toBeInstanceOf(Float32Array)
		expect(Array.from(back)).toEqual(Array.from(v))
	})

	it('decodes BLOBs that come from D1 with non-zero byteOffset', () => {
		const buf = new ArrayBuffer(20)
		const v = new Float32Array([1, 2, 3, 4])
		new Uint8Array(buf, 4, 16).set(new Uint8Array(v.buffer))
		const blob = new Uint8Array(buf, 4, 16)
		const back = decodeEmbedding(blob)
		expect(Array.from(back)).toEqual([1, 2, 3, 4])
	})
})
