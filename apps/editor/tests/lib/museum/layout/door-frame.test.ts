import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOOR_FRAME_FACE_INSET_METERS, doorFrameBoxes } from '$lib/museum/layout/door-frame';

const CASES = [
	{ width: 1, height: 2.1, wallThickness: 0.2 },
	{ width: 1, height: 2.1, wallThickness: 0.1 },
	{ width: 1, height: 2.1, wallThickness: 0.4 },
	{ width: 0.9, height: 2.9, wallThickness: 0.2 }
];

describe('a door frame stays inside its Opening', () => {
	it.each(CASES)('$width × $height in a $wallThickness m Wall', (input) => {
		const boxes = doorFrameBoxes(input);
		expect(boxes).toHaveLength(3);
		for (const { center, size } of boxes) {
			expect(Math.abs(center[0]) + size[0] / 2).toBeLessThanOrEqual(input.width / 2 + 1e-9);
			expect(center[1] - size[1] / 2).toBeGreaterThanOrEqual(-1e-9);
			expect(center[1] + size[1] / 2).toBeLessThanOrEqual(input.height + 1e-9);
			// Short of the Wall's faces, so neither protrudes nor fights them.
			expect(size[2]).toBeCloseTo(input.wallThickness - 2 * DOOR_FRAME_FACE_INSET_METERS, 9);
		}
	});

	it('draws nothing it cannot fit', () => {
		expect(doorFrameBoxes({ width: 1, height: 2, wallThickness: 0.002 })).toEqual([]);
		expect(doorFrameBoxes({ width: 0.05, height: 2, wallThickness: 0.2 })).toEqual([]);
	});

	it('frames only rectangular doors, at their sill, from the Wall they sit in', () => {
		const shell = readFileSync(resolve(process.cwd(), 'src/lib/visitor/VisitorLayoutShell.svelte'), 'utf8');
		expect(shell).toContain("opening.kind === 'door' && opening.profile === 'rectangular'");
		expect(shell.match(/wallThickness=\{wall\.thickness\}/g)).toHaveLength(2);
		expect(shell.match(/\+ opening\.sillHeight/g)).toHaveLength(2);
	});
});
