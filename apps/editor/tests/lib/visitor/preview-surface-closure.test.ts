/**
 * T3.P03.S01 — the Preview surface's source closure.
 *
 * `f4-public-isolation.test.ts` holds the public route's closure and the build
 * plugins hold the resolved module graph. Neither covers a source-level import
 * added to the `VisitorPreviewSurface.svelte` root itself: the Preview surface is
 * editor-mounted but must keep rendering through the visitor's own machinery, so
 * an authoring import there would put editor host code in a visitor-facing tree
 * while every existing proof stayed green. This walks the same shared closure
 * reader (tests/README.md rule 7) from that root.
 *
 * The positive controls are what keep the absence assertion from passing on an
 * empty walk: the root must be a member, and the closure must actually reach the
 * shared runtime-safe packages an evaluator import resolves through.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITOR_SRC, importClosure, relativeToRepo } from '../../helpers/import-closure';

const PREVIEW_ROOT = join(EDITOR_SRC, 'lib', 'visitor', 'VisitorPreviewSurface.svelte');

describe('Visitor Preview surface source closure', () => {
	it('reaches no authoring machinery from the Preview surface root', () => {
		expect(existsSync(PREVIEW_ROOT), 'the Preview surface root must exist for this proof to mean anything').toBe(true);

		const reached = [...importClosure([PREVIEW_ROOT])].map(relativeToRepo);

		// Positive controls: the walk is real and non-trivial.
		expect(reached).toContain('apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte');
		expect(
			reached.some((file) => file.startsWith('packages/project-model/src/')),
			'the runtime-safe shared evaluators must stay reachable from the Preview surface'
		).toBe(true);

		// The guarantee: no editor authoring machinery (Stage host, adapters, Save,
		// F.4 acceptance) in the Preview surface's closure.
		expect(reached.filter((file) => file.startsWith('apps/editor/src/lib/authoring/'))).toEqual([]);
	});
});
