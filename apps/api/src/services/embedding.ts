/**
 * Single entrypoint for BGE-M3 vector operations.
 * All callers should use `compute` / `computeBatch` instead of `ai.run` directly,
 * so we can centralize batching, normalization, and storage encoding.
 */

const MODEL = '@cf/baai/bge-m3'

export const EMBEDDING_DIM = 1024

export async function compute(ai: Ai, text: string): Promise<Float32Array> {
	const result = await ai.run(MODEL, { text: [text] })
	return normalize(new Float32Array(result.data[0]))
}

export async function computeBatch(ai: Ai, texts: string[]): Promise<Float32Array[]> {
	if (texts.length === 0) return []
	const result = await ai.run(MODEL, { text: texts })
	return result.data.map((v: number[]) => normalize(new Float32Array(v)))
}

export function normalize(v: Float32Array): Float32Array {
	let sumSq = 0
	for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i]
	if (sumSq === 0) return v
	const norm = Math.sqrt(sumSq)
	const out = new Float32Array(v.length)
	for (let i = 0; i < v.length; i++) out[i] = v[i] / norm
	return out
}

export function encodeEmbedding(v: Float32Array): Uint8Array {
	// Copy so we never accidentally hand callers a view into a larger buffer.
	const out = new Uint8Array(v.byteLength)
	out.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
	return out
}

export function decodeEmbedding(blob: Uint8Array): Float32Array {
	// D1 may return a Uint8Array view at a non-aligned byteOffset; copy
	// into a fresh ArrayBuffer so Float32Array construction is always safe.
	const out = new Float32Array(blob.byteLength / 4)
	new Uint8Array(out.buffer).set(blob)
	return out
}
