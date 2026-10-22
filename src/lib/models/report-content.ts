/** JSONB and different browsers need not preserve object property order. */
export function canonical(value: unknown): string {
	return JSON.stringify(value, (_key, item) =>
		item && typeof item === 'object' && !Array.isArray(item)
			? Object.fromEntries(
					Object.keys(item)
						.sort()
						.map((key) => [key, item[key]])
				)
			: item
	);
}

/** Saving the same fields again is not a conflicting edit. */
export function reportContent(report: unknown): string {
	if (!report || typeof report !== 'object') return '';
	const value = { ...report } as Record<string, unknown>;
	delete value.updatedAt;
	return canonical(value);
}

export function storedContent(raw: string | undefined): string {
	try {
		return reportContent(JSON.parse(raw ?? ''));
	} catch {
		return '';
	}
}
