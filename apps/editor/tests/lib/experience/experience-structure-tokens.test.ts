/**
 * R217.S26 — the visual-token check (OD5, E16).
 *
 * The slice's new controls use the shell contract's role tokens and metrics
 * (`shell-roles.css`, the editor shell and visual-system contract): the refusal ink for
 * danger items and Remove, the gold only for the reorder caret (the Stop cards' own
 * insertion caret), mono 10 px for the *Start* and *opens* tags, the Card title and crumb
 * metrics for the rename fields, and 44 px coarse-pointer targets for every new control.
 * It reads each component's scoped rules, as the shell coarse-target contract does.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
	return readFileSync(`src/lib/authoring/${file}.svelte`, 'utf8');
}

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(text: string, selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`(?:^|[}\\n])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(text);
	expect(match, `a rule for ${selector}`).not.toBeNull();
	return match![1]!;
}

/** Every `@media (pointer: coarse)` block's text, joined. */
function coarse(text: string): string {
	return text
		.split('@media (pointer: coarse)')
		.slice(1)
		.map((part) => part.slice(0, part.indexOf('}\n') + 1 || undefined))
		.join('\n');
}

const tokens = readFileSync('src/lib/authoring/stage/shell/shell-roles.css', 'utf8');

describe('R217.S26 visual tokens', () => {
	it('uses only role tokens the shell defines', () => {
		for (const token of ['--shell-refuse', '--shell-gold', '--shell-mono', '--shell-ink-2', '--shell-hairline-strong']) {
			expect(tokens).toContain(`${token}:`);
		}
	});

	it('Card danger items and the consequence block speak in the refusal ink', () => {
		const card = source('stage/shell/EditorCard');
		expect(rule(card, '.menu-item.danger')).toMatch(/color:\s*var\(--shell-refuse/);
		const remove = rule(card, '.consequence-actions .remove');
		expect(remove).toMatch(/background:\s*var\(--shell-refuse/);
		expect(remove).toMatch(/border-color:\s*var\(--shell-refuse/);
		expect(rule(card, '.consequence')).toMatch(/border:\s*1px solid var\(--shell-refuse/);
		// The block's own controls keep the Card's control metric (28 px).
		expect(rule(card, '.consequence-actions button')).toMatch(/min-height:\s*28px/);
	});

	it('the kind line’s Back reads in the kind line’s own type role', () => {
		const card = source('stage/shell/EditorCard');
		expect(rule(card, '.kind')).toMatch(/font-size:\s*11px/);
		expect(rule(card, '.back-link')).toMatch(/font-size:\s*11px/);
		expect(rule(card, '.back-link')).toMatch(/color:\s*var\(--shell-ink-2/);
	});

	it('rename fields keep the title and crumb metrics they replace', () => {
		const card = source('stage/shell/EditorCard');
		// The Card rename input inherits the 19 px serif title it replaces.
		expect(rule(card, '.name')).toMatch(/font:\s*400 19px\/1\.2 var\(--shell-serif/);
		expect(card).toMatch(/\.rename-input \{[^}]*font: inherit/);
		const index = source('stage/shell/EditorIndex');
		expect(rule(index, '.exp-open')).toMatch(/font:\s*400 13px\/1\.35 var\(--shell-sans/);
		expect(rule(index, '.crumb-input')).toMatch(/font:\s*600 12px\/1\.3 var\(--shell-sans/);
		expect(rule(index, '.crumb-error')).toMatch(/color:\s*var\(--shell-refuse/);
	});

	it('opens is a mono 10 px tag; the strip has no Start tag', () => {
		expect(source('experience/ExperienceGuide')).not.toContain('.start-tag');
		for (const [file, selector] of [
			['stage/shell/EditorIndex', '.opens-tag'],
			['experience/ExperienceGuideWriter', '.opens-tag']
		] as const) {
			expect(rule(source(file), selector), `${file} ${selector}`).toMatch(/font:\s*500 10px\/[\d.]+ var\(--shell-mono/);
		}
	});

	it('the strip and View rail mark reorders with a quiet light line, never gold', () => {
		const guide = source('experience/ExperienceGuide');
		const guideCaret = rule(guide, '.caret');
		for (const declaration of ['width: 3px', 'border-radius: 2px', 'var(--shell-leaf-soft, #9fd3b6)']) {
			expect(guideCaret).toContain(declaration);
		}
		const rail = source('experience/ExperienceViewRail');
		expect(rule(rail, '.row.drop-before')).toContain('rgb(238 241 236');
		expect(rule(rail, '.row.drop-after')).toContain('rgb(238 241 236');
		expect(rail).not.toContain('--shell-gold');
		expect(rule(rail, '.row')).toMatch(/height:\s*38px/);
	});

	it('every new control keeps a 44 px coarse-pointer target', () => {
		const card = coarse(source('stage/shell/EditorCard'));
		for (const selector of ['.consequence-actions button', '.consequence-choice label', '.back-link', '.rename-input', '.subject-actions button']) {
			expect(card).toContain(selector);
		}
		expect(card).toMatch(/min-height:\s*44px/);
		expect(coarse(source('stage/shell/EditorIndex'))).toMatch(/input\s*\{|input,|\binput\b/);
		const view = coarse(source('experience/ExperienceViewWriter'));
		expect(view).toContain('button.also-link');
		expect(view).toMatch(/min-height:\s*44px/);
		expect(coarse(source('experience/ExperienceGuideWriter'))).toMatch(/button\s*\{\s*min-height:\s*44px/);
	});
});

describe('R217.S27 visual tokens', () => {
	it('uses the shell roles and the guided row metrics', () => {
		const stop = source('experience/ExperienceStopWriter');
		expect(rule(stop, '.entry')).toMatch(/min-height:\s*30px/);
		expect(rule(stop, ".entry[aria-checked='true']")).toContain('var(--shell-forest-raised');
		expect(rule(stop, ".switch[aria-checked='true']")).toContain('var(--shell-forest-raised');
		const presentation = source('experience/ExperiencePresentationWriter');
		expect(rule(presentation, '.explorable')).toMatch(/min-height:\s*28px/);
		expect(rule(presentation, ".explorable[aria-checked='true'] .switch-track")).toContain('var(--shell-forest-raised');
		expect(rule(presentation, ".explorable[aria-checked='true'] .switch-track::before")).toContain('var(--shell-leaf');
		for (const token of ['--shell-gold', '--shell-forest-raised', '--shell-leaf']) expect(tokens).toContain(`${token}:`);
	});

	it('keeps shot controls, the free exploration switch and welcome field at 44 px for coarse pointers', () => {
		const stop = source('experience/ExperienceStopWriter').split('@media (pointer: coarse)')[1]!;
		expect(rule(stop, 'button')).toMatch(/min-height:\s*44px/);
		expect(rule(stop, '.icon-btn')).toMatch(/min-width:\s*44px/);
		const presentation = source('experience/ExperiencePresentationWriter').split('@media (pointer: coarse)')[1]!;
		expect(rule(presentation, 'button,\n\t\t.text-input')).toMatch(/min-height:\s*44px/);
		expect(rule(source('experience/ExperienceGuideWriter'), '.welcome textarea')).toMatch(/min-height:\s*44px/);
	});
});
