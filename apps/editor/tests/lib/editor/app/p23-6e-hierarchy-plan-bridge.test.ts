import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	buildPlanRenderModel,
	type PlanHitIdentity,
	type PlanPolylinePrimitive,
	type PlanSelection
} from '$lib/layout/plan-render-model';
import { hierarchyEntityToPlanHit } from '$lib/editor/hierarchy/hierarchy-plan-bridge';
import {
	junctionEntityKey,
	layoutObjectEntityKey,
	openingEntityKey,
	roomEntityKey,
	sceneClusterEntityKey,
	sceneEntityKey,
	wallEntityKey
} from '$lib/editor/hierarchy/hierarchy-source-index';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

/** Empty wall-first document with a real floor record (P23.9 precedent). */
function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

const p = (x: number, z: number): [number, number] => [x, z];

/** One boundary Wall chain, no Rooms: the smallest real Plan document. */
function wallDocument(): LayoutDocumentWallFirst {
	const plan = planWallChain({
		baseline: baseDocument(),
		points: [p(0, 0), p(4, 0)],
		close: false,
		role: 'boundary'
	});
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

/** The committed Wall polyline primitives under one hover/selection pair. */
function wallPrimitives(
	document: LayoutDocumentWallFirst,
	options: { selected?: PlanSelection; hovered?: PlanHitIdentity }
) {
	const { geometry } = compileWallFirstLayoutGeometry(document);
	const model = buildPlanRenderModel(
		geometry,
		undefined,
		options.selected || options.hovered
			? {
					selected: options.selected,
					hovered: options.hovered,
					selection: [],
					handles: [],
					drafts: [],
					labels: []
				}
			: undefined
	);
	return model.layers
		.flatMap((layer) => layer.primitives)
		.filter(
			(primitive): primitive is PlanPolylinePrimitive =>
				primitive.kind === 'polyline' &&
				primitive.architecture?.kind === 'wall' &&
				primitive.hit?.kind === 'physicalWall'
		);
}

describe('P23.6e slice 7 — hierarchy entity → Plan hover identity', () => {
	it('maps every canonical Layout entity to its existing Plan hit identity', () => {
		expect(hierarchyEntityToPlanHit(roomEntityKey('room-a'))).toEqual({
			kind: 'room',
			roomId: 'room-a'
		});
		expect(hierarchyEntityToPlanHit(wallEntityKey('w2'))).toEqual({
			kind: 'physicalWall',
			wallId: 'w2'
		});
		expect(hierarchyEntityToPlanHit(openingEntityKey('w2', 'op-1'))).toEqual({
			kind: 'wallOpening',
			wallId: 'w2',
			openingId: 'op-1'
		});
		expect(hierarchyEntityToPlanHit(junctionEntityKey('j3'))).toEqual({
			kind: 'junction',
			junctionId: 'j3'
		});
		expect(hierarchyEntityToPlanHit(layoutObjectEntityKey('object-1'))).toEqual({
			kind: 'object',
			objectId: 'object-1'
		});
	});

	it('never fabricates a Plan footprint for Scene content', () => {
		// A cluster is organization, not geometry: the Scene footprint outline is
		// the Scene hover path's own presentation and is never invented here.
		expect(hierarchyEntityToPlanHit(sceneClusterEntityKey('cluster-1'))).toBeNull();
		expect(hierarchyEntityToPlanHit(sceneEntityKey('entity-a1'))).toBeNull();
	});

	it('carries only canonical documents ids, never room-anchored coordinates', () => {
		expect(hierarchyEntityToPlanHit(wallEntityKey('w2'))).not.toHaveProperty('roomId');
		expect(hierarchyEntityToPlanHit(wallEntityKey('w2'))).not.toHaveProperty('segmentId');
		expect(hierarchyEntityToPlanHit(junctionEntityKey('j3'))).toEqual({
			kind: 'junction',
			junctionId: 'j3'
		});
	});

	it('is pure and allocation-stable for the same entity', () => {
		const first = hierarchyEntityToPlanHit(wallEntityKey('w2'));
		expect(hierarchyEntityToPlanHit(wallEntityKey('w2'))).toEqual(first);
	});

	it('drives the existing Plan hover language, and selection always wins', () => {
		const document = wallDocument();
		const wallId = document.walls[0]!.id;
		const hover = hierarchyEntityToPlanHit(wallEntityKey(wallId))!;

		// Hierarchy emphasis alone reads the existing hover token.
		expect(wallPrimitives(document, { hovered: hover }).map((primitive) => primitive.style)).toEqual(
			['wall-line-hovered']
		);

		// A committed selection of the same Wall wins over the hierarchy hover.
		expect(
			wallPrimitives(document, {
				hovered: hover,
				selected: { kind: 'physicalWall', wallId }
			}).map((primitive) => primitive.style)
		).toEqual(['wall-line-selected']);
	});
});

describe('P23.6e slice 7 — Plan bridge wiring (source contracts)', () => {
	it('publishes row emphasis from the Navigator without selecting', () => {
		const row = readLibSource('editor/hierarchy/HierarchyRow.svelte');
		const navigator = readLibSource('editor/hierarchy/HierarchyNavigator.svelte');
		// Pointer enter/leave and keyboard focus/blur both publish emphasis.
		expect(row).toContain('onpointerenter={() => onEmphasis?.(row)}');
		expect(row).toContain('onpointerleave={() => onEmphasisLeave?.(row)}');
		expect(row).toContain('onfocus={() => onEmphasis?.(row)}');
		expect(row).toContain('onblur={() => onEmphasisLeave?.(row)}');
		const emphasizeBody = navigator.slice(
			navigator.indexOf('function emphasize('),
			navigator.indexOf('function deEmphasize(')
		);
		expect(emphasizeBody).toContain('navigator.setEmphasis(row.entity)');
		// Emphasis is presentation: it never reaches a selection writer.
		expect(emphasizeBody).not.toContain('selectLayout');
		expect(emphasizeBody).not.toContain('onSelect');
		// Leaving the page or unmounting clears it (page navigation clears it in
		// the store's transition intent).
		expect(navigator).toContain('navigator.clearEmphasis(row.entity)');
		expect(navigator).toContain('onDestroy(() => navigator.clearEmphasis())');
		expect(readLibSource('editor/app/hierarchy-navigator-state.svelte.ts')).toContain(
			'this.emphasis = null;'
		);
	});

	it('converts the emphasis once, in the Scene Plan mount only', () => {
		const planWorkspace = readLibSource('editor/app/PlanWorkspace.svelte');
		expect(planWorkspace).toContain('HIERARCHY_NAVIGATOR_KEY');
		expect(planWorkspace).toContain('hierarchyEntityToPlanHit(hierarchyNavigator.emphasis)');
		expect(planWorkspace).toContain('{hierarchyEmphasis}');
		// Camera Plan mounts the same viewport without the prop, so no Scene
		// Navigator emphasis can ever reach it.
		expect(readLibSource('editor/EditorViewport.svelte')).not.toContain('hierarchyEmphasis');
	});

	it('lets viewport-local hover win and keeps one hover renderer', () => {
		const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');
		expect(viewport).toContain('hierarchyEmphasis?: PlanHitIdentity | null;');
		expect(viewport).toContain('layoutHover ?? hierarchyEmphasis ?? undefined');
		// Exactly one place builds the interaction projection from hover input.
		expect(viewport.match(/buildPlanInteractionProjection\(/g)).toHaveLength(1);
		// The bridge is a lookup table: no Svelte, DOM, renderer or selection code.
		const bridge = readLibSource('editor/hierarchy/hierarchy-plan-bridge.ts');
		expect(bridge).not.toMatch(/from '(svelte|\.\.\/layout\/layout-interaction)'/);
		expect(bridge).not.toContain('selectLayout');
		expect(bridge).not.toMatch(/\$state|\$derived|\$effect/);
	});
});
