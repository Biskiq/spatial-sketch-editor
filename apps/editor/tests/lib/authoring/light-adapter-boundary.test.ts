/**
 * X8 — the Light adapter keeps its extracted owners.
 *
 * `light.adapter.ts` used to be one 2,100-line closure holding the placement
 * capture, the mark gestures, the lease, the grip refusal and every contribution
 * at once. X8 split it; this guard keeps it split. Three owners are executed by
 * exactly one importer (the adapter), import no sibling owner and reach no
 * acceptance path, renderer, visitor module or other adapter. The pure leaves
 * hold no lifetime. The binding's one lease, refusal slot, install window and
 * preview publication each live in `light-session-ports` and nowhere else. The
 * adapter declares no state, no timer, no lease and no write: it registers,
 * composes and dispatches.
 *
 * Imports are read with the shared import-closure reader, so aliases,
 * namespaces, re-exports and dynamic imports all count. A synthetic closure
 * proves a local barrel cannot hide a forbidden edge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	EDITOR_SRC,
	moduleBindingEdges,
	relativeToRepo,
	resolveSpecifier
} from '../../helpers/import-closure';

const ADAPTERS = path.join(EDITOR_LIB, 'authoring/adapters');
const LIGHT = path.join(ADAPTERS, 'light');
const SCENE = path.join(ADAPTERS, 'scene');
const ADAPTER = path.join(ADAPTERS, 'light.adapter.ts');
const PLACEMENT_SESSION = path.join(LIGHT, 'light-placement-session.ts');
const GESTURE_SESSION = path.join(LIGHT, 'light-gesture-session.ts');
const CONTRIBUTIONS = path.join(LIGHT, 'light-contributions.ts');
const PORTS = path.join(LIGHT, 'light-session-ports.ts');
const LIGHT_MATH = path.join(LIGHT, 'light-math.ts');
const LIGHT_SUBJECTS = path.join(LIGHT, 'light-subjects.ts');
const LIGHT_GUIDES = path.join(LIGHT, 'light-guides.ts');
const LIGHT_MARKS = path.join(LIGHT, 'light-marks.ts');
const LIGHT_CARD = path.join(LIGHT, 'light-card.ts');
const LIGHT_ACTIONS = path.join(LIGHT, 'light-actions.ts');

const STAGE_ADAPTER_HOST = path.join(EDITOR_LIB, 'authoring/stage/stage-adapter-host.ts');
const HOST_ACCEPTANCE = path.join(EDITOR_LIB, 'authoring/stage/host-acceptance.ts');
const STAGE_FACADE = path.join(EDITOR_LIB, 'authoring/stage/stage-facade.ts');

/** The three owners the adapter composes; each is imported only by the adapter. */
const OWNERS = [PLACEMENT_SESSION, GESTURE_SESSION, CONTRIBUTIONS];
/** Pure readers and presenters: no session, no lifetime of their own. */
const LEAVES = [LIGHT_MATH, LIGHT_SUBJECTS, LIGHT_GUIDES, LIGHT_MARKS, LIGHT_CARD, LIGHT_ACTIONS];
const X8_FILES = [ADAPTER, ...OWNERS, PORTS, ...LEAVES];

type ResolvedEdge = {
	readonly kind: string;
	readonly specifier: string;
	readonly target: string;
	readonly typeOnly: boolean;
	readonly imported?: string;
};

function edgesOf(file: string): ResolvedEdge[] {
	const source = fs.readFileSync(file, 'utf8');
	const resolved: ResolvedEdge[] = [];
	for (const edge of moduleBindingEdges(file, source)) {
		if (!('specifier' in edge)) continue;
		const target = resolveSpecifier(file, edge.specifier);
		if (target === null) continue;
		resolved.push({
			kind: edge.kind,
			specifier: edge.specifier,
			target,
			typeOnly: 'typeOnly' in edge && edge.typeOnly,
			...('imported' in edge ? { imported: edge.imported } : {})
		});
	}
	return resolved;
}

const executableTargets = (file: string): string[] =>
	edgesOf(file)
		.filter((edge) => !edge.typeOnly)
		.map((edge) => edge.target);

function walk(directory: string, files: string[] = []): string[] {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) walk(full, files);
		else if (/\.(ts|svelte)$/.test(entry.name)) files.push(full);
	}
	return files;
}

/** Every executable module reachable from `root`, stopping at the public Stage boundary. */
function reachable(root: string): string[] {
	const boundary = new Set([STAGE_ADAPTER_HOST]);
	const seen = new Set([root]);
	const pending = [root];
	const reached = new Set<string>();
	while (pending.length > 0) {
		const file = pending.pop()!;
		for (const target of executableTargets(file)) {
			if (seen.has(target)) continue;
			seen.add(target);
			if (boundary.has(target)) continue;
			reached.add(target);
			pending.push(target);
		}
	}
	return [...reached];
}

function reaches(sources: Record<string, string>, root: string, forbidden: string): boolean {
	const seen = new Set<string>();
	const pending = [root];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		if (file === forbidden) return true;
		for (const edge of moduleBindingEdges(file, sources[file] ?? '')) {
			if (!('specifier' in edge)) continue;
			if ('typeOnly' in edge && edge.typeOnly === true) continue;
			const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), edge.specifier));
			const resolved = target in sources ? target : `${target}.ts`;
			if (!(resolved in sources)) continue;
			pending.push(resolved);
		}
	}
	return false;
}

const FORBIDDEN_PREFIXES = [
	'apps/editor/src/lib/render/',
	'apps/editor/src/lib/authoring/f4/',
	'apps/editor/src/lib/visitor/'
] as const;

const sourceOf = (file: string): string => fs.readFileSync(file, 'utf8');

describe('Light adapter boundary (X8)', () => {
	it('names files that exist', () => {
		for (const file of [...X8_FILES, STAGE_ADAPTER_HOST]) {
			expect(fs.existsSync(file), relativeToRepo(file)).toBe(true);
		}
	});

	it('lets only the adapter execute an owner', () => {
		const importers = new Map<string, string[]>(OWNERS.map((owner) => [owner, []]));
		for (const file of walk(EDITOR_SRC)) {
			for (const target of executableTargets(file)) {
				if (importers.has(target) && !importers.get(target)!.includes(relativeToRepo(file))) {
					importers.get(target)!.push(relativeToRepo(file));
				}
			}
		}
		for (const owner of OWNERS) {
			expect(importers.get(owner), relativeToRepo(owner)).toEqual([relativeToRepo(ADAPTER)]);
		}
	}, 60_000);

	it('keeps the owners, ports and leaves independent of one another and of the adapter', () => {
		const forbidden = new Set([ADAPTER, ...OWNERS]);
		for (const file of [...OWNERS, PORTS, ...LEAVES]) {
			const direct = [
				...new Set(
					edgesOf(file)
						.filter((edge) => forbidden.has(edge.target) && edge.target !== file)
						.map((edge) => `${edge.typeOnly ? 'type ' : ''}${relativeToRepo(edge.target)}`)
				)
			];
			// The contributions read the captured gesture through its published view type.
			const allowed =
				file === CONTRIBUTIONS ? [`type ${relativeToRepo(GESTURE_SESSION)}`] : [];
			expect(direct, relativeToRepo(file)).toEqual(allowed);
		}
	});

	it('keeps the leaves and ports free of a session, an acceptance path and a Stage facade', () => {
		for (const leaf of [...LEAVES, PORTS]) {
			const targets = executableTargets(leaf);
			expect(targets.filter((target) => OWNERS.includes(target)), relativeToRepo(leaf)).toEqual([]);
			expect(targets, relativeToRepo(leaf)).not.toContain(HOST_ACCEPTANCE);
			expect(targets, relativeToRepo(leaf)).not.toContain(STAGE_FACADE);
		}
	});

	it('reaches no acceptance path, renderer, visitor module or other adapter from any X8 module', () => {
		for (const file of X8_FILES) {
			const offenders = reachable(file)
				.filter((target) => {
					const relative = relativeToRepo(target);
					if (FORBIDDEN_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
					if (target === HOST_ACCEPTANCE || target === STAGE_FACADE) return true;
					// Another adapter, or its private modules, is a second owner. The Light
					// adapter reads the Scene adapter's placement and form-command helpers only.
					if (target.startsWith(`${ADAPTERS}${path.sep}`)) {
						return (
							!target.startsWith(`${LIGHT}${path.sep}`) &&
							!target.startsWith(`${SCENE}${path.sep}`)
						);
					}
					return false;
				})
				.map(relativeToRepo);
			expect(offenders, relativeToRepo(file)).toEqual([]);
		}
	}, 60_000);

	it('keeps every lifetime in exactly one module', () => {
		const owners: ReadonlyArray<readonly [string, readonly string[], string]> = [
			['acquireGesture(', [PORTS], 'the one gesture lease'],
			['setOverride(', [PORTS], 'the dragged-light preview'],
			['setCandidate(', [PLACEMENT_SESSION], 'the placement candidate light'],
			['armedLightKind(', [PLACEMENT_SESSION], 'the armed Light kind'],
			['clearArmedLight(', [PLACEMENT_SESSION], 'disarming'],
			['let placementRefusal', [PLACEMENT_SESSION], 'the refused-release ghost'],
			['let placing', [PLACEMENT_SESSION], 'the held release'],
			['let gesture', [GESTURE_SESSION], 'the captured mark gesture'],
			['let hoveredDialTick', [CONTRIBUTIONS], 'the idle dial-tick tag'],
			['let refusal', [PORTS], 'the grip refusal'],
			['let lease', [PORTS], 'the lease slot'],
			// Placement's one create, and the Card's own "Light it" recipe action.
			['.authoring.accept(', [PLACEMENT_SESSION, LIGHT_ACTIONS], 'direct acceptance'],
			// The adapter only registers the planner kinds it writes through.
			["'update-light'", [ADAPTER, GESTURE_SESSION, LIGHT_MARKS], 'the mark-edit planner'],
			["'create-light'", [ADAPTER, PLACEMENT_SESSION, LIGHT_ACTIONS], 'the creation planner']
		];
		for (const [needle, expected, what] of owners) {
			const holders = X8_FILES.filter((file) => sourceOf(file).includes(needle));
			expect(
				holders.filter((file) => !expected.includes(file)).map(relativeToRepo),
				`${what} (${needle}) must live only in its owner`
			).toEqual([]);
		}
	});

	it('keeps timers out of every X8 module', () => {
		for (const file of X8_FILES) {
			expect(sourceOf(file), relativeToRepo(file)).not.toContain('setTimeout(');
			expect(sourceOf(file), relativeToRepo(file)).not.toContain('requestAnimationFrame(');
		}
	});

	it('leaves the adapter as registration, composition and dispatch', () => {
		const source = sourceOf(ADAPTER);
		// No state machine: no mutable binding, timer, lease or write.
		expect(source).not.toMatch(/\blet\s+\w+/);
		expect(source).not.toContain('setTimeout(');
		expect(source).not.toContain('acquireGesture(');
		expect(source).not.toContain('setSelection(');
		expect(source).not.toContain('setOverride(');
		expect(source).not.toContain('setCandidate(');
		expect(source).not.toContain('accept(');
		expect(source).not.toContain('acceptFormCommand(');
		// It composes each port and owner exactly once per bind.
		for (const factory of [
			'createLightLease(',
			'createLightRefusal(',
			'createLightInstallWindow(',
			'createLightGestureSession(',
			'createLightPlacementSession(',
			'createLightContributions('
		]) {
			expect(source.split(factory).length - 1, factory).toBe(1);
		}
	});

	it('never duplicates the old gesture state machines outside their owners', () => {
		for (const file of walk(ADAPTERS)) {
			if (file === GESTURE_SESSION || file === PLACEMENT_SESSION) continue;
			const source = sourceOf(file);
			expect(source, relativeToRepo(file)).not.toContain('function commitGesture');
			expect(source, relativeToRepo(file)).not.toContain('function commitPlacement');
			expect(source, relativeToRepo(file)).not.toContain('function updateGesture');
		}
	});

	it('sees a forbidden edge hidden behind a local barrel', () => {
		const sources = {
			'a/owner.ts': "import { session } from './barrel';",
			'a/barrel.ts': "export * from './deep';",
			'a/deep.ts': "export { session } from './acceptance';",
			'a/acceptance.ts': 'export const session = 1;'
		};
		expect(reaches(sources, 'a/owner.ts', 'a/acceptance.ts')).toBe(true);
		expect(
			reaches({ ...sources, 'a/deep.ts': 'export const session = 2;' }, 'a/owner.ts', 'a/acceptance.ts')
		).toBe(false);
		// Namespace and dynamic imports count as well.
		expect(
			reaches(
				{ 'a/owner.ts': "const m = await import('./acceptance');", 'a/acceptance.ts': '' },
				'a/owner.ts',
				'a/acceptance.ts'
			)
		).toBe(true);
		expect(
			reaches(
				{ 'a/owner.ts': "import * as all from './acceptance';", 'a/acceptance.ts': '' },
				'a/owner.ts',
				'a/acceptance.ts'
			)
		).toBe(true);
	});
});
