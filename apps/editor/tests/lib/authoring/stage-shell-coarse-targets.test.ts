/**
 * R217.S21 — coarse-pointer targets for the Card and the Index.
 *
 * Under a coarse pointer every control the Card and the Index draw reaches 44 × 44 CSS px.
 * The fine-pointer density (32 px) stays. Like S20's shell tests, the rule is asserted in the
 * component source; the measured sizes under touch emulation are in the evidence folder.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function coarseBlockOf(source: string): string {
	const match = source.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\t\}/);
	if (match === null) throw new Error('the component has no coarse-pointer block');
	return match[1]!;
}

describe('Card and Index coarse-pointer targets (R217.S21)', () => {
	it('gives every Card control 44 × 44 CSS px under a coarse pointer and keeps the 32 px fine density', () => {
		const source = readFileSync('src/lib/authoring/stage/shell/EditorCard.svelte', 'utf8');
		const block = coarseBlockOf(source);
		for (const selector of ['.icon', '.action', '.rename input', 'summary']) {
			expect(block).toContain(selector);
		}
		expect(block).toMatch(/min-width:\s*var\(--shell-touch-target, 44px\)/);
		expect(block).toMatch(/min-height:\s*var\(--shell-touch-target, 44px\)/);
		expect(source).toMatch(/\.action \{[^}]*min-height: var\(--shell-control-height, 32px\)/);
	});

	it('gives every Index row, Actions toggle, disclosed operation and search field 44 × 44 CSS px', () => {
		const source = readFileSync('src/lib/authoring/stage/shell/EditorIndex.svelte', 'utf8');
		const block = coarseBlockOf(source);
		for (const selector of ['.item-row', '.item-actions-toggle', '.op', '.search-input']) {
			expect(block).toContain(selector);
		}
		expect(block).toMatch(/min-width:\s*var\(--shell-touch-target, 44px\)/);
		expect(block).toMatch(/min-height:\s*var\(--shell-touch-target, 44px\)/);
		expect(source).toMatch(/\.item-row \{[^}]*min-height: var\(--shell-control-height, 32px\)/);
	});
});

describe('Ink row and instrument host coarse-pointer targets (R217.S23)', () => {
	it('gives the instrument info and close controls 44 × 44 CSS px under a coarse pointer', () => {
		const source = readFileSync('src/lib/authoring/stage/shell/StageInstrumentHost.svelte', 'utf8');
		const block = coarseBlockOf(source);
		expect(block).toContain('.close');
		expect(block).toContain('.about');
		expect(block).toMatch(/min-width:\s*var\(--shell-touch-target, 44px\)/);
		expect(block).toMatch(/min-height:\s*var\(--shell-touch-target, 44px\)/);
	});

	it('gives every Ink key, typed field and the typed submit 44 × 44 CSS px, and leaves the hidden radio alone', () => {
		const source = readFileSync('src/lib/authoring/adapters/layout/LayoutInkPalette.svelte', 'utf8');
		const block = coarseBlockOf(source);
		for (const selector of ['.key', 'input:not(.radio)', '.typed-point button']) {
			expect(block).toContain(selector);
		}
		expect(block).toMatch(/min-width:\s*var\(--shell-touch-target, 44px\)/);
		expect(block).toMatch(/min-height:\s*var\(--shell-touch-target, 44px\)/);
		expect(source).toMatch(/\.key \{[^}]*min-height: var\(--shell-control-height, 32px\)/);
	});
});
