/**
 * R217.S25 — every Experience control has one home (the shared Head, Index, Card or lower edge).
 *
 * A source-shape proof of the home map: the retired full-surface overlay is gone, Preview
 * and the lens are reached only through the Head, and each Experience control is named in
 * exactly one module. Behaviour is proved by the mounted route suite; this file guards the
 * boundary that a second home would break without failing any behaviour test.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITOR_LIB, listSourceFiles, relativeToRepo, stripComments } from '../../helpers/import-closure';

const ROUTE = path.join(EDITOR_LIB, '..', 'routes', 'project', '[projectId]', 'spatial', '+page.svelte');
const EXPERIENCE_DIR = path.join(EDITOR_LIB, 'authoring', 'experience');
const SHELL_DIR = path.join(EDITOR_LIB, 'authoring', 'stage', 'shell');

/** The Experience homes: the components and modules the shared homes are made of. */
const HOME_FILES = [
	path.join(EXPERIENCE_DIR, 'ExperienceHomesHost.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceDock.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceGuidePanel.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperiencePresentationWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceStopWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'experience-card-model.ts'),
	path.join(EXPERIENCE_DIR, 'experience-homes.ts'),
	path.join(SHELL_DIR, 'experience-index-groups.ts'),
	path.join(SHELL_DIR, 'EditorIndex.svelte'),
	path.join(SHELL_DIR, 'EditorCard.svelte')
];

function codeOf(file: string): string {
	return stripComments(readFileSync(file, 'utf8'));
}

describe('R217.S25 — the Experience home map', () => {
	it('retires the full-surface overlay: its component is gone and the route mounts no lens-surface', () => {
		expect(existsSync(path.join(EXPERIENCE_DIR, 'ExperienceSurface.svelte'))).toBe(false);
		const route = codeOf(ROUTE);
		expect(route).not.toContain('ExperienceSurface');
		expect(route).not.toContain('lens-surface');
		expect(route).not.toContain('Experience lens"');
	});

	it('reaches Preview and the lens only through the Head: no homes module names a Preview entry', () => {
		const offenders = HOME_FILES.filter((file) => /\bPreview\b|onEnterPreview|Enter Preview|Preview from this Stop/.test(codeOf(file)));
		expect(offenders.map(relativeToRepo)).toEqual([]);
		const route = codeOf(ROUTE);
		expect(route).not.toContain('onEnterPreview');
		expect(route).not.toContain('Preview from this Stop');
		expect(route).not.toContain('Enter Preview');
	});

	it('keeps the single lens group in the Head', () => {
		const groups = listSourceFiles(path.join(EDITOR_LIB, 'authoring'))
			.filter((file) => file.endsWith('.svelte'))
			.filter((file) => /aria-label="Product lens"/.test(codeOf(file)))
			.map(relativeToRepo);
		expect(groups).toEqual(['apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte']);
	});

	it('names each Experience action in one home: Create in the Index, Capture on the dock, Save in the writers', () => {
		const names: Record<string, string> = {
			'Create Experience': 'EditorIndex.svelte',
			'Capture: what you see': 'ExperienceDock.svelte',
			'Save Presentation': 'ExperiencePresentationWriter.svelte',
			'Save Stop': 'ExperienceStopWriter.svelte',
			'Create first Guide': 'ExperienceGuidePanel.svelte',
			'Insert selected Presentation as a Stop': 'ExperienceGuidePanel.svelte'
		};
		const sources = listSourceFiles(path.join(EDITOR_LIB, 'authoring'))
			.filter((file) => file.endsWith('.svelte'))
			.map((file) => ({ name: path.basename(file), code: codeOf(file) }));
		for (const [label, home] of Object.entries(names)) {
			const found = sources.filter((source) => source.code.includes(label)).map((source) => source.name);
			expect(found, label).toEqual([home]);
		}
	});

	it('draws the lower-edge dock with exactly Select, Capture and Guide, and no World tool key', () => {
		const dock = readFileSync(path.join(EXPERIENCE_DIR, 'ExperienceDock.svelte'), 'utf8');
		const keys = [...dock.matchAll(/data-dock-tool="([a-z-]+)"/g)].map((match) => match[1]);
		expect(keys).toEqual(['select', 'capture', 'guide']);
	});

	it('leaves the Guide closed by default in the route', () => {
		const route = codeOf(ROUTE);
		expect(route).toMatch(/let experienceGuideOpen = \$state\(false\);/);
		expect(route).toMatch(/if \(lens === 'experience'\) experienceGuideOpen = false;/);
	});

	it('keeps the Card the one writer of Experience subjects: no subject carries its own Card', () => {
		const offenders = listSourceFiles(EXPERIENCE_DIR)
			.filter((file) => file.endsWith('.svelte'))
			.filter((file) => /<aside[\s>]|class="card"/.test(codeOf(file)))
			.map(relativeToRepo);
		expect(offenders).toEqual([]);
	});
});
