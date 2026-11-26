import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
	EDITOR_LIB,
	importClosure,
	moduleBindingEdges,
	parseModuleSpecifiers,
	resolveSpecifier
} from '../../../helpers/import-closure';

const adapters = path.join(EDITOR_LIB, 'authoring/adapters');
const layout = path.join(adapters, 'layout');
const adapter = path.join(adapters, 'layout.adapter.ts');
const host = '$lib/authoring/stage/stage-adapter-host';
const core = '@portfolio/layout-core';
const numeric = '$lib/authoring/layout/plan-numeric-entry';

// Each owner depends on explicit Stage contracts, existing planners and pure readers.
// An unlisted barrel cannot grant an edge to a sibling controller or to the route.
const allowed = new Map<string, readonly string[]>([
	[
		path.join(layout, 'curve-gesture-session.ts'),
		[
			'$lib/authoring/layout/wall-unfold-store.svelte',
			host,
			'$lib/layout/wall-unfold',
			'./candidate-preview',
			'./drawing-planners',
			'./layout-subjects',
			'./manipulation-support',
			'./precision',
			'./precision-frames',
			'./precision-intents',
			'./refusals',
			'./session-ports',
			'./stage-pointer',
			core
		]
	],
	[
		path.join(layout, 'junction-gesture-session.ts'),
		[
			numeric,
			host,
			'./candidate-preview',
			'./join-planners',
			'./layout-subjects',
			'./manipulation-support',
			'./precision',
			'./precision-frames',
			'./refusals',
			'./snap',
			'./stage-pointer',
			core
		]
	],
	[
		path.join(layout, 'opening-gesture-session.ts'),
		[
			numeric,
			host,
			'$lib/platform/perf-marks',
			'./candidate-presenter',
			'./candidate-preview',
			'./layout-subjects',
			'./manipulation-support',
			'./opening-planners',
			'./opening-repeat',
			'./opening-repeat-proposal',
			'./precision',
			'./precision-frames',
			'./session-ports',
			'./snap',
			'./stage-pointer',
			core,
			'@portfolio/project-model'
		]
	],
	[
		path.join(layout, 'open-side-gesture-session.ts'),
		[
			host,
			'@portfolio/camera-core',
			'./candidate-preview',
			'./manipulation-support',
			'./open-side-planners',
			'./precision',
			'./precision-frames',
			'./refusals',
			'./snap',
			'./stage-pointer',
			core
		]
	],
	[
		path.join(layout, 'room-gesture-session.ts'),
		[
			host,
			'./candidate-preview',
			'./layout-subjects',
			'./manipulation-support',
			'./precision',
			'./refusals',
			'./room-duplicate-planners',
			'./snap',
			'./stage-pointer',
			core
		]
	],
	[
		path.join(layout, 'wall-gesture-session.ts'),
		[
			numeric,
			host,
			'$lib/platform/perf-marks',
			'./candidate-preview',
			'./layout-subjects',
			'./manipulation-support',
			'./paused-proposal',
			'./precision-frames',
			'./precision-intents',
			'./refusals',
			'./session-ports',
			'./snap',
			'./stage-pointer',
			'./wall-gesture',
			'./wall-scalar-session',
			core
		]
	],
	[
		path.join(layout, 'wall-scalar-session.ts'),
		[
			numeric,
			host,
			'./candidate-preview',
			'./layout-subjects',
			'./manipulation-support',
			'./opening-planners',
			'./precision',
			'./precision-frames',
			'./refusals',
			'./session-ports',
			core
		]
	],
	[
		path.join(layout, 'layout-contributions.ts'),
		[
			numeric,
			'$lib/authoring/layout/wall-unfold-store.svelte',
			'$lib/authoring/layout/wall-face-store',
			// T1 X1 — Lift is a session reading beside Unroll and Face. The Room Card
			// names the reading and toggles it; no authored value passes through it.
			'$lib/authoring/layout/interior-lift-store.svelte',
			host,
			'$lib/layout/wall-unfold',
			'$lib/layout/wall-face',
			'./LayoutCardFields.svelte',
			'./LayoutRegionCard.svelte',
			// T2.S8 U4 — the Room Card's writer: area facts and the shared Finish section.
			'./LayoutRoomCard.svelte',
			'./LayoutInkPalette.svelte',
			'./LayoutPlacementInstrument.svelte',
			'./adapter-support',
			'./candidate-preview',
			'./drawing-planners',
			'./ink',
			'./layout-card-actions',
			'./layout-deletion-preview',
			'./layout-marks',
			'./layout-subjects',
			'./manipulation-support',
			'./opening-planners',
			'./precision',
			'./precision-facts',
			'./precision-frames',
			'./refusals',
			'./region-planners',
			'./region-resting',
			'./room-duplicate-planners',
			'./room-overlap-cue',
			'./session-ports',
			'./split-planners',
			'./wall-gesture',
			// T1 V1c — Erase and the Region Card disclose the derived resting-object
			// count; it is a read, never a Scene write. Approved model contact comes
			// through the one neutral resolver, not a Scene-adapter import.
			'$lib/authoring/model-contact',
			'@portfolio/project-model/scene-planning',
			core
		]
	],
	[path.join(layout, 'room-overlap-cue.ts'), [host, core]],
	[path.join(layout, 'layout-subjects.ts'), [host, './precision', './precision-frames', './wall-gesture', core]],
	[path.join(layout, 'manipulation-support.ts'), [numeric, host, './candidate-preview', './snap', core]],
	[
		adapter,
		[
			numeric,
			'$lib/authoring/layout/plan-pick-provider',
			// T1 X1 — the pick provider asks the live Lift reading which overheads it
			// lifted. The adapter passes the accessor; the reading owns the scope.
			'../layout/interior-lift-store.svelte',
			host,
			'./layout/candidate-presenter',
			'./layout/candidate-preview',
			'./layout/compile-context',
			'./layout/curve-gesture-session',
			'./layout/drawing-planners',
			'./layout/ink',
			'./layout/ink-session',
			'./layout/join-planners',
			'./layout/junction-gesture-session',
			'./layout/layout-contributions',
			'./layout/layout-subjects',
			'./layout/manipulation-support',
			'./layout/open-side-gesture-session',
			'./layout/open-side-planners',
			'./layout/opening-gesture-session',
			'./layout/opening-placement-session',
			'./layout/opening-planners',
			'./layout/region-gesture-session',
			'./layout/region-planners',
			'./layout/opening-repeat',
			'./layout/precision',
			'./layout/precision-facts',
			'./layout/precision-frames',
			'./layout/precision-intents',
			'./layout/precision-planners',
			'./layout/room-duplicate-planners',
			'./layout/round-room-gesture-session',
			'./layout/room-gesture-session',
			'./layout/session-ports',
			'./layout/split-planners',
			'./layout/space-create-planners',
			'./layout/space-create-session',
			'./layout/wall-gesture-session',
			core
		]
	]
]);

const read = (file: string) => fs.readFileSync(file, 'utf8');
/** Package family subpaths keep the package-level allowance exactly as broad. */
const packageOf = (specifier: string) =>
	specifier.replace(/^(@portfolio\/(?:layout-core|project-model|camera-core))\/.*$/, '$1');
function forbiddenEdges(file: string, source = read(file)): string[] {
	const allowedTargets = new Set(
		allowed.get(file)!.map((specifier) => resolveSpecifier(file, specifier) ?? specifier)
	);
	const specifiers = new Set(parseModuleSpecifiers(source));
	for (const edge of moduleBindingEdges(file, source)) {
		if (edge.kind !== 'export-local') specifiers.add(edge.specifier);
	}
	return [...specifiers].filter((raw) => {
		const specifier = packageOf(raw);
		return !allowedTargets.has(resolveSpecifier(file, specifier) ?? specifier);
	});
}

function declarations(source: string): Set<string> {
	const names = new Set<string>();
	const tree = ts.createSourceFile('layout.ts', source, ts.ScriptTarget.Latest, true);
	function visit(node: ts.Node): void {
		if (
			(ts.isVariableDeclaration(node) ||
				ts.isFunctionDeclaration(node) ||
				ts.isTypeAliasDeclaration(node)) &&
			node.name !== undefined &&
			ts.isIdentifier(node.name)
		)
			names.add(node.name.text);
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return names;
}

describe('Layout manipulation ownership', () => {
	it('only imports the dependencies of each owner', () => {
		for (const file of allowed.keys()) expect(forbiddenEdges(file), path.basename(file)).toEqual([]);
	});

	it('keeps sessions and contribution readers independent through their import closures', () => {
		const owners = [...allowed.keys()].filter(
			(file) =>
				file === adapter ||
				file.endsWith('-gesture-session.ts') ||
				file.endsWith('layout-contributions.ts')
		);
		for (const file of owners) {
			if (file === adapter) continue;
			const closure = importClosure([file]);
			expect(
				owners.filter((owner) => owner !== file && closure.has(owner)),
				path.basename(file)
			).toEqual([]);
		}
	});

	it('finds a sibling hidden behind an allowed reader', () => {
		const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-import-closure-'));
		try {
			const contribution = path.join(fixture, 'layout-contributions.ts');
			const reader = path.join(fixture, 'layout-subjects.ts');
			const session = path.join(fixture, 'wall-gesture-session.ts');
			fs.writeFileSync(contribution, "export { selectedWall } from './layout-subjects';");
			fs.writeFileSync(reader, 'export const selectedWall = () => null;');
			fs.writeFileSync(session, 'export const createWallGestureSession = () => null;');
			expect(importClosure([contribution]).has(session)).toBe(false);
			fs.appendFileSync(reader, "\nexport * from './wall-gesture-session';");
			expect(importClosure([contribution]).has(session)).toBe(true);
		} finally {
			fs.rmSync(fixture, { recursive: true, force: true });
		}
	});

	it('declares each live capture only in its session', () => {
		const owners = {
			'wall-gesture-session.ts': ['gesture', 'pausedProposal'],
			'wall-scalar-session.ts': ['scalarGesture'],
			'curve-gesture-session.ts': [
				'bendGesture',
				'circleRadiusGesture',
				'circleTranslateGesture',
				'idleBendHint'
			],
			'junction-gesture-session.ts': ['junctionGesture', 'idleJunctionHover'],
			'opening-gesture-session.ts': ['openingGesture'],
			'room-gesture-session.ts': [
				'roomMove',
				'roomDuplicate',
				'pendingRoomDuplicateId',
				'roomDuplicateProposal'
			]
		};
		for (const [name, captures] of Object.entries(owners)) {
			const own = path.join(layout, name);
			for (const capture of captures) expect(declarations(read(own)).has(capture), capture).toBe(true);
			for (const file of allowed.keys()) {
				if (file === own || file === path.join(layout, 'layout-contributions.ts')) continue;
				const declared = declarations(read(file));
				expect(
					captures.filter((name) => declared.has(name)),
					path.basename(file)
				).toEqual([]);
			}
		}
	});

	it('keeps gesture leases and planner acceptance out of composition', () => {
		const source = read(adapter);
		expect(source).not.toMatch(/\.(?:acquireGesture|registerProposal|accept)\s*\(/);
		const projection = read(path.join(layout, 'layout-contributions.ts'));
		expect(projection).not.toMatch(/\.(?:acquireGesture|registerProposal)\s*\(/);
	});

	it('rejects direct, aliased, re-exported and dynamic dependency bypasses', () => {
		const file = path.join(layout, 'layout-contributions.ts');
		for (const source of [
			"import { createWallGestureSession } from './wall-gesture-session';",
			"import { createWallGestureSession as create } from '$lib/authoring/adapters/layout/wall-gesture-session';",
			"export * from './gesture-barrel';",
			"import './wall-gesture-session';",
			"const load = () => import('./wall-gesture-session');"
		])
			expect(forbiddenEdges(file, source)).toHaveLength(1);
	});
});
