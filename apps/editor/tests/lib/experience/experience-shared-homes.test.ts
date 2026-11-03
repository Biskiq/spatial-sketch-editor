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

import { EDITOR_LIB, EDITOR_SRC, listSourceFiles, relativeToRepo, stripComments } from '../../helpers/import-closure';

const ROUTE = path.join(EDITOR_LIB, '..', 'routes', 'project', '[projectId]', 'spatial', '+page.svelte');
const EXPERIENCE_DIR = path.join(EDITOR_LIB, 'authoring', 'experience');
const SHELL_DIR = path.join(EDITOR_LIB, 'authoring', 'stage', 'shell');

/** The Experience homes: the components and modules the shared homes are made of. */
const HOME_FILES = [
	path.join(EXPERIENCE_DIR, 'ExperienceHomesHost.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceDock.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceGuide.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperiencePresentationWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceViewWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceStopWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceTransitionWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceGuideWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceSubjectWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceSnapshot.svelte'),
	path.join(EXPERIENCE_DIR, 'experience-card-model.ts'),
	path.join(EXPERIENCE_DIR, 'experience-homes.ts'),
	path.join(SHELL_DIR, 'experience-index-groups.ts'),
	path.join(SHELL_DIR, 'EditorIndex.svelte'),
	path.join(SHELL_DIR, 'EditorCard.svelte')
];

/** The Card writers: each Card's own controls. None of them may hold a Guide toggle. */
const CARD_WRITER_FILES = [
	path.join(EXPERIENCE_DIR, 'ExperiencePresentationWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceViewWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceStopWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceTransitionWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceGuideWriter.svelte'),
	path.join(EXPERIENCE_DIR, 'ExperienceSubjectWriter.svelte')
];

/** The Preview words an enabled Preview entry would carry. */
const PREVIEW_ENTRY = /\bPreview\b|onEnterPreview|Enter Preview|Preview from this Stop/;
/**
 * The S26 placeholder *Preview this move* is a disabled button on the Transition Card (its
 * reason is Camera playback). It is not an entry, so only the disabled form is set aside.
 */
const DISABLED_PREVIEW_PLACEHOLDER = /<button[^>]*\bdisabled\b[^>]*>\s*Preview this move[\s\S]*?<\/button>/g;

function codeOf(file: string): string {
	return stripComments(readFileSync(file, 'utf8'));
}

function authoringSources(): { name: string; file: string; code: string }[] {
	return listSourceFiles(path.join(EDITOR_LIB, 'authoring'))
		.filter((file) => file.endsWith('.svelte'))
		.map((file) => ({ name: path.basename(file), file, code: codeOf(file) }));
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
		const offenders = HOME_FILES.filter((file) =>
			PREVIEW_ENTRY.test(codeOf(file).replace(DISABLED_PREVIEW_PLACEHOLDER, ''))
		);
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

	it('names each Experience action in one home: New Experience in the Index crumb menu, Capture on the dock', () => {
		const homes: Record<string, { pattern: RegExp; home: string }> = {
			'New Experience': { pattern: /New Experience/, home: 'EditorIndex.svelte' },
			'Capture control': { pattern: /aria-label="Capture"|>\s*Capture\s*</, home: 'ExperienceDock.svelte' }
		};
		const sources = authoringSources();
		for (const [label, { pattern, home }] of Object.entries(homes)) {
			const found = sources.filter((source) => pattern.test(source.code)).map((source) => source.name);
			expect(found, label).toEqual([home]);
		}
	});

	it('keeps the removed action labels out of every home', () => {
		const removed = [
			'Save Presentation',
			'Save Stop',
			'Capture and rebind',
			'Insert selected Presentation',
			'Create Experience',
			'Create first Guide'
		];
		const homes = [...HOME_FILES, ROUTE].map((file) => ({ file, code: codeOf(file) }));
		for (const label of removed) {
			const found = homes.filter((home) => home.code.includes(label)).map((home) => relativeToRepo(home.file));
			expect(found, label).toEqual([]);
		}
	});

	it('calls setDefaultView only from the View Card: the ◆ elsewhere is informational', () => {
		const callers = listSourceFiles(EDITOR_SRC)
			.filter((file) => /\.(svelte|ts)$/.test(file))
			.filter((file) => /\.setDefaultView\(/.test(codeOf(file)))
			.map((file) => path.basename(file));
		expect(callers).toEqual(['ExperienceViewWriter.svelte']);
	});

	it('calls setTransition only from the Transition Card: Cut and Travel have one home', () => {
		const callers = listSourceFiles(EDITOR_SRC)
			.filter((file) => /\.(svelte|ts)$/.test(file))
			.filter((file) => /\.setTransition\(/.test(codeOf(file)))
			.map((file) => path.basename(file));
		expect(callers).toEqual(['ExperienceTransitionWriter.svelte']);
	});

	it('no Card writer closes or toggles the Guide, and only ExperienceGuideWriter.svelte opens it', () => {
		// Closing belongs to the dock Guide key and the instrument ×; opening is the Guide writer's Add stop.
		const closesOrToggles = CARD_WRITER_FILES.filter((file) =>
			/setGuideOpen\(\s*(false|!)|guideOpen|guide-toggle|aria-label="Guide"|>\s*Guide\s*</.test(codeOf(file))
		).map(relativeToRepo);
		expect(closesOrToggles).toEqual([]);
		const openers = CARD_WRITER_FILES.filter((file) => /setGuideOpen\(/.test(codeOf(file))).map((file) => path.basename(file));
		expect(openers).toEqual(['ExperienceGuideWriter.svelte']);
	});

	it('draws the lower-edge dock as Select, Place a View, Path, Capture and Guide, with the placeholders disabled and reasoned', () => {
		const dock = readFileSync(path.join(EXPERIENCE_DIR, 'ExperienceDock.svelte'), 'utf8');
		const keys = [...dock.matchAll(/data-dock-tool="([a-z-]+)"/g)].map((match) => match[1]);
		expect(keys).toEqual(['select', 'place-view', 'path', 'capture', 'guide']);
		for (const key of ['place-view', 'path']) {
			const tag = dock.match(new RegExp(`<button[^>]*data-dock-tool="${key}"[^>]*>`))?.[0] ?? '';
			expect(tag, key).toMatch(/\sdisabled\b/);
			expect(tag, key).toMatch(/title="Comes with [^"]+"/);
			const describedBy = tag.match(/aria-describedby="([^"]+)"/)?.[1] ?? '';
			expect(describedBy, key).not.toBe('');
			expect(dock, key).toMatch(new RegExp(`id="${describedBy}"[^>]*>Comes with `));
		}
	});

	it('leaves the Guide closed by default in the route', () => {
		const route = codeOf(ROUTE);
		expect(route).toMatch(/let experienceGuideOpen = \$state\(false\);/);
		// Lens entry closes the Guide and clears the Card subject (the R217.S25 Guide-open effect would reopen it otherwise).
		expect(route).toMatch(/if \(lens === 'experience'\) \{\s*experienceGuideOpen = false;\s*experienceFocus\.select\(null\);\s*\}/);
	});

	it('keeps the Card the one writer of Experience subjects: no subject carries its own Card', () => {
		const offenders = listSourceFiles(EXPERIENCE_DIR)
			.filter((file) => file.endsWith('.svelte'))
			.filter((file) => /<aside[\s>]|class="card"/.test(codeOf(file)))
			.map(relativeToRepo);
		expect(offenders).toEqual([]);
	});
});
