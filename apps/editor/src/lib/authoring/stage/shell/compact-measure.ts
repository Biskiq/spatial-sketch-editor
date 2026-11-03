/** Resting text only. Focused writers retain the controller's full accepted precision. */
export function compactMeasure(text: string): string {
	const value = Number(text);
	return text.trim() !== '' && Number.isFinite(value)
		? value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })
		: text;
}
