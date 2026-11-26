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
const SESSION = path.join(EDITOR_LIB, 'authoring/experience/experience-camera-session.svelte.ts');
const CAMERA_MODULE = /camera|three|threlte/i;

describe('experience-controller module boundary', () => {
	it('names no DOM global or element type', () => {
		const code = stripComments(readFileSync(MODULE, 'utf8'));
		expect(code).not.toMatch(/\b(document|window|HTMLElement|Element|HTMLInputElement)\b/);
	});

	it('imports no Camera or renderer module, so it holds no second Camera state', () => {
		const specifiers = parseModuleSpecifiers(readFileSync(MODULE, 'utf8'));
		// The Camera-path session is first-party Experience state (occurrence and anchors),
		// not a Camera import; its own boundary is checked below.
		expect(
			specifiers.filter(
				(specifier) => CAMERA_MODULE.test(specifier) && specifier !== './experience-camera-session.svelte'
			)
		).toEqual([]);
	});

	it('keeps the Camera-path session free of Camera and renderer imports', () => {
		const specifiers = parseModuleSpecifiers(readFileSync(SESSION, 'utf8'));
		expect(specifiers.filter((specifier) => CAMERA_MODULE.test(specifier))).toEqual([]);
	});
});
