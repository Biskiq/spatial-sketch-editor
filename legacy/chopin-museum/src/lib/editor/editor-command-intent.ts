/**
 * P23.11 — pointer-time editor command intents, pure.
 *
 * A Wall-body gesture is discriminated by a **named command**, never by a
 * physical key read at the point of use. Interaction code asks this module
 * which commands are live for a modifier snapshot and platform, freezes the
 * answer into its gesture, and never inspects `event.metaKey` / `event.altKey`
 * as product logic. Remapping therefore becomes a data change: a settings
 * surface only has to supply a different binding table to the same resolver.
 *
 * No Svelte, no DOM, no layout imports. The only environment-dependent part —
 * platform detection — takes its source as an argument so it stays testable.
 */

export type EditorCommandId = 'layout.wall.bend';

export type EditorModifierToken = 'meta' | 'ctrl' | 'alt' | 'shift';

export type EditorPlatform = 'mac' | 'other';

/** The four modifiers a pointer-down can carry, as booleans. */
export type EditorModifierSnapshot = {
	meta: boolean;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
};

export type EditorCommandBinding = {
	command: EditorCommandId;
	/**
	 * The exact modifier set the binding requires. It resolves only when the
	 * held tokens are **exactly** this set — an extra held modifier never
	 * matches, and no token is implied by another.
	 */
	hold: readonly EditorModifierToken[];
};

/**
 * Temporary defaults. There is no keybinding storage yet, so this table is the
 * single place that knows which token a command uses; replacing it with user
 * settings later requires no consumer change.
 *
 * macOS gets ⌘ (Command) because every existing ⌘ contract is a keydown chord
 * or belongs to a different hit kind, so a ⌘-held pointer drag on a canonical
 * Wall body is unclaimed. Alt carries editor-wide meaning on macOS (scene
 * cycle-placement, camera handle gating), so it is only the non-macOS default.
 */
export const EDITOR_COMMAND_BINDING_DEFAULTS: Record<
	EditorPlatform,
	readonly EditorCommandBinding[]
> = {
	mac: [{ command: 'layout.wall.bend', hold: ['meta'] }],
	other: [{ command: 'layout.wall.bend', hold: ['alt'] }]
};

export const EDITOR_MODIFIER_TOKENS: readonly EditorModifierToken[] = [
	'meta',
	'ctrl',
	'alt',
	'shift'
];

/** The held tokens of one snapshot, in a stable order. */
export function heldEditorModifiers(snapshot: EditorModifierSnapshot): EditorModifierToken[] {
	return EDITOR_MODIFIER_TOKENS.filter((token) => snapshot[token]);
}

/**
 * Resolve the commands live for one modifier snapshot. Pure and total: the
 * same snapshot, platform and bindings always answer the same set, and no
 * state is retained between calls.
 */
export function resolveEditorCommandIntent(
	snapshot: EditorModifierSnapshot,
	platform: EditorPlatform,
	bindings: readonly EditorCommandBinding[] = EDITOR_COMMAND_BINDING_DEFAULTS[platform]
): ReadonlySet<EditorCommandId> {
	const held = heldEditorModifiers(snapshot);
	const commands = new Set<EditorCommandId>();
	for (const binding of bindings) {
		// Exact match: same members, same count. A duplicate token in `hold`
		// therefore cannot match a single held modifier.
		const required = new Set(binding.hold);
		if (required.size !== held.length) continue;
		if (!held.every((token) => required.has(token))) continue;
		commands.add(binding.command);
	}
	return commands;
}

/**
 * Platform detection for the default binding table. The caller passes its
 * source (normally `navigator`, absent under SSR/tests) so the pure resolver
 * above stays environment-free and this stays injectable.
 */
export function resolveEditorPlatform(
	source?: { platform?: string | null; userAgent?: string | null } | null
): EditorPlatform {
	const platform = source?.platform ?? '';
	if (/mac|iphone|ipad|ipod/i.test(platform)) return 'mac';
	const userAgent = source?.userAgent ?? '';
	if (/mac os x|iphone|ipad/i.test(userAgent)) return 'mac';
	return 'other';
}
