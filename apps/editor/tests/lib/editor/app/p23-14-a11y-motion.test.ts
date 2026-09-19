import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	CONTEXT_MENU_NAV_KEYS,
	enabledMenuItemIndexes,
	resolveMenuItemFocus
} from '$lib/editor/context-menu/context-menu-state.svelte';
import { resolveRovingIndex, tablistTabIndex } from '$lib/editor/app/roving-focus';
import { PLAN_CONTROL_TARGET_COARSE_PX, PLAN_CONTROL_TARGET_PX } from '$lib/layout/plan-control-grammar';

const SRC = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));

function read(relative: string): string {
	return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

/**
 * The shell chrome that lives inside `.project-editor` — the surfaces the
 * coarse-pointer rule is responsible for. Scanned, not hand-listed, so a new
 * component cannot quietly add an uncovered interactive species.
 */
const CHROME_DIRS = ['app', 'hierarchy', 'camera', 'camera-plan', 'layout'] as const;
const CHROME_FILES = ['EditorViewportToolbar.svelte', 'EditorViewportGridControls.svelte'] as const;

function chromeSources(): string[] {
	const fromDirs = CHROME_DIRS.flatMap((dir) =>
		fs
			.readdirSync(path.join(SRC, dir))
			.filter((name) => name.endsWith('.svelte'))
			.map((name) => `${dir}/${name}`)
	);
	return [...fromDirs, ...CHROME_FILES];
}

/** Selector text in the coarse-pointer rule → the markup that mounts that species. */
const CHROME_SPECIES: ReadonlyArray<readonly [selector: string, marker: string]> = [
	['button', '<button'],
	['a[href]', '<a href'],
	["[role='tab']", 'role="tab"'],
	["[role='menuitem']", 'role="menuitem'],
	['select', '<select'],
	['input', '<input'],
	['summary', '<summary']
];

/** Body of a `selector { … }` block, nested blocks included. */
function block(source: string, selector: string): string {
	const start = source.indexOf(selector);
	expect(start, `${selector} must exist`).toBeGreaterThanOrEqual(0);
	const open = source.indexOf('{', start);
	let depth = 1;
	let cursor = open + 1;
	while (cursor < source.length && depth > 0) {
		if (source[cursor] === '{') depth += 1;
		else if (source[cursor] === '}') depth -= 1;
		cursor += 1;
	}
	return source.slice(open + 1, cursor - 1);
}

const item = (id: string, options: { disabledReason?: string } = {}) => ({
	id,
	label: id,
	run: () => {},
	...options
});

describe('P23.14 §23 #38 — one menu keyboard model', () => {
	it('walks enabled items only, wrapping at both ends', () => {
		const items = [item('a'), item('b', { disabledReason: 'Refused' }), item('c')];
		expect(enabledMenuItemIndexes(items)).toEqual([0, 2]);
		// The disabled item keeps its slot (its reason text is the point) but is
		// never a focus stop: b is skipped in both directions.
		expect(resolveMenuItemFocus(items, 0, 'ArrowDown')).toBe(2);
		expect(resolveMenuItemFocus(items, 2, 'ArrowDown')).toBe(0);
		expect(resolveMenuItemFocus(items, 0, 'ArrowUp')).toBe(2);
		expect(resolveMenuItemFocus(items, 2, 'ArrowUp')).toBe(0);
	});

	it('resolves Home/End to the ends of the enabled list, never a refused item', () => {
		const items = [item('a', { disabledReason: 'Refused' }), item('b'), item('c', { disabledReason: 'Refused' })];
		expect(resolveMenuItemFocus(items, 1, 'Home')).toBe(1);
		expect(resolveMenuItemFocus(items, 1, 'End')).toBe(1);
	});

	it('enters in the direction of travel when nothing is focused yet', () => {
		const items = [item('a', { disabledReason: 'Refused' }), item('b'), item('c')];
		// -1 = no focused item (fresh open, or the focused node was replaced).
		expect(resolveMenuItemFocus(items, -1, 'ArrowDown')).toBe(1);
		expect(resolveMenuItemFocus(items, -1, 'ArrowUp')).toBe(2);
	});

	it('reports no focus target for a fully refused menu', () => {
		expect(resolveMenuItemFocus([item('a', { disabledReason: 'x' })], -1, 'ArrowDown')).toBeNull();
		expect(resolveMenuItemFocus([], -1, 'Home')).toBeNull();
		expect(CONTEXT_MENU_NAV_KEYS).toEqual(['ArrowDown', 'ArrowUp', 'Home', 'End']);
	});

	it('owns focus in the shell menu: take on open, return only for keyboard closes', () => {
		const source = read('context-menu/ContextMenu.svelte');
		expect(source).toContain('resolveMenuItemFocus(items, focused, event.key)');
		// Items are addressed by index so roving focus can reach them, and the
		// menu itself is a tabindex=-1 focus sink when every item is refused.
		expect(source).toContain('bind:this={itemElements[index]}');
		expect(source).toContain('tabindex="-1"');
		expect(source).toContain("case 'Tab':");
		// The hit-test that decides "return focus" is the keyboard flag, not the
		// close itself: a pointer close must never move focus.
		expect(source).toContain('const restore = keyboardClose;');
		expect(source).toContain('if (restore && target) void tick().then(() => target.focus());');
		expect(source).toContain('keyboardClose = false;\n\t\t\tstore.close();');
		expect(source).toContain('outline: var(--editor-focus-ring-width) solid var(--editor-focus-ring)');
		expect(source).not.toContain('outline: none;\n\t\tbackground: var(--editor-bg-hover)');
	});
});

describe('P23.14 §23 #39 — one roving-focus model for both tablists', () => {
	it('keeps the axis honest: a strip never answers the perpendicular keys', () => {
		expect(resolveRovingIndex(3, 1, 'ArrowRight', 'horizontal')).toBe(2);
		expect(resolveRovingIndex(3, 2, 'ArrowRight', 'horizontal')).toBe(0);
		expect(resolveRovingIndex(3, 0, 'ArrowLeft', 'horizontal')).toBe(2);
		expect(resolveRovingIndex(3, 1, 'ArrowDown', 'vertical')).toBe(2);
		expect(resolveRovingIndex(3, 0, 'ArrowUp', 'vertical')).toBe(2);
		// A horizontal strip must let Down through — the surface below wants it.
		expect(resolveRovingIndex(3, 0, 'ArrowDown', 'horizontal')).toBeNull();
		expect(resolveRovingIndex(3, 0, 'ArrowUp', 'horizontal')).toBeNull();
		expect(resolveRovingIndex(3, 0, 'ArrowRight', 'vertical')).toBeNull();
		expect(resolveRovingIndex(3, 0, 'Enter', 'horizontal')).toBeNull();
		expect(resolveRovingIndex(0, 0, 'ArrowRight', 'horizontal')).toBeNull();
	});

	it('exposes exactly one tab stop, and it is the selected member', () => {
		expect([0, 1, 2].map((index) => tablistTabIndex(index, 1))).toEqual([-1, 0, -1]);
	});

	it('is consumed by both strips rather than re-implemented per surface', () => {
		for (const [file, tabs] of [
			['app/EditorSidebar.svelte', 'PANEL_TABS'],
			['EditorAssetLibrary.svelte', 'LIBRARY_TABS']
		] as const) {
			const source = read(file);
			// One declared member list per strip, and the shared model is the only
			// thing that decides where an arrow key moves.
			expect(source, `${file} must declare its members once`).toContain(`const ${tabs} = [`);
			expect(source, `${file} must use the shared axis model`).toContain(
				`resolveRovingIndex(${tabs}.length, selected, event.key, 'horizontal')`
			);
			expect(source).toContain(`tablistTabIndex(index, ${tabs}.indexOf(`);
			expect(source).toContain('role="tablist"');
			// Automatic activation: the arrow moves focus and switches the panel,
			// so the ring never sits on an unselected tab.
			expect(source).toContain('?.focus();');
		}
	});
});

describe('P23.14 §23 #40/#41 — popover focus lifecycle', () => {
	it('coordinates the Project Head popovers instead of stacking them', () => {
		const row = read('app/ProjectRow.svelte');
		const documentMenu = block(row, 'function openDocumentMenu() {');
		expect(documentMenu).toContain('projectMenuOpen = true;');
		expect(documentMenu).toContain('themeMenuOpen = false;');
		expect(documentMenu).toContain('accountOpen = false;');
		const themeMenu = block(row, 'function toggleThemeMenu() {');
		expect(themeMenu).toContain('if (!themeMenuOpen) return;');
		expect(themeMenu).toContain('projectMenuOpen = false;');
		expect(themeMenu).toContain('accountOpen = false;');
		const accountMenu = block(row, 'function toggleAccountMenu() {');
		expect(accountMenu).toContain('projectMenuOpen = false;');
		expect(accountMenu).toContain('themeMenuOpen = false;');
		// The save-auth gate opens through the coordinator, so the row can never
		// end up with the Document menu over an open theme menu.
		expect(row).toContain('if (saveAuthGateOpen) openDocumentMenu();');
	});

	it('restores focus to the trigger on Escape, and never as a Tab trap', () => {
		const row = read('app/ProjectRow.svelte');
		expect(row).toContain("if (event.key !== 'Escape') return;");
		expect(row).toContain('void tick().then(() => trigger?.focus());');
		// Members are roving (tabindex -1) so Tab leaves the popover.
		expect(row).toContain('role="menuitemradio"');
		expect(row).toContain('tabindex="-1"');
		for (const panel of ['themeMenuPanelElement', 'accountMenuPanelElement']) {
			expect(row).toContain(`focusFirstPopoverControl(${panel})`);
		}
	});

	it('gives the Document menu the same lifecycle, including external opens', () => {
		const source = read('EditorProjectMenu.svelte');
		expect(source).toContain('function setOpen(next: boolean, options: { restoreFocus?: boolean } = {})');
		expect(source).toContain('const hadFocus = Boolean(menuPanelElement?.contains(document.activeElement));');
		// Pointer close: focus stays where the user aimed it.
		expect(source).toContain('setOpen(false, { restoreFocus: false })');
		expect(source).toContain('void tick().then(() => focusFirstMenuControl());');
		expect(source).toContain('focusFirstMenuControl');
		expect(source).toContain("'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'");
		expect(source).toContain('aria-haspopup="dialog"');
		expect(source).toContain('onkeydown={onMenuPanelKeydown}');
	});
});

describe('P23.14 §23 #34 — readable status ink', () => {
	it('keeps the status rail on the readable text tiers', () => {
		const status = read('app/StatusBar.svelte');
		const base = block(status, '.status-bar {');
		expect(base).toContain('color: var(--editor-text-secondary);');
		expect(base).not.toContain('var(--editor-text-muted)');
		expect(status).toContain('.save-state { color: var(--editor-text-success); }');
		// The success *glyph* family is a different role than success *text*.
		expect(status).not.toContain('color: var(--editor-success)');
	});

	it('ships a success ink that is not the glyph hue and clears AA at 11 px', () => {
		const tokens = read('styles/tokens.css');
		const plate = block(tokens, ":root[data-theme='plate-light'] {");
		// The default theme is what the status rail actually paints on.
		const successInk = plate.match(/--editor-text-success:\s*light-dark\(([^,]+),/)?.[1]?.trim();
		const successGlyph = plate.match(/--editor-success:\s*([^;]+);/)?.[1]?.trim();
		expect(successInk).toBeTruthy();
		expect(successGlyph).toBeTruthy();
		expect(successInk).not.toBe(successGlyph);
		// 4.8:1 on the PLATE Light Chassis #D9DDE0 — the shared #15803D measured
		// 3.7:1 and failed at the 11 px status size.
		const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
		const luminance = ([r, g, b]: number[]) => {
			const channel = (value: number) =>
				value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
		};
		// The Chassis the status rail sits on: `--editor-bg-app: #d9dde0`.
		expect(plate).toContain('--editor-bg-app: #d9dde0;');
		const chassis = [0.851, 0.867, 0.878];
		const ink = rgb(successInk!);
		const ratio =
			(Math.max(luminance(chassis), luminance(ink)) + 0.05) /
			(Math.min(luminance(chassis), luminance(ink)) + 0.05);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});
});

describe('P23.14 §23 — motion, pointer and progressive density', () => {
	it('disables chrome transitions under prefers-reduced-motion, relic untouched', () => {
		const shell = read('styles/editor-shell.css');
		const reduced = block(shell, '@media (prefers-reduced-motion: reduce) {');
		expect(reduced).toContain('.editor-page *');
		expect(reduced).toContain('transition-duration: 0.01ms !important;');
		expect(reduced).toContain('animation-duration: 0.01ms !important;');
		expect(reduced).not.toContain('display: none');
		// The frozen relic owns its own chrome; the shell preference stops at the
		// editor page.
		expect(reduced).not.toContain('.relic');
	});

	it('raises every chrome target to 44 px on coarse pointers, by species', () => {
		const tokens = read('styles/tokens.css');
		expect(block(tokens, ':root {')).toContain('--editor-touch-target-min: 44px;');
		const shell = read('styles/editor-shell.css');
		const coarse = block(shell, '@media (pointer: coarse) {');
		for (const band of [
			'--editor-appbar-height: var(--editor-touch-target-min);',
			'--editor-project-row-height: var(--editor-touch-target-min);',
			'--editor-viewbar-height: var(--editor-touch-target-min);'
		]) {
			expect(coarse).toContain(band);
		}
		expect(coarse).toContain('.tree-row');
		expect(coarse).toContain('min-height: var(--editor-touch-target-min);');
		// The canvas answers to its own grammar, which already grows the
		// acquisition radius for coarse pointers.
		expect(coarse).not.toContain('.plan-canvas');
		expect(PLAN_CONTROL_TARGET_COARSE_PX).toBeGreaterThan(PLAN_CONTROL_TARGET_PX);

		// The promise is "every chrome target", not "this selector string". The
		// rule is checked by SPECIES: every interactive species the chrome
		// actually mounts must appear in its selector list, so a new <a> or role
		// cannot stay at its 26 px control height while this test stays green.
		// (It did: links were missing from the rule until the Project Head's were
		// measured at the same 26 px as its buttons.)
		const rule = coarse.slice(coarse.indexOf(':is('), coarse.indexOf(') {', coarse.indexOf(':is(')));
		expect(rule).toContain('button');
		const sources = chromeSources().map((relative) => read(relative));
		for (const [selector, marker] of CHROME_SPECIES) {
			const mounted = sources.some((source) => source.includes(marker));
			if (mounted) {
				expect(
					rule,
					`${marker} is mounted in the shell chrome, so the coarse rule must cover ${selector}`
				).toContain(selector);
			}
		}
		// Links are the species that regressed, so pin them explicitly too.
		expect(sources.some((source) => source.includes('<a href'))).toBe(true);
		expect(rule).toContain('a[href]');
	});

	it('sheds Navigator metadata before identity when the column is squeezed', () => {
		const navigator = read('hierarchy/HierarchyNavigator.svelte');
		expect(block(navigator, '\t.tree-scroll {')).toContain('container-type: inline-size;');
		const row = read('hierarchy/HierarchyRow.svelte');
		const dense = block(row, '@container (max-width: 216px) {');
		expect(dense).toContain('.tree-row__meta { display: none; }');
		// Identity, selection and the tree position stay painted.
		expect(dense).not.toContain('.tree-row__label');
		expect(dense).not.toContain('.tree-row__chevron');
		// The measured surface is the scroll track, not the column: reference
		// 268 − 36 chrome = 232 inner (metadata stays), 240 minimum = 204 inner
		// (metadata sheds). A threshold outside that window either hides counts at
		// the reference width or never fires at the documented minimum.
		const threshold = Number(row.match(/@container \(max-width: (\d+)px\)/)?.[1]);
		const referenceInner = 268 - 36;
		const minimumInner = 240 - 36;
		expect(threshold).toBeGreaterThan(minimumInner);
		expect(threshold).toBeLessThan(referenceInner);
		const navigatorTokens = read('styles/tokens.css');
		expect(block(navigatorTokens, '.project-editor {')).toContain('--editor-left-width: 268px;');
	});

	it('keeps the status bar shedding metadata in the same order', () => {
		const status = read('app/StatusBar.svelte');
		expect(status).toContain('@media (max-width: 62rem) {\n\t\t.workspace-status { display: none; }');
		const narrow = status.slice(status.indexOf('@media (max-width: 44rem)'));
		expect(narrow).toContain('.save-state { display: none; }');
		// Location (workspace + view) is the last thing to go, never the first.
		expect(narrow).not.toContain('.workspace ');
	});
});
