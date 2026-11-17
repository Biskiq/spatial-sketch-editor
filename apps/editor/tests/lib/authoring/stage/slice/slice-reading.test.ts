/**
 * SL1 test 2: the live reading is session state.
 *
 * The point of these assertions is *absence*: no serialization hook, no history
 * entry, no project import. A store can pass every behavioural test and still be a
 * defect if it is reachable from a save path, so the source is read and checked the
 * same way `material-factory-boundary` checks the material constructors.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';

function sourceOf(module: string): string {
	return readFileSync(
		fileURLToPath(new URL(`../../../../../src/lib/authoring/stage/slice/${module}.ts`, import.meta.url)),
		'utf8'
	);
}

describe('sliceReading', () => {
	it('starts off and replaces the live reading', () => {
		sliceReading.clear();
		expect(sliceReading.isActive()).toBe(false);
		sliceReading.level();
		expect(sliceReading.reading).toEqual({ kind: 'level', depth: { kind: 'to-floor' } });
		sliceReading.level({ kind: 'below', meters: 0.7 });
		expect(sliceReading.reading).toEqual({ kind: 'level', depth: { kind: 'below', meters: 0.7 } });
	});

	it('puts the reading back and clears it without a control', () => {
		sliceReading.level();
		sliceReading.setDepth({ kind: 'below', meters: 0.3 });
		expect(sliceReading.reading).toEqual({ kind: 'level', depth: { kind: 'below', meters: 0.3 } });
		sliceReading.putBack();
		expect(sliceReading.reading).toBeNull();
		sliceReading.level();
		sliceReading.clear();
		expect(sliceReading.reading).toBeNull();
	});

	it('ignores a depth change with no reading', () => {
		sliceReading.clear();
		sliceReading.setDepth({ kind: 'below', meters: 1 });
		expect(sliceReading.reading).toBeNull();
	});

	it('has no serialization surface', () => {
		// Comments are prose; only executable code can serialize.
		const source = sourceOf('slice-reading.svelte').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
		expect(source).not.toMatch(/toJSON|serialize|JSON\.stringify/);
		// Session state never reaches a document, a history entry or the visitor.
		expect(source).not.toMatch(/project-model|project-codec|visitor/i);
	});

	it('keeps the whole slice folder out of the visitor and release surface', () => {
		for (const module of ['slice-cut', 'slice-reading.svelte', 'slice-ghost', 'stage-clip']) {
			const source = sourceOf(module);
			expect(source).not.toMatch(/from '@portfolio\/project-model/);
			expect(source).not.toMatch(/VisitorPreviewSurface|VisitorLayoutShell/);
		}
	});
});
