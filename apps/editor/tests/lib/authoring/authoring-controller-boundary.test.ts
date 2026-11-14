/**
 * X1/X2 / schedule guarantee — cohesive controllers, no new God module.
 *
 * The route's extracted controllers may compose only the owners their contract
 * names. They must not import the route, a renderer, an adapter implementation,
 * an F4 planner or another sibling's mutable internals; a controller that could
 * read those directly would be a parallel owner wearing a new filename.
 *
 * X2 adds the input arbiter, keyboard leaf, Unfold-session owner and Artwork
 * interaction owner. The guard also proves they share the route's one press
 * tracker instead of constructing a second drag/click authority, and that none
 * of them becomes a replacement or acceptance writer.
 *
 * Direct imports are read with the shared import-closure reader so aliases,
 * namespaces, re-exports and dynamic imports all count. A synthetic closure
 * proves a local re-export barrel cannot hide a forbidden edge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	EDITOR_SRC,
	REPO_ROOT,
	moduleBindingEdges,
	relativeToRepo,
	resolveSpecifier
} from '../../helpers/import-closure';

const ROUTE = path.join(EDITOR_SRC, 'routes/project/[projectId]/spatial/+page.svelte');
const STAGE_DIR = path.join(EDITOR_LIB, 'authoring/stage');
const STAGE_ROUTE_DIR = path.join(STAGE_DIR, 'route');
const EPOCH = path.join(STAGE_ROUTE_DIR, 'stage-project-epoch.svelte.ts');
const ASSETS = path.join(STAGE_ROUTE_DIR, 'stage-asset-leases.svelte.ts');
const INPUT = path.join(STAGE_ROUTE_DIR, 'stage-input.svelte.ts');
const KEYBOARD = path.join(STAGE_ROUTE_DIR, 'stage-keyboard.ts');
const UNFOLD = path.join(STAGE_ROUTE_DIR, 'stage-unfold-gestures.svelte.ts');
const ARTWORK = path.join(STAGE_ROUTE_DIR, 'stage-artwork-interaction.svelte.ts');
const STAGE_INPUT = path.join(STAGE_DIR, 'stage-input.ts');
const STAGE_WHEEL_ZOOM = path.join(STAGE_DIR, 'stage-wheel-zoom.ts');
const STAGE_GLYPHS = path.join(STAGE_DIR, 'stage-glyphs.ts');
const SEMANTIC_SELECTION = path.join(STAGE_DIR, 'semantic-selection.ts');
const WALL_UNFOLD = path.join(EDITOR_LIB, 'layout/wall-unfold.ts');
const WALL_UNFOLD_PICK = path.join(EDITOR_LIB, 'layout/wall-unfold-pick.ts');
const WALL_UNFOLD_OPENING_DRAG = path.join(EDITOR_LIB, 'layout/wall-unfold-opening-drag.ts');
const WALL_UNFOLD_STORE = path.join(EDITOR_LIB, 'authoring/layout/wall-unfold-store.svelte.ts');
const LAYOUT_PRECISION = path.join(EDITOR_LIB, 'authoring/adapters/layout/precision.ts');
const LAYOUT_OPENING_PLANNERS = path.join(EDITOR_LIB, 'authoring/adapters/layout/opening-planners.ts');
const ARTWORK_RESIZE = path.join(EDITOR_LIB, 'authoring/artwork/artwork-resize.ts');
const ARTWORK_HANGING = path.join(EDITOR_LIB, 'authoring/artwork/artwork-hanging.ts');
const ARTWORK_COMMAND = path.join(EDITOR_LIB, 'authoring/artwork/artwork-command.ts');
const ARTWORK_PLACEMENT = path.join(EDITOR_LIB, 'authoring/artwork/artwork-placement.ts');
const ARTWORK_WALL_MOVE = path.join(EDITOR_LIB, 'authoring/artwork/artwork-wall-move.ts');
const ARTWORK_AUTHORING = path.join(EDITOR_LIB, 'authoring/artwork/artwork-authoring.svelte.ts');
const PROJECT_MODEL_INDEX = path.join(REPO_ROOT, 'packages/project-model/src/index.ts');
const CAMERA_CORE = path.join(REPO_ROOT, 'packages/camera-core/src/index.ts');
const STAGE_ADAPTER_HOST = path.join(STAGE_DIR, 'stage-adapter-host.ts');
const STAGE_FACADE = path.join(STAGE_DIR, 'stage-facade.ts');
const HOST_ACCEPTANCE = path.join(STAGE_DIR, 'host-acceptance.ts');
const STAGE_SESSION = path.join(STAGE_DIR, 'stage-session.ts');
const UNIT_STAGE_SOURCE = path.join(STAGE_DIR, 'unit-stage-source.ts');
const ACCEPTED_READ = path.join(STAGE_DIR, 'accepted-read.ts');
const PERF_MARKS = path.join(EDITOR_LIB, 'platform/perf-marks.ts');
const MODEL_BYTES = path.join(EDITOR_LIB, 'authoring/scene/model-bytes.ts');
const ARTWORK_SCOPE = path.join(EDITOR_LIB, 'render/artwork/artwork-scope.ts');

/**
 * The owner modules each extracted controller is allowed to execute.
 *
 * These boundaries are opaque: the owner is responsible for its own closure,
 * so the indirect walk neither follows its internals nor accuses the controller
 * of a dependency the owner legitimately acquired. A local barrel or re-export
 * is *not* a boundary and is always followed to its actual targets.
 */
const APPROVED_BOUNDARIES: Readonly<Record<string, ReadonlySet<string>>> = {
	[EPOCH]: new Set([
		STAGE_ADAPTER_HOST,
		STAGE_FACADE,
		HOST_ACCEPTANCE,
		STAGE_SESSION,
		UNIT_STAGE_SOURCE,
		PERF_MARKS
	]),
	[ASSETS]: new Set([
		MODEL_BYTES,
		ARTWORK_SCOPE,
		STAGE_SESSION,
		UNIT_STAGE_SOURCE,
		ACCEPTED_READ
	]),
	[INPUT]: new Set([
		STAGE_INPUT,
		STAGE_WHEEL_ZOOM,
		STAGE_GLYPHS,
		SEMANTIC_SELECTION,
		PERF_MARKS,
		CAMERA_CORE
	]),
	[KEYBOARD]: new Set([STAGE_INPUT]),
	[UNFOLD]: new Set([
		WALL_UNFOLD,
		WALL_UNFOLD_PICK,
		WALL_UNFOLD_OPENING_DRAG,
		WALL_UNFOLD_STORE,
		LAYOUT_PRECISION,
		LAYOUT_OPENING_PLANNERS,
		UNIT_STAGE_SOURCE,
		CAMERA_CORE
	]),
	[ARTWORK]: new Set([
		ARTWORK_RESIZE,
		ARTWORK_HANGING,
		ARTWORK_COMMAND,
		ARTWORK_PLACEMENT,
		ARTWORK_WALL_MOVE,
		ARTWORK_AUTHORING,
		// The transform intent kind is an existing model owner. The workspace
		// resolver folds the package subpath into this barrel, so the approved
		// boundary is the model package rather than a scene-planning leaf.
		PROJECT_MODEL_INDEX,
		CAMERA_CORE
	])
};

const X2_CONTROLLERS = new Set([INPUT, KEYBOARD, UNFOLD, ARTWORK]);

const FORBIDDEN_PREFIXES = [
	'apps/editor/src/lib/authoring/adapters/',
	'apps/editor/src/lib/authoring/f4/'
] as const;
const FORBIDDEN_PACKAGES = new Set([
	'packages/layout-core/src/index.ts',
	'packages/project-model/src/index.ts'
]);

/** Every executable non-boundary module reachable from one actual controller. */
function indirectTargets(root: string, boundaries: ReadonlySet<string>): string[] {
	const seen = new Set([root]);
	const pending = [root];
	const reached = new Set<string>();
	while (pending.length > 0) {
		const file = pending.pop()!;
		const source = fs.readFileSync(file, 'utf8');
		for (const edge of moduleBindingEdges(file, source)) {
			if (!('specifier' in edge)) continue;
			if ('typeOnly' in edge && edge.typeOnly) continue;
			const target = resolveSpecifier(file, edge.specifier);
			if (target === null || seen.has(target)) continue;
			seen.add(target);
			if (boundaries.has(target)) continue;
			reached.add(target);
			pending.push(target);
		}
	}
	return [...reached];
}

function forbiddenIndirect(controller: string, target: string): boolean {
	const relative = relativeToRepo(target);
	if (relative === relativeToRepo(ROUTE)) return true;
	if (FORBIDDEN_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
	if (FORBIDDEN_PACKAGES.has(relative)) return true;
	if (controller === EPOCH) return relative.startsWith('apps/editor/src/lib/render/');
	if (controller === ASSETS) {
		if (relative.startsWith('apps/editor/src/lib/render/')) return true;
		return target === HOST_ACCEPTANCE || target === STAGE_ADAPTER_HOST || target === STAGE_FACADE;
	}
	if (X2_CONTROLLERS.has(controller)) {
		if (target === HOST_ACCEPTANCE || target === STAGE_ADAPTER_HOST || target === STAGE_FACADE) return true;
		if (relative.startsWith('apps/editor/src/lib/render/')) return true;
	}
	return false;
}

type ResolvedEdge = {
	readonly kind: string;
	readonly specifier: string;
	readonly target: string;
	readonly typeOnly: boolean;
};

function edgesOf(file: string): ResolvedEdge[] {
	const source = fs.readFileSync(file, 'utf8');
	const resolved: ResolvedEdge[] = [];
	for (const edge of moduleBindingEdges(file, source)) {
		// `export-local` is a local alias, not a module dependency.
		if (!('specifier' in edge)) continue;
		const target = resolveSpecifier(file, edge.specifier);
		if (target === null) continue;
		resolved.push({
			kind: edge.kind,
			specifier: edge.specifier,
			target,
			typeOnly: 'typeOnly' in edge && edge.typeOnly
		});
	}
	return resolved;
}

function executable(edges: readonly ResolvedEdge[]): ResolvedEdge[] {
	return edges.filter((edge) => !edge.typeOnly);
}

/** Repository-relative prefix test (paths use `/` on every platform here). */
function under(file: string, directory: string): boolean {
	return file === directory || file.startsWith(`${directory}/`);
}

/**
 * A synthetic transitive import walk over virtual sources. It follows the same
 * edge shapes as `moduleBindingEdges`: named, aliased, namespace, export *,
 * re-export and dynamic imports.
 */
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

describe('authoring controller boundary (X1/X2)', () => {
	it('never lets an extracted controller import the route', () => {
		for (const file of [EPOCH, ASSETS, INPUT, KEYBOARD, UNFOLD, ARTWORK]) {
			expect(edgesOf(file).filter((edge) => edge.target === ROUTE), relativeToRepo(file)).toEqual([]);
		}
	});

	it('finds no forbidden dependency indirectly from the actual extracted controllers', () => {
		for (const controller of [EPOCH, ASSETS, INPUT, KEYBOARD, UNFOLD, ARTWORK]) {
			const boundaries = APPROVED_BOUNDARIES[controller]!;
			// An allowlist naming a missing owner would silently stop guarding the
			// boundary it was meant to respect.
			for (const boundary of boundaries) expect(fs.existsSync(boundary), relativeToRepo(boundary)).toBe(true);
			const offenders = indirectTargets(controller, boundaries)
				.filter((target) => forbiddenIndirect(controller, target))
				.map(relativeToRepo);
			expect(offenders, relativeToRepo(controller)).toEqual([]);
		}
	});

	it('keeps the project epoch on the existing session/acceptance/adapter owners', () => {
		const editable = executable(edgesOf(EPOCH)).map((edge) => relativeToRepo(edge.target));
		const forbidden = [
			'packages/layout-core/src/index.ts',
			'packages/project-model/src/index.ts',
			'apps/editor/src/lib/authoring/adapters/layout.adapter.ts'
		];
		expect(editable.filter((file) => forbidden.includes(file))).toEqual([]);
		expect(editable.filter((file) => under(file, 'apps/editor/src/lib/render'))).toEqual([]);
		expect(editable.filter((file) => under(file, 'apps/editor/src/lib/authoring/adapters'))).toEqual([]);

		// The facade is a type contract here; only the existing owners are executed.
		const facadeEdges = edgesOf(EPOCH).filter((edge) => edge.target.endsWith('stage-facade.ts'));
		expect(facadeEdges.length).toBeGreaterThan(0);
		expect(facadeEdges.every((edge) => edge.typeOnly)).toBe(true);

		// The asset leases are composed by identity, never by reaching into state.
		const assetEdges = edgesOf(EPOCH).filter((edge) => edge.target === ASSETS);
		expect(assetEdges.length).toBeGreaterThan(0);
		expect(assetEdges.every((edge) => edge.typeOnly)).toBe(true);
	});

	it('keeps the asset leases on the existing model/artwork acquisition owners', () => {
		const edges = edgesOf(ASSETS);
		const editable = executable(edges);
		const targets = editable.map((edge) => relativeToRepo(edge.target));
		expect(targets).not.toContain('apps/editor/src/lib/authoring/stage/host-acceptance.ts');
		expect(targets).not.toContain('apps/editor/src/lib/authoring/stage/stage-adapter-host.ts');
		expect(targets).not.toContain('apps/editor/src/lib/authoring/stage/stage-facade.ts');
		expect(targets.filter((file) => under(file, 'apps/editor/src/lib/authoring/adapters'))).toEqual([]);
		expect(targets).not.toContain('packages/layout-core/src/index.ts');

		const renderTargets = editable
			.map((edge) => relativeToRepo(edge.target))
			.filter((file) => under(file, 'apps/editor/src/lib/render'));
		expect(renderTargets).toEqual(['apps/editor/src/lib/render/artwork/artwork-scope.ts']);
	});

	it('keeps the X2 owners on the existing policy, planner and command boundaries', () => {
		const executableTargets = (file: string) => executable(edgesOf(file)).map((edge) => edge.target);

		// Input and keyboard route through the one pure policy module, not a copy.
		expect(executableTargets(INPUT)).toContain(STAGE_INPUT);
		expect(executableTargets(KEYBOARD)).toContain(STAGE_INPUT);

		// Unfold keeps the existing unfold store/display and planner payloads.
		const unfold = executableTargets(UNFOLD);
		expect(unfold).toContain(WALL_UNFOLD);
		expect(unfold).toContain(WALL_UNFOLD_PICK);
		expect(unfold).toContain(WALL_UNFOLD_OPENING_DRAG);
		expect(unfold).toContain(WALL_UNFOLD_STORE);
		expect(unfold).toContain(LAYOUT_PRECISION);
		expect(unfold).toContain(LAYOUT_OPENING_PLANNERS);

		// Artwork keeps the planner helpers and the one F4 command boundary.
		const artwork = executableTargets(ARTWORK);
		expect(artwork).toContain(ARTWORK_RESIZE);
		expect(artwork).toContain(ARTWORK_COMMAND);
		expect(artwork).toContain(ARTWORK_AUTHORING);

		for (const targets of [unfold, artwork]) {
			expect(targets).not.toContain(HOST_ACCEPTANCE);
			expect(targets).not.toContain(STAGE_ADAPTER_HOST);
			expect(targets).not.toContain(STAGE_FACADE);
			expect(targets).not.toContain(ARTWORK_SCOPE);
			expect(targets.filter((target) => under(relativeToRepo(target), 'apps/editor/src/lib/render'))).toEqual([]);
		}
	});

	it('shares the route press tracker and never becomes a replacement or acceptance writer', () => {
		for (const controller of [INPUT, KEYBOARD, UNFOLD, ARTWORK]) {
			const source = fs.readFileSync(controller, 'utf8');
			expect(source, relativeToRepo(controller)).not.toContain('createStagePressTracker(');
			expect(source, relativeToRepo(controller)).not.toContain('createStageAcceptanceHost(');
			expect(source, relativeToRepo(controller)).not.toContain('session.replace(');
		}
		// The three gesture owners accept the one tracker from the route.
		for (const controller of [INPUT, UNFOLD, ARTWORK]) {
			const source = fs.readFileSync(controller, 'utf8');
			expect(source, relativeToRepo(controller)).toContain('press');
		}
	});

	it('fails a forbidden dependency hidden behind an alias, barrel, namespace or dynamic import', () => {
		const sources: Record<string, string> = {
			'owner/route.ts': '',
			'owner/barrel.ts': "export { createStageAcceptanceHost as mount } from './route';",
			'owner/alias.ts': "import { createStageAcceptanceHost as mount } from './route';",
			'owner/namespace.ts': "import * as route from './route';",
			'owner/star.ts': "export * from './barrel';",
			'owner/via-star.ts': "import { mount as m } from './star';",
			'owner/dynamic.ts': "export async function load() { return import('./route'); }",
			'owner/control.ts': "import { unrelated } from './other';"
		};
		for (const file of ['owner/barrel.ts', 'owner/alias.ts', 'owner/namespace.ts', 'owner/via-star.ts', 'owner/dynamic.ts']) {
			expect(reaches(sources, file, 'owner/route.ts'), file).toBe(true);
		}
		expect(reaches(sources, 'owner/control.ts', 'owner/route.ts')).toBe(false);
	});
});

