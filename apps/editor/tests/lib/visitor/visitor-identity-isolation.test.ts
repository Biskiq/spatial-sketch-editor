/**
 * P23.12 S8 — the C11 visitor check (code/consumption based).
 *
 * The visitor does not consume, render, mutate or import editor
 * display-identity logic:
 *
 * - no visitor module imports the identity layer or the editor identity view;
 * - no reference/name string is rendered in visitor output;
 * - a released document carrying inert `identity`/`name` metadata still
 *   validates on the visitor path;
 * - a released document without the blocks still validates.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	validateWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

const LINE = { kind: 'line' } as const;

function squareDocument(withMetadata: boolean): LayoutDocumentWallFirst {
	const base: LayoutDocumentWallFirst = {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [],
		objects: []
	};
	if (!withMetadata) return base;
	return {
		...base,
		identity: {
			cursor: 4,
			rooms: { room: 'R-2QUS' },
			junctions: { A: 'J-5AEX', B: 'J-7V24', C: 'J-AEM9', D: 'J-CZ7E' },
			walls: { w1: 'W-FJSK', w2: 'W-J5CR', w3: 'W-MPXW', w4: 'W-Q9J3' },
			openings: {}
		},
		walls: base.walls.map((wall, index) => ({ ...wall, name: index === 0 ? 'North' : undefined }))
	};
}

function collectFiles(directory: string, extension: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(directory)) {
		const full = join(directory, entry);
		if (statSync(full).isDirectory()) out.push(...collectFiles(full, extension));
		else if (full.endsWith(extension)) out.push(full);
	}
	return out;
}

describe('P23.12 C11 — visitor isolation from display identity', () => {
	const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');
	const VISITOR_DIR = join(APP, 'lib', 'visitor');

	it('no visitor module imports the identity layer or the identity view', () => {
		const files = collectFiles(VISITOR_DIR, '.ts').concat(collectFiles(VISITOR_DIR, '.svelte'));
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const text = readFileSync(file, 'utf8');
			expect(text, file).not.toMatch(/layout-identity|layout-identity-view|referenceFor|identityHighWater/);
		}
	});

	it('no reference/name token renders in visitor output', () => {
		const files = collectFiles(VISITOR_DIR, '.ts').concat(collectFiles(VISITOR_DIR, '.svelte'));
		for (const file of files) {
			const text = readFileSync(file, 'utf8');
			// No R/W/O/J reference formatting and no authored Wall/Opening name read.
			expect(text, file).not.toMatch(/formatLayoutReference|identity\?\.\w+|\.identity\b/);
		}
	});

	it('a released document with inert identity/name metadata still validates', () => {
		const validated = validateWallFirstLayoutDocument(squareDocument(true));
		expect(validated.success).toBe(true);
		// And it round-trips through serialization (the release path).
		const serialized = serializeWallFirstLayoutDocument(squareDocument(true));
		expect(JSON.parse(serialized)).toBeTruthy();
	});

	it('a released document without the blocks still validates', () => {
		const validated = validateWallFirstLayoutDocument(squareDocument(false));
		expect(validated.success).toBe(true);
	});
});
