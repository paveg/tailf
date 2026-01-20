/**
 * Generate a random UUID
 */
export function generateId(): string {
	return crypto.randomUUID()
}
