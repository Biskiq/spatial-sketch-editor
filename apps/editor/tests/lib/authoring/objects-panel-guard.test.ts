/**
 * R217.S17A guard. S23 presents the Pen and Objects; it adds no control. These
 * pin the removed controls out of the sources that would have to restore them.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../../helpers/import-closure';

const ADAPTERS = resolve(process.cwd(), 'src/lib/authoring/adapters');
const read = (path: string): string => readFileSync(resolve(ADAPTERS, path), 'utf8');

describe('Objects and Pen controls', () => {
	it('keeps Shape out of the Scene adapter reading contribution', () => {
		expect(read('scene.adapter.ts')).not.toMatch(/readings:\s*\[/);
	});

	it('offers no selector, sheet, Flip, depth or Create in the Objects panel', () => {
		const panel = read('scene/SceneTransformInstrument.svelte');
		expect(panel).not.toContain('aria-label="Place object"');
		for (const word of ['Flip side', 'Upright', 'Depth (m)', '>Create<']) expect(panel).not.toContain(word);
	});

	it('leaves no upright or depth path in the draw session', () => {
		const session = read('scene/shape/draw-session.ts');
		for (const word of ["'elevation'", 'flipSide', 'setDepth']) expect(session).not.toContain(word);
	});

	it('offers no Shape, Round or Sketch reading in the Ink palette (O10)', () => {
		const palette = stripComments(readFileSync(resolve(ADAPTERS, 'layout/LayoutInkPalette.svelte'), 'utf8'));
		for (const word of ['Shape', 'Round', 'Sketch']) expect(palette).not.toContain(word);
	});
});
