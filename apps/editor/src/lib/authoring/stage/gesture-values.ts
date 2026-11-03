/** Compact invocation-relative readings; formatting never changes a planner value. */
export function signed(value: number, digits = 2): string {
	const rounded = Number(value.toFixed(digits));
	return rounded === 0 ? (0).toFixed(digits) : `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
}
export function angularDelta(value: number, baseline: number): number {
	return Math.atan2(Math.sin(value - baseline), Math.cos(value - baseline));
}
export function angleDeltaLabel(value: number, baseline: number): string {
	return `Δθ ${signed(angularDelta(value, baseline) * 180 / Math.PI, 1)}°`;
}
export function planarDeltaLabel(dx: number, dz: number): string {
	return `Δx ${signed(dx)} · Δz ${signed(dz)} m`;
}
export function sizeDeltaLabel(value: number, baseline: number): string {
	return `Δ ${signed(value - baseline)} m → ${value.toFixed(2)} m`;
}
