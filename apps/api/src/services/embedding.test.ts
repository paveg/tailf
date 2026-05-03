import { describe, expect, it } from 'vitest'
import { decodeEmbedding, encodeEmbedding, normalize, toEmbeddingBytes } from './embedding'

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
	it('round-trips a 1024-dim Float32Array through Uint8Array losslessly', () => {
		const v = new Float32Array(1024)
		for (let i = 0; i < 1024; i++) v[i] = (i - 512) * 0.001
		const blob = encodeEmbedding(v)
		expect(blob).toBeInstanceOf(Uint8Array)
		expect(blob.byteLength).toBe(4096)
		const back = decodeEmbedding(blob)
		expect(back).toBeInstanceOf(Float32Array)
		expect(Array.from(back)).toEqual(Array.from(v))
	})

	it('decodes BLOBs that come from D1 with non-zero byteOffset', () => {
		const v = new Float32Array(1024)
		v[0] = 1
		v[1023] = -1
		const buf = new ArrayBuffer(4100)
		new Uint8Array(buf, 4, 4096).set(new Uint8Array(v.buffer))
		const blob = new Uint8Array(buf, 4, 4096)
		const back = decodeEmbedding(blob)
		expect(back[0]).toBe(1)
		expect(back[1023]).toBe(-1)
	})

	it('encodeEmbedding throws on wrong-length input', () => {
		const v = new Float32Array([0.1, -0.2, 0.3, 0.4])
		expect(() => encodeEmbedding(v)).toThrow(/expected 1024 dims, got 4/)
	})

	it('decodeEmbedding throws on wrong-length BLOB', () => {
		const blob = new Uint8Array(16)
		expect(() => decodeEmbedding(blob)).toThrow(/expected 4096 bytes, got 16/)
	})
})

describe('toEmbeddingBytes', () => {
	it('passes through a Uint8Array unchanged', () => {
		const input = new Uint8Array([1, 2, 3, 255])
		const out = toEmbeddingBytes(input)
		expect(out).toBe(input)
		expect(out).toBeInstanceOf(Uint8Array)
	})

	it('coerces a plain Array<number> (the shape miniflare D1 returns)', () => {
		// miniflare's D1 driver returns BLOB columns as plain JS arrays
		// of byte values, not as Uint8Array. Encode→Array→decode must
		// produce the same Float32Array.
		const v = new Float32Array(1024)
		for (let i = 0; i < 1024; i++) v[i] = (i - 512) * 0.001
		const blob = encodeEmbedding(v)
		const arrayShape = Array.from(blob)
		expect(Array.isArray(arrayShape)).toBe(true)
		expect(arrayShape).toHaveLength(4096)

		const coerced = toEmbeddingBytes(arrayShape)
		expect(coerced).toBeInstanceOf(Uint8Array)
		expect(coerced.byteLength).toBe(4096)

		const back = decodeEmbedding(coerced)
		expect(Array.from(back)).toEqual(Array.from(v))
	})

	it('coerces an ArrayBuffer to a Uint8Array view', () => {
		const buf = new ArrayBuffer(4)
		new Uint8Array(buf).set([10, 20, 30, 40])
		const out = toEmbeddingBytes(buf)
		expect(out).toBeInstanceOf(Uint8Array)
		expect(Array.from(out)).toEqual([10, 20, 30, 40])
	})

	it('coerces a JSON-serialized Buffer object { type, data }', () => {
		const out = toEmbeddingBytes({ type: 'Buffer', data: [5, 6, 7] })
		expect(out).toBeInstanceOf(Uint8Array)
		expect(Array.from(out)).toEqual([5, 6, 7])
	})

	it('throws on values it cannot coerce', () => {
		expect(() => toEmbeddingBytes(null)).toThrow(/cannot coerce/)
		expect(() => toEmbeddingBytes(undefined)).toThrow(/cannot coerce/)
		expect(() => toEmbeddingBytes('hex string')).toThrow(/cannot coerce/)
		expect(() => toEmbeddingBytes(42)).toThrow(/cannot coerce/)
	})
})
