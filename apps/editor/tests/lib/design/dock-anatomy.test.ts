/** The World and Experience docks share one anatomy (T2.S8 U8, accepted #399 design). */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const tokens = read('src/lib/design/presentation-tokens.css');
const world = read('src/lib/authoring/world-toolbar/WorldToolbar.svelte');
const experience = read('src/lib/authoring/experience/ExperienceDock.svelte');
const styleOf = (source: string) => source.slice(source.indexOf('<style>'));

const DOCK_ROLES: Record<string, string> = {
	'--shell-dock-height': '56px',
	'--shell-dock-key-height': '46px',
	'--shell-dock-key-min-width': '54px',
	'--shell-dock-key-radius': '10px',
	'--shell-dock-sep-height': '28px',
	'--shell-dock-label-size': '10.5px',
	'--shell-dock-hint-size': '9px'
};

describe('dock anatomy', () => {
	it('declares the accepted geometry once, as shell roles', () => {
		for (const [role, value] of Object.entries(DOCK_ROLES)) {
			expect(tokens, role).toMatch(new RegExp(`${role}:\\s*${value.replace('.', '\\.')};`));
		}
	});

	it.each([
		['World', world],
		['Experience', experience]
	])('%s dock draws its chassis and keys from the shared roles', (_name, source) => {
		const css = styleOf(source);
		for (const role of ['height', 'key-height', 'key-min-width', 'key-radius', 'sep-height', 'label-size']) {
			expect(css, `--shell-dock-${role}`).toContain(`var(--shell-dock-${role})`);
		}
		expect(css).toContain('var(--shell-dock-shadow)');
		// The key's geometry is never restated as a literal.
		expect(css).not.toMatch(/\bheight:\s*(?:36|46|56)px/);
	});

	it('wears the one armed key on every dock', () => {
		for (const source of [world, experience]) {
			const css = styleOf(source);
			expect(css).toMatch(/\.key\.armed\s*\{[^}]*var\(--shell-tool-armed-bg\)[^}]*var\(--shell-tool-armed-ink\)[^}]*var\(--shell-tool-armed-edge\)/s);
		}
	});

	it('labels every Experience key beside its icon', () => {
		const keys = experience.match(/<button[\s\S]*?<\/button>/g) ?? [];
		expect(keys).toHaveLength(4);
		for (const key of keys) expect(key).toContain('class="kl"');
	});

	it('leaves no second Stage dock implementation behind', () => {
		expect(existsSync('src/lib/authoring/stage/shell/StageDock.svelte')).toBe(false);
	});
});
