/**
 * P23.13 S9 (step 4) — seven-surround check (§9): paper and semantic palette
 * stay constant across all seven shell themes.
 *
 * Minimum review set: navy-blue (darkest default), porcelain-atelier (lightest
 * — the only light identity), electric-plum (most saturated); then all seven
 * by construction (no theme block may override any `--editor-plan-*` token).
 * This also closes the S9-step-1 Scene-ink eyeball seam: the resting Scene
 * outline weight is per-primitive opacity (regime/zone), never theme color —
 * pinned in `p23-13-object-scene-paint` — so theme invariance of the palette
 * is the whole surround claim.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function readStyleSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

const tokens = readStyleSource('editor/styles/tokens.css');
// Theme override blocks only (appended at the end per the file header).
const blocks = tokens.slice(tokens.indexOf('Theme override blocks'));

describe('P23.13 S9 seven surrounds (§9)', () => {
	it('ships all seven shell themes with the reviewed minimum among them', () => {
		// navy-blue is the :root default (no override block); the other six
		// carry additive blocks. Registry truth lives in theme.svelte.ts.
		const registry = readStyleSource('editor/theme.svelte.ts');
		for (const id of [
			'navy-blue',
			'salon-espresso',
			'electric-plum',
			'acid-moss',
			'porcelain-atelier',
			'synth-sunset',
			'velvet-kodachrome'
		]) {
			expect(registry).toContain(`'${id}'`);
		}
		for (const id of [
			'salon-espresso',
			'electric-plum',
			'acid-moss',
			'porcelain-atelier',
			'synth-sunset',
			'velvet-kodachrome'
		]) {
			expect(blocks).toContain(`[data-theme='${id}']`);
		}
		// Minimum set: darkest default, lightest (only light), most saturated.
		expect(registry).toContain("'navy-blue'");
		expect(registry).toContain("'porcelain-atelier'");
		expect(registry).toContain("'electric-plum'");
	});

	it('holds paper and selection constant (no theme block touches plan tokens)', () => {
		expect(tokens).toContain('--editor-plan-bg: #f5f7f8');
		expect(tokens).toContain('--editor-plan-selection: #2f8cff');
		expect(blocks).not.toContain('--editor-plan-');
	});

	it('keeps the Scene-ink weight theme-independent (opacity, never theme color)', () => {
		const planSvg = readStyleSource('editor/layout/PlanSvg.svelte');
		// The regime/zone fraction rides opacity on the resting style only.
		expect(planSvg).toContain('presentation.sceneInkFor?.(primitive) ?? presentation.sceneInk');
		expect(planSvg).toContain("if (primitive.style !== 'scene-footprint') return undefined;");
	});
});
