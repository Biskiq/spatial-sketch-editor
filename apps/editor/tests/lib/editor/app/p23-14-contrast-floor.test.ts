import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * P23.14 review F1–F4 / owner rulings D1–D4 + F3 — the contrast and type floor
 * as a MEASURED contract.
 *
 * The defect this pins was not a wrong colour, it was a wrong COMMENT: the
 * token file claimed 10.6:1 for an ink that measures 13.25:1 (the number
 * belonged to a different swatch) and ≥ 8:1 for a ring that measures 6.56:1.
 * So this suite recomputes every number the file documents, from the file
 * itself, and fails when a value, a claim or a consumer drifts apart.
 */

const EDITOR_SRC = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));
const TOKENS_CSS = path.join(EDITOR_SRC, 'styles/tokens.css');
const CONTROLS_CSS = path.join(EDITOR_SRC, 'styles/controls.css');

const tokens = fs.readFileSync(TOKENS_CSS, 'utf8');
const controls = fs.readFileSync(CONTROLS_CSS, 'utf8');

/* ── WCAG 2.1 relative luminance / contrast ratio ─────────────────────────── */

function luminance(hex: string): number {
	const channels = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a: string, b: string): number {
	const [x, y] = [luminance(a), luminance(b)];
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* ── token resolution ─────────────────────────────────────────────────────── */

/** Body of the first `selector { … }` block that has no nested braces. */
function block(source: string, selector: string): string {
	const start = source.indexOf(selector);
	expect(start, `${selector} must exist`).toBeGreaterThanOrEqual(0);
	const open = source.indexOf('{', start);
	const close = source.indexOf('}', open);
	return source.slice(open + 1, close);
}

const plate = block(tokens, ":root[data-theme='plate-light'] {");
const base = block(tokens, ':root {');

/**
 * PLATE Light resolves a token as: its own block if re-authored there (single
 * hex or the LIGHT member of a light-dark() pair), else the base ramp's light
 * member. That is exactly the cascade the theme header documents.
 */
function plateValue(name: string): string {
	const token = name.startsWith('editor-') ? name : `editor-${name}`;
	const read = (source: string): string | undefined => {
		const match = new RegExp(`--${token}:\\s*([^;]+);`).exec(source);
		const raw = match?.[1]?.trim();
		if (!raw) return undefined;
		const lightDark = /^light-dark\(\s*(#[0-9a-f]{6})/i.exec(raw);
		return lightDark ? lightDark[1] : raw;
	};
	const declared = read(plate) ?? read(base);
	expect(declared, `--${token} must resolve to a hex`).toBeTruthy();
	expect(declared, `--${token} must resolve to a hex`).toMatch(/^#[0-9a-f]{6}$/i);
	return declared!.toUpperCase();
}

// The light Chassis family — every surface the shell paints text on.
const TEXT_SURFACES = ['bg-app', 'bg-panel', 'bg-panel-raised', 'bg-control', 'bg-hover', 'bg-selected'];
// The recessed Spine trough hosts station labels only (pinned below).
const RECESS = 'bg-recess';

describe('P23.14 review F1/D1–D4 — measured contrast floor (PLATE Light)', () => {
	it('is a light-scheme theme, so the light partners really are what ships', () => {
		expect(plate).toContain('color-scheme: light');
	});

	it.each([
		['text-primary', 'editor-text-primary'],
		['text-secondary', 'editor-text-secondary'],
		['text-muted', 'editor-text-muted'],
		['text-success', 'editor-text-success'],
		['text-warning', 'editor-text-warning']
	])('%s clears AA (4.5:1) on every text surface', (_label, token) => {
		const ink = plateValue(token);
		for (const surface of TEXT_SURFACES) {
			const bg = plateValue(surface);
			expect(
				ratio(ink, bg),
				`--${token} (${ink}) on --editor-${surface} (${bg})`
			).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('keeps the quiet tier measurable above the de-emphasis tier', () => {
		// Muted stays quieter than secondary (hierarchy) while still clearing AA:
		// the darkening is a floor, not a re-tiering.
		const chassis = plateValue('bg-app');
		expect(ratio(plateValue('editor-text-muted'), chassis)).toBeLessThan(
			ratio(plateValue('editor-text-secondary'), chassis)
		);
		expect(ratio(plateValue('editor-text-primary'), chassis)).toBeGreaterThan(
			ratio(plateValue('editor-text-secondary'), chassis)
		);
	});

	it.each([
		['domain-scene', 'editor-domain-scene'],
		['domain-camera', 'editor-domain-camera'],
		['armed', 'editor-armed'],
		['focus-ring', 'editor-focus-ring']
	])('%s clears the non-text bar (3:1) where it is painted', (_label, token) => {
		const ink = plateValue(token);
		for (const surface of ['bg-app', 'bg-panel-raised', 'bg-control', 'bg-hover']) {
			const bg = plateValue(surface);
			expect(
				ratio(ink, bg),
				`--${token} (${ink}) on --editor-${surface} (${bg})`
			).toBeGreaterThanOrEqual(3);
		}
	});

	it('never paints muted text on the recessed trough it cannot clear', () => {
		// #55606E on the recess measures 4.11:1 — under AA. The trough is the
		// Domain Spine, whose labels use secondary; pin that, so a future spine
		// label cannot quietly take the quiet ink.
		expect(ratio(plateValue('editor-text-muted'), plateValue(RECESS))).toBeLessThan(4.5);
		const spine = fs.readFileSync(path.join(EDITOR_SRC, 'app/DomainSpine.svelte'), 'utf8');
		expect(spine).not.toContain('var(--editor-text-muted)');
	});

	it('matches a §6.1 reference pairing only where the reference ink is used', () => {
		// Review F1: the file claimed 10.6:1 for the base primary. 10.6:1 is
		// #252A2E — the §6.1 baseline ink — so the claim may only sit next to it.
		expect(ratio('#252A2E', plateValue('bg-app'))).toBeCloseTo(10.6, 1);
		expect(ratio(plateValue('editor-text-primary'), plateValue('bg-app'))).toBeCloseTo(13.25, 1);
		expect(plateValue('editor-text-primary')).toBe('#13161D');
	});
});

describe('P23.14 review F1/D1 — the documented table cannot rot', () => {
	/** `primary   #13161D   13.25:1` rows of the base text-ramp comment. */
	const documented = new Map<string, { hex: string; ratio: number }>();
	for (const line of tokens.split('\n')) {
		const row = /^\s*(primary|secondary|muted|success|warning)\s+(.+?)\s+(\d+\.\d\d):1\s*$/.exec(line);
		if (!row) continue;
		const hexes = row[2].match(/#[0-9A-Fa-f]{6}/g);
		documented.set(row[1], { hex: hexes!.at(-1)!.toUpperCase(), ratio: Number(row[3]) });
	}

	it('documents one measured worst case for every ramp ink', () => {
		expect([...documented.keys()].sort()).toEqual(['muted', 'primary', 'secondary', 'success', 'warning']);
	});

	it.each(['primary', 'secondary', 'muted', 'success', 'warning'])(
		'recomputes the documented %s value and ratio from tokens.css',
		(name) => {
			const row = documented.get(name)!;
			const token = {
				primary: 'editor-text-primary',
				secondary: 'editor-text-secondary',
				muted: 'editor-text-muted',
				success: 'editor-text-success',
				warning: 'editor-text-warning'
			}[name]!;
			expect(plateValue(token), `documented ink for ${name}`).toBe(row.hex);
			const worst = Math.min(...TEXT_SURFACES.map((s) => ratio(row.hex, plateValue(s))));
			expect(Number(worst.toFixed(2)), `documented worst case for ${name}`).toBe(row.ratio);
		}
	);

	it('records the retired muted value so the change is legible', () => {
		expect(tokens).toMatch(/muted\s+#606B7E → #55606E \(was 3\.94\)\s+4\.68:1/);
		expect(ratio('#606B7E', plateValue('bg-app'))).toBeCloseTo(3.94, 2);
	});
});

describe('P23.14 review F1/D2 — base semantic tokens are never text', () => {
	const sources = (function walk(dir: string): string[] {
		return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) return walk(full);
			return /\.(svelte|css|ts)$/.test(entry.name) ? [full] : [];
		});
	})(EDITOR_SRC);

	it.each(['editor-success', 'editor-warning'])('paints no `color: var(--%s)` anywhere', (token) => {
		// Ruling D2: text takes the TEXT sibling. Border/soft/stroke/fill uses
		// stay on the base family, so only `color:` is forbidden here.
		// `(?<![\w-])` keeps `border-color:` / `background-color:` out of scope.
		const offenders = sources.filter((file) =>
			new RegExp(`(?<![\\w-])color:\\s*var\\(--${token}\\)`).test(fs.readFileSync(file, 'utf8'))
		);
		expect(offenders).toEqual([]);
	});

	it.each([
		['editor-text-success', '--editor-text-success'],
		['editor-text-warning', '--editor-text-warning']
	])('%s exists and is consumed', (_label, token) => {
		expect(tokens).toContain(`${token}:`);
		const consumers = sources.filter(
			(file) =>
				!file.endsWith('tokens.css') && fs.readFileSync(file, 'utf8').includes(`var(${token})`)
		);
		expect(consumers.length, `${token} must have a consumer`).toBeGreaterThan(0);
	});
});

/**
 * P23.14 review F3, re-decided — the tray's engraved tier.
 *
 * F3 first read §7's "10 px: engraved/group labels" as a floor and pushed the
 * rail's labels from 8 px to 10 px. That cannot hold against §11's own 44 px
 * rail: at 10 px the group names measure 46.6–63.8 px inside a 39 px text box,
 * so every label broke *inside the word* ("OPENI / NGS", "OBJEC / TS",
 * "Windo / w"). §7 calls its own hierarchy "approximate"; §11 asks only for
 * "small persistent group labels and compact icon-led tools". The tray
 * therefore paints the reference's tier, and the geometry below is the reason
 * it fits — 44 − 2(gutter) − 1(rail border) − 2(control border) = 39 px.
 */
describe('P23.14 F3 (re-decided) — tray engraved micro-tier', () => {
	const groupLabel = block(controls, '.project-editor .tool-tray .tool-group[data-group-label]::before {');
	const button = block(controls, '.project-editor .tool-tray button {');

	it('declares the tray tier as tokens, not loose pixels in a rule', () => {
		// R3 — the tier is a multiple of the one type knob, like every other size.
		expect(tokens).toContain('--editor-font-size-tray-group: calc(7px * var(--editor-type-scale));');
		expect(tokens).toContain('--editor-font-size-tray-tool: calc(8px * var(--editor-type-scale));');
	});

	it('paints the engraved group label at the reference tier', () => {
		// R3 — the rule asks for the ROLE; weight, leading and face live with the
		// size in the role, so a tier change is one edit in tokens.css.
		expect(groupLabel).toContain('font: var(--editor-type-tray-group)');
		expect(tokens).toContain(
			'--editor-type-tray-group: 600 var(--editor-font-size-tray-group)/1.15'
		);
		expect(groupLabel).toContain('letter-spacing: 0');
	});

	it('paints the tool label at the reference tier, single-line-capable', () => {
		expect(button).toContain('font: var(--editor-type-tray-tool)');
		expect(tokens).toContain(
			'--editor-type-tray-tool: 600 var(--editor-font-size-tray-tool)/1.15'
		);
		// The View Bar toolbars are nowrap by contract; only the tray wraps.
		expect(button).toContain('white-space: normal');
		expect(button).toContain('overflow-wrap: anywhere');
	});

	it('never paints 10 px type inside the rail again', () => {
		// The regression: a 10 px label cannot fit 44 px minus gutters.
		expect(controls).not.toMatch(/\.tool-tray[^}]*font:[^;]*\b(?:10|9)px/);
	});

	it('buys the label its 39 px text box from geometry, not from type', () => {
		// 44 px rail, 1 px gutter each side, 1 px rail border, 2 px control border.
		expect(block(controls, '.project-editor .tool-tray {')).toContain('padding: 6px 1px 10px;');
		expect(button).toContain('width: 100%');
		expect(tokens).toContain('--editor-tray-width: calc(44px * var(--editor-type-scale));');
	});

	it('keeps the comment and the rule agreeing about the tier', () => {
		expect(controls).toContain("TYPE — the rail keeps the reference's engraved micro-tier, not §7's 10 px");
	});

	it('steps the one over-wide group word down instead of breaking it (R1)', () => {
		// TRANSFORM is 44.7 px at 7 px — wider than the 44 px rail. The opt-in is
		// per group, so the tier itself stays at the reference's 7 px.
		expect(tokens).toContain(
			'--editor-font-size-tray-group-compact: calc(6px * var(--editor-type-scale));'
		);
		const compact = block(
			controls,
			'.project-editor .tool-tray .tool-group[data-group-compact][data-group-label]::before {'
		);
		expect(compact).toContain('font-size: var(--editor-font-size-tray-group-compact)');
		// The tier itself is never the compact size: the role points at the tier
		// token and the compact override is the only other size in the rail.
		expect(tokens).toContain(
			'--editor-type-tray-group: 600 var(--editor-font-size-tray-group)/1.15'
		);
		expect(groupLabel).toContain('font: var(--editor-type-tray-group)');
		const toolbar = fs.readFileSync(
			path.join(EDITOR_SRC, 'EditorViewportToolbar.svelte'),
			'utf8'
		);
		expect(toolbar).toContain('data-group-label="TRANSFORM" data-group-compact');
	});
});

/**
 * Owner ratification R2 — the armed tool is a DARKENED SURFACE ONLY.
 *
 * The amber border and the 3 px inboard edge are gone at the owner's direction,
 * so the armed state is carried by luminance alone. That still satisfies §18
 * (never hue alone — it is now no hue at all), and it is the reason the
 * `.active` rule must not reach for `--editor-armed` again.
 */
describe('P23.14 R2 — armed tool is a darkened surface, nothing else', () => {
	const armed = block(controls, '.project-editor .tool-tray button.active {');

	it('paints the recess step and no border, edge or weight step', () => {
		expect(armed).toContain('background: var(--editor-bg-recess)');
		expect(armed).toContain('border-color: transparent');
		expect(armed).toContain('box-shadow: none');
		expect(armed).not.toContain('font-weight');
	});

	it('does not spend the armed hue on the rail', () => {
		expect(armed).not.toContain('--editor-armed');
	});

	it('keeps the armed surface readable at full ink', () => {
		// The armed label is `--editor-text-primary` on the recess step, which is
		// a TEXT surface the AA floor has to cover like any other.
		expect(ratio(plateValue('editor-text-primary'), plateValue(RECESS))).toBeGreaterThanOrEqual(4.5);
	});

	it('still ships the armed hue in the palette, for surfaces that want it', () => {
		expect(plate).toContain('--editor-armed: #946624;');
	});
});
