/** One key-order-independent value comparison shared by the Scene guards. */
export function stableJson(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value === null || typeof value !== 'object') return value;
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		sorted[key] = sortValue((value as Record<string, unknown>)[key]);
	}
	return sorted;
}
