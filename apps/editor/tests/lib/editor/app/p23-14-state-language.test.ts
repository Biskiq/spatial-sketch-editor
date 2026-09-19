import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	PLAN_NUMERIC_FIELD_SETS,
	planNumericFieldAxis
} from '$lib/editor/layout/plan-numeric-entry';

const STYLES_DIR = fileURLToPath(new URL('../../../../src/lib/editor/styles', import.meta.url));

function read(relative: string): string {
	return fs.readFileSync(path.join(STYLES_DIR, relative), 'utf8');
}

/** Body of a `selector { … }` block, without its own nested blocks. */
function block(source: string, selector: string): string {
	const start = source.indexOf(selector);
	expect(start, `${selector} must exist`).toBeGreaterThanOrEqual(0);
	const open = source.indexOf('{', start);
	const close = source.indexOf('}', open);
	return source.slice(open + 1, close);
}

describe('P23.14 §7 — state language', () => {
	const tokens = read('tokens.css');
	const shell = read('editor-shell.css');

	it('declares one named token per ratified state cue', () => {
		for (const token of [
			'editor-focus-ring',
			'editor-focus-ring-width',
			'editor-focus-ring-offset',
			'editor-state-ghost',
			'editor-state-ghost-ink',
			'editor-state-derived-ink',
			'editor-state-refusal',
			'editor-state-refusal-soft',
			'editor-state-refusal-border',
			'editor-state-armed',
			'editor-state-snap',
			'editor-state-disabled-ink',
			'editor-state-active-domain'
		]) {
			expect(tokens, `tokens.css must define --${token}`).toContain(`--${token}:`);
		}
	});

	it('keeps the focus ring independent from the chrome accent', () => {
		// A ring that IS the accent cannot be read as focus on a control that is
		// also selected/active — the whole point of §7's independent ring.
		const root = block(tokens, ':root {');
		const ring = root.match(/--editor-focus-ring:\s*([^;]+);/)?.[1]?.trim();
		const accent = root.match(/--editor-accent:\s*([^;]+);/)?.[1]?.trim();
		expect(ring).toBeTruthy();
		expect(accent).toBeTruthy();
		expect(ring).not.toBe(accent);
		expect(ring).not.toContain('var(--editor-accent');
		// PLATE Light re-authors it for the light Chassis (contrast), not to
		// re-borrow the accent.
		const plate = block(tokens, ":root[data-theme='plate-light'] {");
		expect(plate).toContain('--editor-focus-ring:');
		expect(plate).not.toContain('--editor-focus-ring: var(--editor-accent');
	});

	it('paints keyboard focus as an offset outline, never as outline: none', () => {
		const focus = block(
			shell,
			':is(button, input, select, textarea, [tabindex]):focus-visible {'
		);
		expect(focus).not.toContain('outline: none');
		expect(focus).toContain(
			'outline: var(--editor-focus-ring-width) solid var(--editor-focus-ring)'
		);
		expect(focus).toContain('outline-offset: var(--editor-focus-ring-offset)');
		// The offset is what makes ring and border two separate cues.
		expect(Number(block(tokens, ':root {').match(/--editor-focus-ring-offset:\s*(\d+)px/)?.[1]))
			.toBeGreaterThan(0);
	});
});

describe('P23.14 §7 — canonical axis ink in number fields (#35)', () => {
	const viewport = fs.readFileSync(
		fileURLToPath(
			new URL('../../../../src/lib/editor/layout/LayoutPlanViewport.svelte', import.meta.url)
		),
		'utf8'
	);

	it('marks exactly the axis-valued fields, never a magnitude or an angle', () => {
		// Magnitudes and angles have no axis: painting Width red because it is
		// "a number" would spend the transform axes' spatial meaning on a label.
		for (const host of [
			'rectangle', // Width / Depth
			'wall-chain', // Length / Angle
			'wall-edit', // Length / Angle
			'opening-insert',
			'opening-slide',
			'opening-resize'
		] as const) {
			for (const field of PLAN_NUMERIC_FIELD_SETS[host]) {
				expect(planNumericFieldAxis(field), `${host}/${field.id} has no axis`).toBeNull();
			}
		}
		// One X/Z naming per spatial host; the axis ink binds to it.
		for (const host of ['wall-move', 'junction', 'curve-point'] as const) {
			expect(PLAN_NUMERIC_FIELD_SETS[host].map(planNumericFieldAxis)).toEqual(['x', 'z']);
		}
	});

	it('paints the field label in the axis ink and the value in the mono voice', () => {
		for (const axis of ['x', 'z']) {
			expect(viewport).toContain(
				`.plan-numeric-entry[data-axis='${axis}'] .plan-numeric-entry-label { color: var(--editor-axis-${axis}); }`
			);
		}
		expect(viewport).toContain(
			'font: 600 0.74rem/1.2 var(--editor-font-mono, ui-monospace, monospace)'
		);
		expect(viewport).toContain('data-axis={entryAxis ?? undefined}');
	});
});
