/**
 * T1.P02.S01 §1 boundary — the allocators that are NOT capture-derived stay
 * unreachable from any accepted operation.
 *
 * Two allocators remain occupancy-derived on purpose: `nextWallCurveKnotId`
 * (`{wallId}:knot:{n}`) and `nextInteriorAnchorId` (`{segmentId}:anchor:{n}`).
 * That exclusion is legitimate only while no accepted intent reaches the
 * planners that call them, because counting occupancy after a deletion can
 * re-mint an identity an earlier operation already retired. The slice's
 * acceptance record states the condition and its retirement; this test makes it
 * enforced rather than remembered: wiring any of these planners into the editor
 * or the project model fails here first, which is the point at which the
 * curve-authoring slice must take the capture instead.
 *
 * A call-site fact: nothing imports these names today, no type check or build
 * fails if one import is added, and the editor's source closure cannot reveal
 * an uncalled planner. Only a source scan can hold the guarantee.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const editorSrc = resolve(here, '../../../src');
const repoRoot = resolve(here, '../../../../..');

/**
 * The occupancy-derived allocators and the planners that call them. Reaching any
 * of them from production code without a capture is the hazard §1 removes.
 */
const UNCAPTURED_IDENTITY_NAMES = [
	'nextWallCurveKnotId',
	'nextInteriorAnchorId',
	'planConvertWallToCurve',
	'planInsertWallCurveKnot',
	'planBendWallCurveKnot',
	'planDissolveJunction'
] as const;

const SOURCE_ROOTS = [editorSrc, resolve(repoRoot, 'packages/project-model/src')];

function walk(dir: string): string[] {
	const files: string[] = [];
	for (const name of readdirSync(dir)) {
		const entry = resolve(dir, name);
		if (statSync(entry).isDirectory()) files.push(...walk(entry));
		else if (['.ts', '.svelte'].includes(extname(entry))) files.push(entry);
	}
	return files;
}

describe('T1.P02.S01 §1 identity boundary', () => {
	it('no production caller reaches an occupancy-derived identity allocator', () => {
		const offenders: string[] = [];
		for (const root of SOURCE_ROOTS) {
			for (const file of walk(root)) {
				if (file.includes('.test.') || file.includes(`node_modules`)) continue;
				const source = readFileSync(file, 'utf8');
				for (const name of UNCAPTURED_IDENTITY_NAMES) {
					if (new RegExp(`\\b${name}\\b`).test(source)) {
						offenders.push(`${file.slice(repoRoot.length + 1)}: ${name}`);
					}
				}
			}
		}
		// A failure here is not "delete the test": it means an operation can now
		// reach an id that is not captured. Take a capture (layout-id-capture.ts)
		// and derive the id from it before wiring that intent.
		expect(offenders).toEqual([]);
	});
});
