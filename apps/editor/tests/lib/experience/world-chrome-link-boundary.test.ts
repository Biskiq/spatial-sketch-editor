/**
 * D-11 — World chrome never reads or shows an Experience link.
 *
 * A Scene object may be a Presentation's subject, but the Stage, Plan and the
 * World object Card show no badge, outline, warning or section about it. The
 * relationship lives on the Experience side; a Scene removal's only visible
 * Experience consequence is the Presentation Card's ordinary unlink.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITOR_LIB, parseModuleSpecifiers, stripComments } from '../../helpers/import-closure';

const WORLD_CHROME = [
	'authoring/stage/shell/EditorCard.svelte',
	'authoring/stage/shell/StageCanvas.svelte',
	'authoring/adapters/scene/SceneObjectCardFields.svelte',
	'authoring/scene/plan-scene-footprint.ts'
];

describe('World chrome Experience boundary (D-11)', () => {
	for (const relative of WORLD_CHROME) {
		it(`does not read Experience links in ${relative}`, () => {
			const file = path.join(EDITOR_LIB, relative);
			const source = readFileSync(file, 'utf8');
			expect(parseModuleSpecifiers(source).filter((specifier) => /authoring\/experience|experience\//.test(specifier))).toEqual([]);
			const code = stripComments(source);
			expect(code).not.toMatch(/\b(presentationsAbout|selectedPresentation|presentationLabel|presentationDisplayName)\b/);
		});
	}
});
