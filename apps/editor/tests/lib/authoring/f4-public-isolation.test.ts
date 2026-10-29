/**
 * PR #127 decision 5 — the F.4 split is proven by module graph, not by
 * tree-shaking.
 *
 * `@portfolio/project-model` has one root export, and the public route's module
 * graph includes it: the public-surface boundary checks that graph by path. So
 * the shared AM-4 contracts and the current-source admission are allowed — and
 * expected — to be *reachable* from the public route, while the acceptance
 * coordinator and its 100-entry history are editor machinery that must not be.
 *
 * The walk uses the shared closure reader (`tests/helpers/import-closure.ts`,
 * `tests/README.md` rule 7), so the roots, aliases and specifier families are the
 * same ones every other boundary suite resolves. The positive controls below are
 * what keep the absence assertion from passing on an empty walk: the public route
 * root must be a member, and the closure must actually reach the shared F4
 * package modules.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITOR_SRC, importClosure, relativeToRepo } from '../../helpers/import-closure';

const PUBLIC_ROUTE_ROOT = join(EDITOR_SRC, 'routes', 'p', '[publicationId]', '+page.svelte');
const EDITOR_F4_DIR = join(EDITOR_SRC, 'lib', 'authoring', 'f4');
const COORDINATOR = join(EDITOR_F4_DIR, 'acceptance-coordinator.ts');
const SAVE_STATE = join(EDITOR_SRC, 'lib', 'authoring', 'save', 'save-state.ts');
const SAVE_CLIENT = join(EDITOR_SRC, 'lib', 'platform', 'project-persistence.ts');

describe('F.4 editor-only isolation', () => {
	it('keeps browser-local editor preferences out of visitor and public import closures', () => {
		const preferences = join(EDITOR_SRC, 'lib', 'platform', 'app-preferences.ts');
		expect(existsSync(preferences)).toBe(true);
		const preview = join(EDITOR_SRC, 'lib', 'visitor', 'VisitorPreviewSurface.svelte');
		for (const root of [PUBLIC_ROUTE_ROOT, preview]) {
			const reached = importClosure([root]);
			expect(reached.has(root)).toBe(true);
			expect(reached.has(preferences)).toBe(false);
		}
	});
	it('keeps the acceptance coordinator and its history out of the public route closure', () => {
		expect(existsSync(COORDINATOR), 'the coordinator must exist for this proof to mean anything').toBe(true);

		const reached = [...importClosure([PUBLIC_ROUTE_ROOT])].map(relativeToRepo);

		// Positive controls: the walk is real and non-trivial.
		expect(reached).toContain('apps/editor/src/routes/p/[publicationId]/+page.svelte');
		expect(
			reached.some((file) => file.startsWith('packages/project-model/src/f4/')),
			'the shared F.4 contract must stay reachable from the public route'
		).toBe(true);

		// The guarantee: no editor authoring machinery, and nothing of this slice's
		// editor half, is on the public path.
		expect(reached.filter((file) => file.startsWith('apps/editor/src/lib/authoring/'))).toEqual([]);
		// T3.P01.S02: the conditional Save state and its cloud client are
		// editor-only; a visitor chunk must not carry a writer.
		expect(reached).not.toContain('apps/editor/src/lib/platform/project-persistence.ts');
		expect(reached.filter((file) => file.startsWith('apps/editor/src/lib/authoring/save/'))).toEqual([]);
	});

	it('keeps the Save state framework-free', () => {
		expect(existsSync(SAVE_STATE), 'the Save state must exist for this proof to mean anything').toBe(true);
		expect(existsSync(SAVE_CLIENT), 'the conditional client must exist for this proof to mean anything').toBe(true);

		const reached = [...importClosure([SAVE_STATE])].map(relativeToRepo);
		expect(reached).toContain('apps/editor/src/lib/authoring/save/save-state.ts');
		// The closure helper resolves a package subpath to the package root entry;
		// the runtime import is still the shared package, not a local copy.
		expect(reached).toContain('packages/project-model/src/index.ts');
		// No Svelte runes, no host/Stage/route module, no visitor state: the state
		// machine takes explicit inputs and commands only.
		expect(
			reached.filter(
				(file) =>
					file.includes('/lib/visitor/') ||
					file.includes('/lib/authoring/stage/') ||
					file.includes('/routes/') ||
					file.endsWith('.svelte')
			)
		).toEqual([]);
	});

	it('reaches no visitor module from the coordinator', () => {
		const reached = [...importClosure([COORDINATOR])].map(relativeToRepo);
		expect(reached, 'the coordinator must import something').not.toEqual([]);
		expect(reached.filter((file) => file.includes('/lib/visitor/'))).toEqual([]);
		// The history is part of the same editor-only unit.
		expect(reached).toContain('apps/editor/src/lib/authoring/f4/history.ts');
	});

	it('consumes the shared contract package rather than a second copy of it', () => {
		const reached = [...importClosure([COORDINATOR])].map(relativeToRepo);
		// The coordinator reaches the shared AM-4 contract through the package's one
		// root export and adds no local re-implementation: the two editor files are
		// the coordinator and the history, and nothing else in `lib/authoring/f4/`.
		expect(reached).toContain('packages/project-model/src/index.ts');
		expect(reached).toContain('packages/project-model/src/f4/index.ts');
		expect(reached.filter((file) => file.startsWith('apps/editor/src/lib/authoring/f4/')).sort()).toEqual([
			'apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts',
			'apps/editor/src/lib/authoring/f4/history.ts'
		]);
	});
});
