/**
 * The Experience lens controller holds no DOM and no Camera (R217.S24).
 *
 * A source-shape proof, because the claim is about what the module may name: no DOM
 * global, and no Camera or renderer import. Behaviour with the DOM withdrawn is proved
 * by experience-controller.test.ts. This file runs in the node environment, where the
 * shared import-closure helper can resolve the repository's paths.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITOR_LIB, parseModuleSpecifiers, stripComments } from '../../helpers/import-closure';

const MODULE = path.join(EDITOR_LIB, 'authoring/experience/experience-controller.svelte.ts');

describe('experience-controller module boundary', () => {
	it('names no DOM global or element type', () => {
		const code = stripComments(readFileSync(MODULE, 'utf8'));
		expect(code).not.toMatch(/\b(document|window|HTMLElement|Element|HTMLInputElement)\b/);
	});

	it('imports no Camera or renderer module, so it holds no second Camera state', () => {
		const specifiers = parseModuleSpecifiers(readFileSync(MODULE, 'utf8'));
		expect(specifiers.filter((specifier) => /camera|three|threlte/i.test(specifier))).toEqual([]);
	});
});
