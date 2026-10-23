/**
 * The F.2 entries' import closure — an architecture boundary.
 *
 * Two invariants live here, and neither can be seen by a lane, a build or a type
 * check:
 *
 * 1. **The delivery-only program closure.** AM-6 requires `ExecutionProgram@2`'s
 *    standalone entry to import delivery validation only, so a prepared release
 *    can import the program codec without dragging in a source codec, the Layout
 *    compiler, the package root barrel, a Camera evaluator or Three. The closure
 *    is asserted as an exact set: a new import is a deliberate change, not a
 *    silent widening.
 * 2. **One active source entry, no converter.** After `T3.P01.S04`, the unit
 *    envelope is the active source and is still reached only through its own
 *    subpath, never the root barrel. The AM-7 converter is retired: no package
 *    export, no source module and no importer may survive. `./program` keeps its
 *    delivery-only closure and is never re-exported from the root barrel.
 *
 * It reads sources rather than behaviour because no executable harness can
 * observe an import that must not exist.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_SRC,
	PACKAGES_ROOT,
	REPO_ROOT,
	importClosure,
	listSourceFiles,
	parseModuleSpecifiers,
	relativeToRepo
} from '../../helpers/import-closure';

const PROJECT_MODEL_SRC = path.join(PACKAGES_ROOT, 'project-model/src');

const SUBPATH_ONLY_MODULES = [
	path.join(PROJECT_MODEL_SRC, 'units/index.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/types.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/identity.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/canonical.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/validate.ts'),
	path.join(PROJECT_MODEL_SRC, 'program/index.ts'),
	path.join(PROJECT_MODEL_SRC, 'program/types.ts'),
	path.join(PROJECT_MODEL_SRC, 'program/validate.ts'),
	path.join(PROJECT_MODEL_SRC, 'references/unit-resolution.ts'),
	path.join(PROJECT_MODEL_SRC, 'scene-planning/index.ts')
];

function closureOf(entry: string): string[] {
	return [...importClosure([entry])].map(relativeToRepo).sort();
}

describe('the delivery-only ExecutionProgram entry', () => {
	it('closes over the program modules and the shared strict-shape primitive, and nothing else', () => {
		expect(closureOf(path.join(PROJECT_MODEL_SRC, 'program/index.ts'))).toEqual(
			[
				'packages/project-model/src/program/index.ts',
				'packages/project-model/src/program/types.ts',
				'packages/project-model/src/program/validate.ts',
				'packages/project-model/src/strict-shape.ts'
			].sort()
		);
	});

	it('reaches no source codec, compiler, root barrel, camera evaluator or renderer', () => {
		// `program/index.ts` is the entry under test, so the barrel rule is the
		// package's **root** barrel (`src/index.ts`), never every nested `index.ts`.
		const forbidden =
			/(^|\/)(src\/index\.ts$|scene-codec\/|project-codec\.ts|scene\.ts|runtime\.ts|layout-core|camera-core)|(@portfolio\/project-model$)|(^|\/)(three|svelte|@threlte)/;
		for (const file of closureOf(path.join(PROJECT_MODEL_SRC, 'program/index.ts'))) {
			expect(forbidden.test(file), file).toBe(false);
		}
	});
});

describe('the retired converter and the active source entry', () => {
	it('has no migration module, export or importer', () => {
		expect(existsSync(path.join(PROJECT_MODEL_SRC, 'migration'))).toBe(false);
		const manifest = JSON.parse(readFileSync(path.join(PACKAGES_ROOT, 'project-model/package.json'), 'utf8')) as {
			exports: Record<string, unknown>;
		};
		expect(Object.keys(manifest.exports)).not.toContain('./migration');
		for (const root of [EDITOR_SRC, path.join(REPO_ROOT, 'apps/api/src'), PACKAGES_ROOT]) {
			for (const file of listSourceFiles(root)) {
				if (!/\.(ts|svelte|js|mjs)$/.test(file) || !file.includes(`${path.sep}src${path.sep}`)) continue;
				for (const specifier of parseModuleSpecifiers(readFileSync(file, 'utf8'))) {
					expect(specifier, relativeToRepo(file)).not.toContain('project-model/migration');
					expect(specifier, relativeToRepo(file)).not.toContain('/migration/');
				}
			}
		}
	});

	it('keeps the unit envelope off the package root barrel', () => {
		const closure = importClosure([path.join(PROJECT_MODEL_SRC, 'index.ts')]);
		for (const module of SUBPATH_ONLY_MODULES) {
			expect(closure.has(module), relativeToRepo(module)).toBe(false);
		}
	});

	it('exposes the active source through an explicit package subpath', () => {
		const manifest = JSON.parse(readFileSync(path.join(PACKAGES_ROOT, 'project-model/package.json'), 'utf8')) as {
			exports: Record<string, unknown>;
		};
		for (const subpath of [
			'.',
			'./units',
			'./program',
			'./references/unit-resolution',
			'./save',
			'./scene-planning'
		]) {
			expect(Object.keys(manifest.exports), subpath).toContain(subpath);
		}
	});
});
