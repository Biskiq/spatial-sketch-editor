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
		expect(rule(index, '.crumbs')).toMatch(/font-size:\s*12px/);
		expect(rule(index, '.crumb-input')).toMatch(/font:\s*600 12px\/1\.3 var\(--shell-sans/);
		expect(rule(index, '.crumb-error')).toMatch(/color:\s*var\(--shell-refuse/);
	});

	it('Start and opens are mono 10 px tags', () => {
		for (const [file, selector] of [
			['experience/ExperienceGuide', '.start-tag'],
			['stage/shell/EditorIndex', '.opens-tag'],
			['experience/ExperienceGuideWriter', '.opens-tag']
		] as const) {
			expect(rule(source(file), selector), `${file} ${selector}`).toMatch(/font:\s*500 10px\/[\d.]+ var\(--shell-mono/);
		}
	});

	it('the View reorder caret is the Stop cards’ gold caret', () => {
		const guideCaret = rule(source('experience/ExperienceGuide'), '.caret');
		const viewCaret = rule(source('experience/ExperiencePresentationWriter'), '.vtile.caret-before::before,\n\t.vtile.caret-after::after');
		for (const declaration of ['width: 3px', 'border-radius: 2px', 'background: var(--shell-gold, #d4ad45)']) {
			expect(guideCaret).toContain(declaration);
			expect(viewCaret).toContain(declaration);
		}
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
