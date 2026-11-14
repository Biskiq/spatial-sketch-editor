/**
 * X7 — the Scene adapter keeps its extracted owners.
 *
 * `scene.adapter.ts` used to be one 2,500-line closure holding every Place,
 * mark-gesture and contribution lifetime at once. X7 split it; this guard keeps
 * it split. Each owned module may be executed by exactly one importer (the
 * adapter), may not import a sibling owner, and may not reach an acceptance
 * path, a renderer or another adapter. The adapter itself declares no state, no
 * timer, no lease and no write: it registers, composes and dispatches.
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
const SCENE = path.join(ADAPTERS, 'scene');
const ADAPTER = path.join(ADAPTERS, 'scene.adapter.ts');
const PLACEMENT_BINDING = path.join(SCENE, 'placement-binding.ts');
const OBJECT_MARK_SESSION = path.join(SCENE, 'object-mark-session.ts');
const SCENE_CONTRIBUTIONS = path.join(SCENE, 'scene-contributions.ts');
const CANDIDATE_PRESENTER = path.join(SCENE, 'candidate-presenter.ts');
const POINTER_SUPPORT = path.join(SCENE, 'pointer-support.ts');
const OBJECT_READINGS = path.join(SCENE, 'object-readings.ts');
const SCENE_TASK_IDS = path.join(SCENE, 'scene-task-ids.ts');
const PLACEMENT = path.join(SCENE, 'placement.ts');

const STAGE_ADAPTER_HOST = path.join(EDITOR_LIB, 'authoring/stage/stage-adapter-host.ts');
const HOST_ACCEPTANCE = path.join(EDITOR_LIB, 'authoring/stage/host-acceptance.ts');
const STAGE_FACADE = path.join(EDITOR_LIB, 'authoring/stage/stage-facade.ts');

/** The four owners the adapter composes; each is imported only by the adapter. */
const OWNERS = [PLACEMENT_BINDING, OBJECT_MARK_SESSION, SCENE_CONTRIBUTIONS, CANDIDATE_PRESENTER];
/** Leaves any owner may read; they hold no lifetime and import no owner. */
const LEAVES = [POINTER_SUPPORT, OBJECT_READINGS, SCENE_TASK_IDS];
const X7_FILES = [ADAPTER, ...OWNERS, ...LEAVES];

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

describe('Scene adapter boundary (X7)', () => {
	it('names files that exist', () => {
		for (const file of [...X7_FILES, PLACEMENT, STAGE_ADAPTER_HOST]) {
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
	});

	it('keeps the owners independent of one another and of the adapter', () => {
		const forbidden = new Set([ADAPTER, ...OWNERS]);
		for (const file of [...OWNERS, ...LEAVES]) {
			const direct = [
				...new Set(
					edgesOf(file)
						.filter((edge) => forbidden.has(edge.target) && edge.target !== file)
						.map((edge) => `${edge.typeOnly ? 'type ' : ''}${relativeToRepo(edge.target)}`)
				)
			];
			// The presenter's view type is the one named contract between the placement
			// binding and the presenter, and it is declared by the presenter.
			const allowed =
				file === PLACEMENT_BINDING ? [`type ${relativeToRepo(CANDIDATE_PRESENTER)}`] : [];
			expect(direct, relativeToRepo(file)).toEqual(allowed);
		}
	});

	it('keeps the leaves free of lifetimes: no owner, no session, no acceptance', () => {
		for (const leaf of LEAVES) {
			const targets = executableTargets(leaf);
			expect(targets.filter((target) => OWNERS.includes(target)), relativeToRepo(leaf)).toEqual([]);
			expect(targets, relativeToRepo(leaf)).not.toContain(HOST_ACCEPTANCE);
			expect(targets, relativeToRepo(leaf)).not.toContain(STAGE_FACADE);
		}
	});

	it('reaches no acceptance path, renderer, visitor module or other adapter from any X7 module', () => {
		for (const file of X7_FILES) {
			const offenders = reachable(file)
				.filter((target) => {
					const relative = relativeToRepo(target);
					if (FORBIDDEN_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
					if (target === HOST_ACCEPTANCE || target === STAGE_FACADE) return true;
					// Another adapter, or its private modules, is a second owner.
					if (target.startsWith(`${ADAPTERS}${path.sep}`) && target !== ADAPTER) {
						return !target.startsWith(`${SCENE}${path.sep}`);
					}
					return false;
				})
				.map(relativeToRepo);
			expect(offenders, relativeToRepo(file)).toEqual([]);
		}
	});

	it('gives the presenter and the contributions no way to open a placement surface', () => {
		const surfaceOwners = new Set([
			'publishSceneSurface',
			'retireSceneSurface',
			'sceneSessionFromServices'
		]);
		for (const file of [CANDIDATE_PRESENTER, SCENE_CONTRIBUTIONS, OBJECT_MARK_SESSION, ...LEAVES]) {
			const imported = edgesOf(file)
				.filter((edge) => edge.target === PLACEMENT && edge.imported !== undefined)
				.map((edge) => edge.imported!)
				.filter((name) => surfaceOwners.has(name));
			expect(imported, relativeToRepo(file)).toEqual([]);
		}
		// The presenter reads a published surface through its view, never directly.
		expect(
			edgesOf(CANDIDATE_PRESENTER).filter(
				(edge) => edge.target === PLACEMENT && !edge.typeOnly
			)
		).toEqual([]);
	});

	it('keeps every lifetime in exactly one module', () => {
		const sourceOf = (file: string) => fs.readFileSync(file, 'utf8');
		const owners: ReadonlyArray<readonly [string, readonly string[], string]> = [
			['acquireGesture(', [OBJECT_MARK_SESSION, PLACEMENT, path.join(SCENE, 'shape/draw-session.ts')], 'gesture leases'],
			['abortReopen', [PLACEMENT_BINDING], 'the deferred Place reopen'],
			['taskEpoch', [PLACEMENT_BINDING], 'the close-beats-install epoch'],
			['placementCommit', [PLACEMENT_BINDING], 'the held release'],
			['objectMarkGesture', [OBJECT_MARK_SESSION], 'the mark gesture'],
			['setPlacementCommittedListener(', [PLACEMENT_BINDING, PLACEMENT], 'placement completion'],
			['createObjectDrawSession(', [PLACEMENT_BINDING, path.join(SCENE, 'shape/draw-session.ts')], 'the drawn tile'],
			['publishSceneSurface(', [PLACEMENT_BINDING, PLACEMENT], 'surface publication']
		];
		for (const [needle, expected, what] of owners) {
			const holders = X7_FILES.filter((file) => sourceOf(file).includes(needle));
			expect(
				holders.filter((file) => !expected.includes(file)).map(relativeToRepo),
				`${what} (${needle}) must live only in its owner`
			).toEqual([]);
		}
	});

	it('leaves the adapter as registration, composition and dispatch', () => {
		const source = fs.readFileSync(ADAPTER, 'utf8');
		// No state machine: no mutable binding, timer, lease, selection or write.
		expect(source).not.toMatch(/\blet\s+\w+/);
		expect(source).not.toContain('setTimeout(');
		expect(source).not.toContain('acquireGesture(');
		expect(source).not.toContain('setSelection(');
		expect(source).not.toContain('notifySurfaceChange(');
		expect(source).not.toContain('accept(');
		expect(source).not.toContain('sceneSurfaceFor(');
		// It composes each owner exactly once per bind.
		for (const factory of [
			'createPlacementBinding(',
			'createObjectMarkSession(',
			'createSceneContributions('
		]) {
			expect(source.split(factory).length - 1, factory).toBe(1);
		}
		expect(source.split('\n').length).toBeLessThan(300);
	});

	it('never duplicates the old gesture state machines outside their owners', () => {
		for (const file of walk(ADAPTERS)) {
			if (file === OBJECT_MARK_SESSION || file === PLACEMENT_BINDING) continue;
			const source = fs.readFileSync(file, 'utf8');
			expect(source, relativeToRepo(file)).not.toContain('function endObjectMarkGesture');
			expect(source, relativeToRepo(file)).not.toContain('function commitPointerPlace');
			expect(source, relativeToRepo(file)).not.toContain('function reopenPlace');
		}
	});

	it('sees a forbidden edge hidden behind a local barrel', () => {
		const sources = {
			'a/owner.ts': "import { sceneSession } from './barrel';",
			'a/barrel.ts': "export * from './deep';",
			'a/deep.ts': "export { sceneSession } from './acceptance';",
			'a/acceptance.ts': 'export const sceneSession = 1;'
		};
		expect(reaches(sources, 'a/owner.ts', 'a/acceptance.ts')).toBe(true);
		expect(
			reaches(
				{ ...sources, 'a/deep.ts': "export const sceneSession = 2;" },
				'a/owner.ts',
				'a/acceptance.ts'
			)
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
