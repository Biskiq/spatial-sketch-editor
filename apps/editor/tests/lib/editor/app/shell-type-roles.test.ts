import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIB_DIR, readLibSource } from '../../../helpers/lib-source';

/**
 * P23.14 R3 — the shell's type + control roles, and the two knobs that retune
 * them.
 *
 * The drift behind this slice was not one wrong number: it was that every
 * surface carried its OWN number, so the Atlas comparison could only ever
 * match some of them. This suite makes the replacement durable — a closed
 * ladder (seven steps, every one a multiple of `--editor-type-scale`), a
 * button-role table (every metric a multiple of `--editor-control-scale`), an
 * icon/geometry role for the groups measured by fit rather than by semantics,
 * and a guard that fails when a swept shell surface reintroduces a pinned
 * pixel value.
 */

const EDITOR_SRC = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));
const read = (relative: string): string => fs.readFileSync(path.join(EDITOR_SRC, relative), 'utf8');

const tokens = read('styles/tokens.css');

/** Step name → the px it multiplies at scale 1. §7/Atlas ramp. */
const LADDER: Record<string, number> = {
	'2xs': 9,
	xs: 10,
	sm: 11,
	md: 12,
	lg: 13,
	xl: 15,
	'2xl': 20
};

/** Every type role a shell surface may ask for. */
const TYPE_ROLES = [
	'body',
	'engraved',
	'engraved-quiet',
	'heading',
	'identity',
	'row',
	'row-head',
	'control',
	'control-strong',
	'utility',
	'mode',
	'status',
	'property',
	'mono',
	'ref',
	'tick',
	'readout',
	'station',
	'tray-group',
	'tray-tool'
];

/**
 * Issue #35 — the axis hex values the field components must never carry:
 * canonical axis colour lives only in `tokens.css` (`--editor-axis-x/y/z`;
 * the gizmo aliases in the same block share the rule).
 */
const AXIS_HEX: Record<string, string> = { x: 'f05252', y: '45c878', z: '3b82f6' };

/** Recurring groups sized by FIT rather than by button semantics. */
const GEOMETRY_ROLES = [
	'--editor-icon-size-sm',
	'--editor-icon-size-lg',
	'--editor-tray-icon-size',
	'--editor-row-height',
	'--editor-disclosure-size',
	'--editor-station-height',
	'--editor-tray-tool-height'
];

/**
 * Shell surfaces swept onto roles. Anything added here must already be free of
 * pinned `font`/`font-size` values — the guard below is what stops the sweep
 * from silently un-doing itself.
 */
const SWEPT_SURFACES = [
	'styles/tokens.css',
	'styles/controls.css',
	'styles/inspector.css',
	'styles/timeline.css',
	'app/DomainSpine.svelte',
	'app/StatusBar.svelte',
	'app/WorkspaceRibbon.svelte',
	'app/ProjectRow.svelte',
	'app/CameraSidebar.svelte',
	'app/EditorSidebar.svelte',
	'hierarchy/HierarchyRow.svelte',
	'hierarchy/HierarchyNavigator.svelte',
	'UnifiedProjectTree.svelte',
	'EditorViewportToolbar.svelte'
];

/** `name: value;` for one custom property, whitespace-normalised. */
function tokenValue(source: string, name: string): string {
	const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(source);
	expect(match, `--${name} must be declared`).not.toBeNull();
	return (match as RegExpExecArray)[1].replace(/\s+/g, ' ').trim();
}

describe('P23.14 R3 — one type scale as a closed ladder', () => {
	/**
	 * The one thing a text scan cannot see: CSS comments do not nest, so an
	 * inner terminator in a token-file note ends the comment early and drops
	 * every declaration after it from the cascade. That failure is invisible to
	 * a grep-based contract and very visible in the browser, so it is scanned
	 * here directly.
	 */
	it('keeps every note free of nested comment markers', () => {
		for (const surface of SWEPT_SURFACES) {
			const source = read(surface);
			let index = 0;
			let inside = false;
			let line = 1;
			const offenders: number[] = [];
			while (index < source.length - 1) {
				if (source[index] === '\n') line += 1;
				if (!inside && source.startsWith('/*', index)) {
					inside = true;
					index += 2;
					continue;
				}
				if (inside && source.startsWith('*/', index)) {
					inside = false;
					index += 2;
					continue;
				}
				if (inside && source.startsWith('/*', index)) offenders.push(line);
				index += 1;
			}
			expect(offenders, `${surface} nests a comment at line(s) ${offenders.join(', ')}`).toEqual(
				[]
			);
		}
	});

	it('expresses the knob as a percentage factor and documents it as one', () => {
		expect(tokens).toContain('--editor-type-scale: 1;');
		// The knob is unitless because CSS cannot multiply a length by a
		// percentage token; the comment has to say so, or the next reader will
		// "fix" it into `100%` and break every step.
		expect(tokens).toContain('it is a PERCENTAGE');
		expect(tokens).toContain('1.15 means 115 %');
		// The knob has to be set where the ladder is declared: a token derived
		// from another token is a snapshot taken at its declaring element, so a
		// knob override lower in the tree cannot re-derive it. That is a cascade
		// fact, not a style choice, so the file has to say it.
		expect(tokens).toContain('is a SNAPSHOT taken where it is declared');
		expect(tokens).toContain('Raising it to 1.15 renders the whole shell at 115 %');
		// The knob is documented without a literal selector block: the P23.14
		// density suite locates `.project-editor {` textually, and a snippet in
		// the note would shadow the real block.
		expect(tokens).toContain('No literal selector block appears in this note on purpose');
	});

	it('multiplies every ladder step by the same knob', () => {
		for (const [step, px] of Object.entries(LADDER)) {
			expect(tokens).toContain(
				`--editor-font-size-${step}: calc(${px}px * var(--editor-type-scale));`
			);
		}
	});

	it('keeps the ladder CLOSED: no font size outside it, in this file or any other', () => {
		const declarations = [...tokens.matchAll(/--editor-font-size-([a-z0-9-]+):\s*([^;]+);/g)];
		expect(declarations.length).toBeGreaterThan(Object.keys(LADDER).length);
		for (const [, name, rawValue] of declarations) {
			const value = rawValue.replace(/\s+/g, ' ').trim();
			// A step is either a multiple of the knob, or a named alias onto a
			// step. A bare `11px` here would be a second source of truth.
			expect(
				/^(calc\([0-9.]+px \* var\(--editor-type-scale\)\)|var\(--editor-font-size-[a-z0-9-]+\))$/.test(
					value
				),
				`--editor-font-size-${name} is off the ladder: ${value}`
			).toBe(true);
		}
	});

	it('derives every type role from a ladder step (family + size + weight + leading travel together)', () => {
		for (const role of TYPE_ROLES) {
			const value = tokenValue(tokens, `editor-type-${role}`);
			// `weight size/leading family` — the size member is a ladder step or
			// the knob itself, and it is the ONLY size in the role.
			const match = /(?:^|\s)(var\(--editor-font-size-[a-z0-9-]+\)|calc\([0-9.]+px \* var\(--editor-type-scale\)\))(?=\/| )/.exec(
				value
			);
			expect(match, `--editor-type-${role} has no ladder size: ${value}`).not.toBeNull();
			expect(
				value.replace((match as RegExpExecArray)[0], ' '),
				`--editor-type-${role} carries a second, pinned size: ${value}`
			).not.toMatch(/[0-9.]+(px|rem)/);
		}
	});
});

describe('P23.14 R3 — button + geometry roles on the second knob', () => {
	it('scales every control height and the control radius family from one knob', () => {
		for (const size of ['lg', 'md', 'sm', 'xs']) {
			expect(tokens).toContain(
				`--editor-control-${size}-height: calc(`
			);
			expect(tokenValue(tokens, `editor-control-${size}-height`)).toContain(
				'var(--editor-control-scale)'
			);
		}
		expect(tokenValue(tokens, 'editor-control-scale')).toBe('1');
	});

	it('gives every recurring shell group a role instead of a number in a rule', () => {
		for (const role of GEOMETRY_ROLES) {
			const name = role.replace(/^--/, '');
			expect(tokens, `${role} missing`).toContain(`${role}: calc(`);
			expect(tokenValue(tokens, name), `${role} ignores its knob`).toMatch(
				/var\(--editor-(control|type)-scale\)/
			);
		}
	});

	/**
	 * The real guard. A `font`/`font-size` declaration in a swept surface must
	 * resolve through a role, a ladder step or `inherit` — never a pinned
	 * `0.68rem` / `12px`. This is the failure mode that produced the drift: no
	 * rule was wrong on its own, they simply stopped agreeing.
	 */
	it('keeps every swept shell surface free of pinned type values', () => {
		for (const surface of SWEPT_SURFACES) {
			// Comments carry quoted CSS (`the Atlas's `.utilities button { font-size:10px }``), so
			// they are stripped before the scan — this guard is about rules.
			const source = read(surface).replace(/\/\*[\s\S]*?\*\//g, '');
			const declarations = [
				...source.matchAll(/(?:^|[{;])\s*font(?:-size)?:\s*([^;]+);/gm)
			];
			for (const [, rawValue] of declarations) {
				const value = rawValue.replace(/\s+/g, ' ').trim();
				expect(
					/^(inherit|var\(--editor-)/.test(value),
					`${surface} pins a type value: "font: ${value}" — use a role or a ladder step`
				).toBe(true);
			}
		}
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.5 Slice 3 inspector density + selection isolation', () => {
	it('restyles the shared number field as a compact 28px axis-chip row (no forked row component)', () => {
		const field = readLibSource('editor/fields/EditorNumberField.svelte');
		expect(field).toContain('height: 28px;');
		expect(field).toContain('axis-chip');
		expect(field).toContain('width: 18px;');
		expect(field).toContain('height: 18px;');
		expect(field).toContain('font-variant-numeric: tabular-nums;');
		expect(field).toContain("data-tone={chipTone}");
		expect(field).toContain('aria-label={label}');
		// Axis tones follow the canonical gizmo mapping (X red / Y green / Z
		// blue), resolved through the canonical `--editor-axis-*` tokens (issue
		// #35) — never duplicated hex literals. The chip background keeps the
		// established 15% axis opacity over the field control background.
		expect(field).toContain("data-tone='x'");
		for (const axis of ['x', 'y', 'z'] as const) {
			expect(field).toContain(`var(--editor-axis-${axis})`);
			expect(field, `duplicated axis hex for ${axis}`).not.toMatch(
				new RegExp(AXIS_HEX[axis], 'i')
			);
		}
		expect(field).toContain('15%');
		// No TransformInputRow fork exists; the shared field is reused.
		expect(fs.existsSync(path.join(LIB_DIR, 'editor/components/TransformInputRow.svelte'))).toBe(false);
		const vec3 = readLibSource('editor/fields/EditorVec3Field.svelte');
		expect(vec3).toContain('axis-chip');
		expect(vec3).toContain('height: 28px;');
		expect(vec3).toContain('font-variant-numeric: tabular-nums;');
		// Same canonical-token rule for the Vec3 rows (issue #35).
		for (const axis of ['x', 'y', 'z']) {
			expect(vec3).toContain(`var(--editor-axis-${axis})`);
			expect(vec3, `duplicated axis hex for ${axis}`).not.toMatch(
				new RegExp(AXIS_HEX[axis], 'i')
			);
		}
		expect(vec3).toContain('15%');
	});
	it('folds the transform axis legend into per-field chips (density only, scale semantics intact)', () => {
		const inspector = readLibSource('editor/EditorTransformInspector.svelte');
		expect(inspector).not.toContain('axis-legend');
		expect(inspector).toContain('.field-grid');
		expect(inspector).toContain('toggleScaleMode');
		expect(inspector).toContain("scaleMode === 'uniform'");
		expect(inspector).toContain("scaleMode === 'independent'");
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.5 Slice 4 inspector typography + theme sweep', () => {
	it('maps the Inspector type shorthands onto their ratified roles', () => {
		// The ladder itself (steps, the knob, closure) is owned by
		// `tests/lib/editor/app/shell-type-roles.test.ts`; what only a mapping
		// assertion can catch is a role swapped for another *valid* role —
		// closing the ladder does not notice `--editor-font-size-label` pointing
		// at `lg` instead of `md`.
		const tokens = readLibSource('editor/styles/tokens.css');
		expect(tokens).toContain('--editor-font-size-section: var(--editor-font-size-xs);');
		expect(tokens).toContain('--editor-font-size-label: var(--editor-font-size-md);');
		expect(tokens).toContain('--editor-font-size-input: var(--editor-font-size-md);');
		const inspectorTokens = readLibSource('editor/styles/inspector.css');
		expect(inspectorTokens).toContain('--editor-inspector-value: var(--editor-type-property);');
		expect(inspectorTokens).toContain('--editor-inspector-section-title: var(--editor-type-engraved);');
	});
	it('renders Inspector section headers as 11px uppercase muted across every panel', () => {
		const tier = [
			'font-size: 11px;',
			'font-weight: 600;',
			'letter-spacing: 0.05em;',
			'text-transform: uppercase;',
			'color: var(--editor-text-muted);'
		];
		for (const component of [
			'editor/EditorInspector.svelte',
			'editor/EditorTransformInspector.svelte',
			'editor/EditorPlacementInspector.svelte',
			'editor/app/CameraPlanInspector.svelte',
			'editor/camera/EditorCameraInspector.svelte',
			'editor/camera/EditorCameraConnectionTiming.svelte',
			'editor/EditorLightInspector.svelte',
			'editor/EditorPrimitiveInspector.svelte',
			'editor/EditorMaterialInspector.svelte'
		]) {
			const source = readLibSource(component);
			for (const fragment of tier) {
				expect(source, `${component} misses section-header tier ${fragment}`).toContain(fragment);
			}
		}
	});
	it('keeps Inspector property labels at 12px secondary and values at 12.5px tabular primary', () => {
		// EditorTransformInspector carries no label/value rows of its own —
		// its Position/Rotation/Scale rows reuse the shared number field.
		for (const component of [
			'editor/EditorInspector.svelte',
			'editor/EditorPlacementInspector.svelte',
			'editor/app/CameraPlanInspector.svelte',
			'editor/camera/EditorCameraInspector.svelte',
			'editor/camera/EditorCameraConnectionTiming.svelte',
			'editor/EditorLightInspector.svelte',
			'editor/EditorPrimitiveInspector.svelte',
			'editor/EditorMaterialInspector.svelte'
		]) {
			const source = readLibSource(component);
			expect(source, `${component} misses label tier`).toContain('font-size: 12px;');
			expect(source, `${component} misses value tier`).toContain('12.5px');
		}
		// Tabular numerals on every panel with numeric rows (coordinates,
		// dimensions, angles, timing). The Material panel carries no numeric
		// rows of its own — its roughness/metalness rows reuse the shared
		// number field pinned below.
		for (const component of [
			'editor/EditorInspector.svelte',
			'editor/EditorPlacementInspector.svelte',
			'editor/app/CameraPlanInspector.svelte',
			'editor/camera/EditorCameraInspector.svelte',
			'editor/camera/EditorCameraConnectionTiming.svelte',
			'editor/EditorLightInspector.svelte',
			'editor/EditorPrimitiveInspector.svelte'
		]) {
			expect(readLibSource(component), `${component} misses tabular values`).toContain(
				'font-variant-numeric: tabular-nums;'
			);
		}
	});
	it('reads Inspector numeric fields through the shared 12.5px tabular inputs (no fork)', () => {
		for (const component of [
			'editor/fields/EditorNumberField.svelte',
			'editor/fields/EditorVec3Field.svelte',
			'editor/fields/EditorProgressField.svelte'
		]) {
			const source = readLibSource(component);
			expect(source, `${component} misses value tier`).toContain(
				'font: 500 12.5px var(--editor-font);'
			);
			expect(source, `${component} misses tabular values`).toContain(
				'font-variant-numeric: tabular-nums;'
			);
		}
	});
});
