/**
 * R217.S30 — the visitor-safe initial entry discriminant.
 *
 * A published route is a visitor experience, not an editor Preview: it enters
 * the guided tour (or free exploration when that is its declared entry) without
 * an authoring welcome chooser. Editor Preview keeps the welcome chooser for a
 * guided Experience, while a direct Presentation entry starts in guided mode.
 *
 * No editor import, no state, no DOM.
 */
export type VisitorSurfaceMode = 'welcome' | 'guided' | 'free';

export type VisitorStartMode = 'welcome' | 'guided' | 'free' | 'presentation';

export function initialVisitorSurfaceMode(
	mode: 'preview' | 'public',
	startMode: VisitorStartMode
): VisitorSurfaceMode {
	if (mode === 'public') return startMode === 'free' ? 'free' : 'guided';
	// An explicit Card action chooses its mode: guided enters the chosen Guide's
	// run directly, never through the authoring welcome chooser.
	return startMode === 'free' ? 'free' : startMode === 'guided' || startMode === 'presentation' ? 'guided' : 'welcome';
}
