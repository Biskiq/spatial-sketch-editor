/**
 * The F.2 entries' import closure and inactivity — an architecture boundary.
 *
 * Two invariants live here, and neither can be seen by a lane, a build or a type
 * check:
 *
 * 1. **The delivery-only program closure.** AM-6 requires `ExecutionProgram@1`'s
 *    standalone entry to import delivery validation only, so a prepared release
 *    can import the program codec without dragging in a source codec, the Layout
 *    compiler, the package root barrel, a Camera evaluator or Three. The closure
 *    is asserted as an exact set: a new import is a deliberate change, not a
 *    silent widening.
 * 2. **Inactivity before the cutover.** The unit envelope, the program codec, the
 *    migration converter and the additive unit-resolution extension must be
 *    reachable only through their own subpaths: nothing in the package root
 *    barrel and nothing in the editor or visitor application imports them before
 *    `T3.P01.S04` activates them. A public route that pulled the migration
 *    converter into a visitor chunk is exactly what this catches.
 *
 * It reads sources rather than behaviour because no executable harness can
 * observe an import that must not exist.
 */
import { readFileSync } from 'node:fs';
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

const INACTIVE_MODULES = [
	path.join(PROJECT_MODEL_SRC, 'units/index.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/types.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/identity.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/canonical.ts'),
	path.join(PROJECT_MODEL_SRC, 'units/validate.ts'),
	path.join(PROJECT_MODEL_SRC, 'program/index.ts'),
	path.join(PROJECT_MODEL_SRC, 'program/types.ts'),
	path.join(PROJECT_MODEL_SRC, 'program/validate.ts'),
	path.join(PROJECT_MODEL_SRC, 'migration/index.ts'),
	path.join(PROJECT_MODEL_SRC, 'migration/types.ts'),
	path.join(PROJECT_MODEL_SRC, 'migration/convert.ts'),
	path.join(PROJECT_MODEL_SRC, 'references/unit-resolution.ts')
];

const INACTIVE_SUBPATHS = [
	'@portfolio/project-model/units',
	'@portfolio/project-model/program',
	'@portfolio/project-model/migration',
	'@portfolio/project-model/references/unit-resolution'
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

describe('the F.2 entries stay inactive before the cutover', () => {
	it('is unreachable from the package root barrel', () => {
		const closure = importClosure([path.join(PROJECT_MODEL_SRC, 'index.ts')]);
		for (const module of INACTIVE_MODULES) {
			expect(closure.has(module), relativeToRepo(module)).toBe(false);
		}
	});

	it('is imported by no editor or visitor source', () => {
		for (const file of listSourceFiles(EDITOR_SRC)) {
			if (!/\.(ts|svelte|js)$/.test(file)) continue;
			const specifiers = parseModuleSpecifiers(readFileSync(file, 'utf8'));
			for (const specifier of specifiers) {
				for (const subpath of INACTIVE_SUBPATHS) {
					expect(specifier === subpath || specifier.startsWith(`${subpath}/`), `${relativeToRepo(file)} imports ${specifier}`).toBe(
						false
					);
				}
			}
		}
	});

	it('exposes each entry through an explicit package subpath', () => {
		const manifest = JSON.parse(readFileSync(path.join(PACKAGES_ROOT, 'project-model/package.json'), 'utf8')) as {
			exports: Record<string, unknown>;
		};
		for (const subpath of ['.', './units', './program', './migration', './references/unit-resolution']) {
			expect(Object.keys(manifest.exports), subpath).toContain(subpath);
		}
	});
});


// The shared closure helper resolves workspace subpaths to their root barrel.
// Check incoming edges as well, including relative imports and API sources.
const inactiveRoots = ['units', 'program', 'migration', 'references/unit-resolution']
	.map((relative) => path.join(PROJECT_MODEL_SRC, relative));
function isInactivePath(file: string): boolean {
	const stem = file.replace(/\.(ts|js|mjs)$/, '');
	return inactiveRoots.some((root) => stem === root || stem.startsWith(`${root}${path.sep}`));
}
function reachesInactive(importer: string, specifier: string): boolean {
	const target = specifier.split('?')[0]!;
	return INACTIVE_SUBPATHS.some((subpath) => target === subpath || target.startsWith(`${subpath}/`)) ||
		(target.startsWith('.') && isInactivePath(path.resolve(path.dirname(importer), target)));
}

it('rejects inactive imports through API, other packages, relative paths and subpath aliases', () => {
	for (const root of [EDITOR_SRC, path.join(REPO_ROOT, 'apps/api/src'), PACKAGES_ROOT]) {
		for (const file of listSourceFiles(root)) {
			if (!/\.(ts|svelte|js|mjs)$/.test(file) || !file.includes(`${path.sep}src${path.sep}`) || isInactivePath(file)) continue;
			for (const specifier of parseModuleSpecifiers(readFileSync(file, 'utf8'))) {
				expect(reachesInactive(file, specifier), `${relativeToRepo(file)} imports ${specifier}`).toBe(false);
			}
		}
	}
});

it('recognizes relative and dynamic entry bypasses as forbidden incoming edges', () => {
	for (const specifier of parseModuleSpecifiers("import('../program/index.js'); export * from './units/validate';")) {
		const importer = specifier.startsWith('../') ? path.join(PROJECT_MODEL_SRC, 'other/adapter.ts') : path.join(PROJECT_MODEL_SRC, 'index.ts');
		expect(reachesInactive(importer, specifier)).toBe(true);
	}
	expect(reachesInactive(path.join(REPO_ROOT, 'apps/api/src/app.ts'), '@portfolio/project-model/migration')).toBe(true);
	expect(reachesInactive(path.join(PROJECT_MODEL_SRC, 'index.ts'), './references/index')).toBe(false);
});
