/**
 * R217.S07 — the shared Stage mark layer.
 *
 * The slice's claims that are host facts, not Layout facts:
 *
 * 1. admission is one rule: an editing grip must name a registered planner, and
 *    a disclosure may reveal only admitted grips of its own binding;
 * 2. disclosure is view state: it reveals grips, opens no gesture, writes no
 *    source and survives a reading flip;
 * 3. projection and hit testing share the admitted descriptor order, with a
 *    22 px fine / 44 px coarse area that does not change the drawing;
 * 4. the old placeholder selection marker and Layout's three CSS-point handles
 *    are structurally gone.
 */
import { readFileSync } from 'node:fs';
import { BoxGeometry, Group, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createScenePickSource, hasVisibleAncestor } from '$lib/authoring/scene/scene-pick-source';
import {
	STAGE_MARK_GLYPH_CSS,
	admitStageHandles,
	hitStageMark,
	projectStageHandles,
	stageMarkHitRadiusCss,
	type StageHandleDescriptor
} from '$lib/authoring/stage/stage-handles';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { admitSource, type StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

const GRIP: StageHandleDescriptor = {
	id: 'probe-grip',
	kind: 'point',
	role: 'edit',
	anchor: [0, 0, 0],
	label: 'Size',
	fact: 'size',
	verb: 'Size',
	planner: 'probe-size',
	disclosedBy: 'probe-more'
};

const DISCLOSURE: StageHandleDescriptor = {
	id: 'probe-more',
	kind: 'point',
	role: 'disclose',
	anchor: [0, 0, 0],
	label: 'More',
	reveals: ['probe-grip']
};

describe('R217.S07 — mark admission', () => {
	it('refuses a grip whose planner the binding never registered', () => {
		const admission = admitStageHandles({
			adapterId: 'layout',
			descriptors: [{ ...GRIP, disclosedBy: undefined }],
			plannerKinds: []
		});
		expect(admission.admitted).toEqual([]);
		expect(admission.diagnostics).toEqual([
			expect.objectContaining({ handleId: 'probe-grip', code: 'unknown-planner' })
		]);
	});

	it('admits a disclosure with no planner when it reveals an admitted grip', () => {
		const admission = admitStageHandles({
			adapterId: 'layout',
			descriptors: [DISCLOSURE, GRIP],
			plannerKinds: ['probe-size']
		});
		expect(admission.diagnostics).toEqual([]);
		expect(admission.admitted.map((descriptor) => descriptor.id)).toEqual(expect.arrayContaining(['probe-grip', 'probe-more']));
	});

	it('refuses a disclosure that reveals nothing or a foreign id', () => {
		const empty = admitStageHandles({
			adapterId: 'layout',
			descriptors: [{ ...DISCLOSURE, reveals: [] }],
			plannerKinds: ['probe-size']
		});
		expect(empty.admitted).toEqual([]);
		expect(empty.diagnostics[0]).toMatchObject({ handleId: 'probe-more', code: 'empty-reveal' });

		const foreign = admitStageHandles({
			adapterId: 'layout',
			descriptors: [{ ...DISCLOSURE, reveals: ['not-this-binding'] }],
			plannerKinds: ['probe-size']
		});
		expect(foreign.admitted).toEqual([]);
		expect(foreign.diagnostics[0]).toMatchObject({ handleId: 'probe-more', code: 'foreign-reveal' });
	});

	it('keeps a disclosed grip hidden until its disclosure is open', () => {
		const descriptors = [DISCLOSURE, GRIP];
		const closed = projectStageHandles({
			adapterId: 'layout',
			descriptors,
			openDisclosures: new Set(),
			hoveredId: null,
			activeId: null,
			project: (point) => [640 + point[0] * 100, 360 + point[2] * 100],
			offset: [0, 0]
		});
		expect(closed.map((mark) => mark.id)).toEqual(['probe-more']);
		expect(closed[0]?.open).toBe(false);

		const open = projectStageHandles({
			adapterId: 'layout',
			descriptors,
			openDisclosures: new Set(['probe-more']),
			hoveredId: null,
			activeId: null,
			project: (point) => [640 + point[0] * 100, 360 + point[2] * 100],
			offset: [0, 0]
		});
		expect(open.map((mark) => mark.id)).toEqual(expect.arrayContaining(['probe-grip', 'probe-more']));
		expect(open.find((mark) => mark.id === 'probe-more')?.open).toBe(true);
	});
});

describe('R217.S07 — mark projection and hit areas', () => {
	const project = (point: readonly [number, number, number]): readonly [number, number] => [
		640 + point[0] * 100,
		360 + point[2] * 100
	];

	it('uses a 22 px fine area and a 44 px coarse area without changing the drawing', () => {
		expect(stageMarkHitRadiusCss(false)).toBe(11);
		expect(stageMarkHitRadiusCss(true)).toBe(22);
		const marks = projectStageHandles({
			adapterId: 'layout',
			descriptors: [{ ...GRIP, disclosedBy: undefined }],
			openDisclosures: new Set(),
			hoveredId: null,
			activeId: null,
			project,
			offset: [0, 0]
		});
		expect(hitStageMark(marks, { css: [652, 360], coarse: false })).toBeNull();
		expect(hitStageMark(marks, { css: [652, 360], coarse: true })?.id).toBe('probe-grip');
	});

	it('lets the domain descriptor order win an overlap', () => {
		const marks = projectStageHandles({
			adapterId: 'layout',
			descriptors: [
				{ ...GRIP, id: 'first', disclosedBy: undefined },
				{ ...GRIP, id: 'second', disclosedBy: undefined }
			],
			openDisclosures: new Set(),
			hoveredId: null,
			activeId: null,
			project,
			offset: [0, 0]
		});
		expect(hitStageMark(marks, { css: [640, 360], coarse: false })?.id).toBe('first');
	});
});

describe('R217.S07 — calibrated mark glyphs', () => {
	// 40 px per metre, so a 12 m ray would otherwise be 480 px long.
	const project = (point: readonly [number, number, number]): readonly [number, number] => [
		640 + point[0] * 40,
		360 + point[2] * 40
	];

	it('draws a long ray at the shared screen glyph, not at its world reach', () => {
		const marks = projectStageHandles({
			adapterId: 'layout',
			descriptors: [
				{
					id: 'far-ray',
					kind: 'ray',
					role: 'edit',
					anchor: [0, 0, 0],
					axis: [1, 0, 0],
					extent: 12,
					label: 'Length',
					fact: 'length',
					verb: 'Length',
					planner: 'probe-size'
				}
			],
			openDisclosures: new Set(),
			hoveredId: null,
			activeId: null,
			project,
			offset: [0, 0]
		});
		expect(marks[0]?.anchor).toEqual([640, 360]);
		expect(marks[0]?.tip).toEqual([640 + STAGE_MARK_GLYPH_CSS.ray, 360]);
	});

	it('calibrates a ring radius to the shared screen size in its own plane', () => {
		const marks = projectStageHandles({
			adapterId: 'layout',
			descriptors: [
				{
					id: 'wide-ring',
					kind: 'ring',
					role: 'edit',
					anchor: [0, 0, 0],
					axis: [0, 1, 0],
					extent: 3,
					label: 'Angle',
					fact: 'angle',
					verb: 'Angle',
					planner: 'probe-size'
				}
			],
			openDisclosures: new Set(),
			hoveredId: null,
			activeId: null,
			project,
			offset: [0, 0]
		});
		const ring = marks[0]?.ring;
		expect(ring).not.toBeNull();
		const radii = ring!.map(([x, y]) => Math.hypot(x - 640, y - 360));
		expect(Math.max(...radii)).toBeCloseTo(STAGE_MARK_GLYPH_CSS.ringRadius, 3);
		expect(Math.min(...radii)).toBeCloseTo(STAGE_MARK_GLYPH_CSS.ringRadius, 3);
	});

	it('draws and hits both sides of a two-way base ray', () => {
		const marks = projectStageHandles({
			adapterId: 'layout',
			descriptors: [
				{
					id: 'two-way',
					kind: 'track',
					role: 'edit',
					anchor: [0, 0, 0],
					axis: [0, 0, 1],
					extent: 0.6,
					bothWays: true,
					label: 'Position',
					fact: 'position',
					verb: 'Position',
					planner: 'probe-size'
				}
			],
			openDisclosures: new Set(),
			hoveredId: null,
			activeId: null,
			project,
			offset: [0, 0]
		});
		expect(marks[0]?.tip?.[1]).toBeCloseTo(360 + STAGE_MARK_GLYPH_CSS.twoWayHalf, 6);
		expect(marks[0]?.tail?.[1]).toBeCloseTo(360 - STAGE_MARK_GLYPH_CSS.twoWayHalf, 6);
		expect(hitStageMark(marks, { css: [640, 346], coarse: false })?.id).toBe('two-way');
		expect(hitStageMark(marks, { css: [640, 374], coarse: false })?.id).toBe('two-way');
	});

	it('withholds an edge-on ray and an edge-on ring instead of drawing a line', () => {
		const edgeOn = (point: readonly [number, number, number]): readonly [number, number] => [
			640,
			360 + point[2] * 40
		];
		const base = {
			adapterId: 'layout',
			openDisclosures: new Set<string>(),
			hoveredId: null,
			activeId: null,
			project: edgeOn,
			offset: [0, 0] as const
		};
		const ray = projectStageHandles({
			...base,
			descriptors: [
				{
					id: 'edge-ray',
					kind: 'ray',
					role: 'edit',
					anchor: [0, 0, 0],
					axis: [1, 0, 0],
					extent: 1,
					label: 'Length',
					fact: 'length',
					verb: 'Length',
					planner: 'probe-size'
				}
			]
		});
		expect(ray).toEqual([]);
		// A near-edge-on axis is withheld too: a one-metre step below three
		// pixels would let a 30 px arrow flip under pointer or Camera jitter.
		const nearlyEdgeOn = projectStageHandles({
			...base,
			project: (point) => [640 + point[0], 360 + point[2] * 40],
			descriptors: [
				{
					id: 'nearly-edge-ray',
					kind: 'ray',
					role: 'edit',
					anchor: [0, 0, 0],
					axis: [1, 0, 0],
					extent: 1,
					label: 'Length',
					fact: 'length',
					verb: 'Length',
					planner: 'probe-size'
				}
			]
		});
		expect(nearlyEdgeOn).toEqual([]);
		const ring = projectStageHandles({
			...base,
			descriptors: [
				{
					id: 'edge-ring',
					kind: 'ring',
					role: 'edit',
					anchor: [0, 0, 0],
					axis: [0, 1, 0],
					extent: 1,
					label: 'Angle',
					fact: 'angle',
					verb: 'Angle',
					planner: 'probe-size'
				}
			]
		});
		expect(ring).toEqual([]);
	});
});

describe('R217.S09 — screen fallback for an edge-on mark', () => {
	// Plan looks down world Y: a vertical step moves zero CSS pixels.
	const planLike = (point: readonly [number, number, number]): readonly [number, number] => [
		640 + point[0] * 100,
		360 + point[2] * 100
	];
	const heightRay: StageHandleDescriptor = {
		id: 'probe-height',
		kind: 'ray',
		role: 'edit',
		anchor: [0, 0, 0],
		axis: [0, 1, 0],
		extent: 1,
		label: 'Height',
		fact: 'scale[1]',
		verb: 'Height',
		planner: 'probe-size'
	};
	const base = {
		adapterId: 'scene',
		openDisclosures: new Set<string>(),
		hoveredId: null,
		activeId: null,
		project: planLike,
		offset: [0, 0] as const
	};

	it('withholds the edge-on ray without a screen hint', () => {
		expect(projectStageHandles({ ...base, descriptors: [heightRay] })).toEqual([]);
	});

	it('draws and hits the ray along the CSS axis, and applies the CSS offset', () => {
		const marks = projectStageHandles({
			...base,
			descriptors: [{ ...heightRay, screen: { offset: [0, -40], axis: [0, -1] } }]
		});
		expect(marks).toHaveLength(1);
		expect(marks[0]?.anchor).toEqual([640, 320]);
		expect(marks[0]?.tip).toEqual([640, 320 - STAGE_MARK_GLYPH_CSS.ray]);
		expect(hitStageMark(marks, { css: [640, 300], coarse: false })?.id).toBe('probe-height');
	});

	it('still withholds a zero or non-finite screen axis', () => {
		for (const axis of [
			[0, 0],
			[Number.NaN, -1],
			[Number.POSITIVE_INFINITY, -1]
		] as const) {
			expect(
				projectStageHandles({
					...base,
					descriptors: [{ ...heightRay, screen: { axis } }]
				})
			).toEqual([]);
		}
	});
});

describe('R217.S07 — disclosure through the Stage host', () => {
	type Mounted = {
		readonly facade: StageFacade;
		readonly snapshot: StageReadSnapshot;
		readonly project: ProjectEnvelope;
		readonly wallId: string;
	};

	async function mountProbe(): Promise<Mounted> {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = 0.5;
		const chained = planWallChain({
			baseline: base,
			points: [
				[0, 0],
				[6, 0],
				[6, 4],
				[0, 4]
			],
			close: true,
			capture: freshCapture(),
			levelId: base.floor.id
		});
		if (chained.kind !== 'success') throw new Error('the probe enclosure was refused');
		const project = await createUnitProject({
			id: 'project-stage-handles',
			name: 'S07 marks',
			layout: chained.document
		});
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-stage-handles',
			acceptedRevision: { projectId: project.id, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error(`the probe source was not admitted: ${admitted.kind}`);
		const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		session.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session });
		facade.acquireInspection('exclusive');
		facade.camera.evaluate(RECT, 1);
		const bounds = admitted.snapshot.domain.geometry.bounds;
		if (bounds === null) throw new Error('the probe geometry has no bounds');
		const centre: [number, number, number] = [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2
		];
		const descriptors: readonly StageHandleDescriptor[] = [
			{ ...DISCLOSURE, anchor: centre },
			{ ...GRIP, anchor: [centre[0] + 0.4, centre[1], centre[2]] }
		];
		facade.registerStageAdapter({
			id: 'layout',
			plannerKinds: ['probe-size'],
			handles: () => descriptors
		});
		const wallId = chained.document.walls[0]!.id;
		return { facade, snapshot: admitted.snapshot, project, wallId };
	}

	function selectWall(mounted: Mounted, wallId: string): void {
		const revision = mounted.snapshot.domain.unitRevisions.layout;
		const reference = {
			version: 1 as const,
			domain: 'layout' as const,
			revision: { kind: 'exact' as const, contentRevision: revision },
			subject: { kind: 'wall' as const, id: wallId },
			instancePath: [],
			location: {
				kind: 'layout-location' as const,
				levelId: mounted.snapshot.domain.layoutLevelId,
				structureInstancePath: []
			},
			componentId: null,
			capabilityId: null
		};
		expect(mounted.facade.setSelection({ ordered: [{ reference }], primary: reference }).kind).toBe('selected');
	}

	it('reveals a grip without opening a gesture, task or proposal', async () => {
		const mounted = await mountProbe();
		selectWall(mounted, mounted.wallId);
		const before = mounted.facade.snapshot().canonicalJson;
		expect(mounted.facade.marks().map((mark) => mark.id)).toEqual(['probe-more']);
		expect(mounted.facade.activateDisclosure('probe-more')).toBe(true);
		expect(mounted.facade.marks().map((mark) => mark.id)).toEqual(expect.arrayContaining(['probe-grip', 'probe-more']));
		expect(mounted.facade.session.gesture()).toBeNull();
		expect(mounted.facade.session.task()).toBeNull();
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.facade.handleDiagnostics()).toEqual([]);
	});

	it('keeps disclosure across a reading flip and closes it on a selection change', async () => {
		const mounted = await mountProbe();
		selectWall(mounted, mounted.wallId);
		mounted.facade.activateDisclosure('probe-more');

		// A 2D ↔ 3D flip is reading continuity: the open disclosure survives.
		expect(mounted.facade.camera.evaluate(RECT, 2).kind).toBe('evaluated');
		expect(mounted.facade.marks().map((mark) => mark.id)).toContain('probe-grip');

		selectWall(mounted, mounted.project.units.layout.data.walls[1]!.id);
		expect(mounted.facade.marks().map((mark) => mark.id)).toEqual(['probe-more']);
	});

	it('closes the open disclosure before the host unwinds selection', async () => {
		const mounted = await mountProbe();
		selectWall(mounted, mounted.wallId);
		mounted.facade.activateDisclosure('probe-more');
		expect(mounted.facade.closeDisclosure()).toBe(true);
		expect(mounted.facade.selectionState().primary).not.toBeNull();
		expect(mounted.facade.closeDisclosure()).toBe(false);
	});
});	describe('R217.S07 — selection and hover ink', () => {
	it('keeps gold for the selected subject and neutral for hover on the mat', () => {
		const layer = readFileSync(
			new URL('../../../src/lib/authoring/stage/shell/StageSelectionLayer.svelte', import.meta.url),
			'utf8'
		);
		expect(layer).toContain('const GOLD = 0xd4ad45');
		expect(layer).toContain('const NEUTRAL = 0xf3f4ee');
		expect(layer).toContain("color: tone === 'selection' ? GOLD : tone === 'erase' ? ERASE : NEUTRAL");
		expect(layer).toContain("opacity: tone === 'hover' ? 0.6 : 1");
		// Hover (and S10's erase dashes) are edges only; the tint is selection's alone.
		expect(layer).toContain("if (tone !== 'selection') continue;");
		expect(layer).toContain('opacity: 0.18');
		// A selection at rest must repaint even though the ink objects are added
		// imperatively rather than declared as Threlte children.
		expect(layer).toContain('invalidate();');
		// The accepted subject is depth-tested; an occluded wall must not glow
		// through the wall in front of it.
		expect(layer).toContain('depthTest: true');
		// Appearance, selection and hover are conditions of mounting, never a
		// write to `Object3D.visible` (the pick source's eligibility flag).
		expect(layer).not.toContain('root.visible');
		// Hidden LODs/children are not drawn, so they cannot contribute a gold clone.
		expect(layer).toContain('hasVisibleAncestor(node)');
		// Selection outranks hover when two identities share an edge.
		expect(layer).toContain("tone === 'selection' ? 21 : tone === 'erase' ? 23 : 18");
		expect(layer).toContain('tint.renderOrder = 20');
		const canvas = readFileSync(
			new URL('../../../src/lib/authoring/stage/shell/StageCanvas.svelte', import.meta.url),
			'utf8'
		);
		expect(canvas).toMatch(/\{#if !paperVisible\}[\s\S]*<StageSelectionLayer/);
	});

	it('re-strokes the selected Paper entries instead of tinting a mesh', () => {
		const paper = readFileSync(
			new URL('../../../src/lib/authoring/stage/shell/StagePaper.svelte', import.meta.url),
			'utf8'
		);
		expect(paper).toContain('paperMarkSet(drawing, selection, hover, hoverTone)');
		expect(paper).toContain('createPaperMarkScene(marks');
		const marks = readFileSync(
			new URL('../../../src/lib/authoring/stage/paper-marks.ts', import.meta.url),
			'utf8'
		);
		// Same gold as the mesh ink, a restrained neutral for hover, and a filter
		// over Paper's own drawing by the identity the selection names.
		expect(marks).toContain("PAPER_SELECTION_INK = '#d4ad45'");
		expect(marks).toContain("PAPER_HOVER_INK = '#f3f4ee'");
		expect(marks).toContain('PAPER_MARK_HALO_INK');
		expect(marks).toContain("line.sourceId === id");
		expect(marks).toContain("footprint.entityId === id");
		expect(marks).toContain('sameReference(hover.reference, selection.reference)');
		// S04 handoff: overlay layer, no depth test, above the whole sheet.
		expect(marks).toContain('STAGE_OVERLAY_LAYER');
		expect(marks).toContain('depthTest: false');
		expect(marks).toContain('PAPER_LAYER.sceneFootprint + 12');
	});


	it('never uses gold for a hovered disclosure', () => {
		const overlay = readFileSync(
			new URL('../../../src/lib/authoring/stage/shell/StageOverlay.svelte', import.meta.url),
			'utf8'
		);
		expect(overlay).not.toMatch(/disclose:hovered\s+\.disclosure\s*\{[^}]*#d4ad45/s);
	});
});

describe('R217.S07 — lazy render ink', () => {
	it('treats a hidden child as ineligible ink geometry', () => {
		const root = new Group();
		const hidden = new Group();
		const mesh = new Mesh(new BoxGeometry(1, 1, 1));
		hidden.add(mesh);
		root.add(hidden);
		expect(hasVisibleAncestor(mesh)).toBe(true);
		hidden.visible = false;
		expect(hasVisibleAncestor(mesh)).toBe(false);
	});

	it('notifies the render observers after a late child mounts', async () => {
		const pick = createScenePickSource();
		const root = new Group();
		pick.register('entity-a', root);
		// The registration's own microtask is not this assertion's subject.
		await new Promise((resolve) => setTimeout(resolve, 0));
		let notifications = 0;
		const stop = pick.onRenderRootsChanged(() => { notifications += 1; });
		root.add(new Mesh(new BoxGeometry(1, 1, 1)));
		pick.refresh();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(notifications).toBeGreaterThan(0);
		stop();
	});
});

describe('R217.S07 — no leftover ad hoc handles', () => {
	it('removes the placeholder selection marker and the three CSS-point Wall handles', () => {
		const overlay = readFileSync(
			new URL('../../../src/lib/authoring/stage/shell/StageOverlay.svelte', import.meta.url),
			'utf8'
		);
		const page = readFileSync(
			new URL('../../../src/routes/project/[projectId]/spatial/+page.svelte', import.meta.url),
			'utf8'
		);
		const adapter = readFileSync(
			new URL('../../../src/lib/authoring/adapters/layout.adapter.ts', import.meta.url),
			'utf8'
		);
		expect(overlay).not.toContain('selectionMarker');
		expect(page).not.toContain('selectionMarker');
		for (const id of ['layout-wall-start', 'layout-wall-end', 'layout-wall-body']) {
			expect(adapter).not.toContain(`id: '${id}'`);
		}
	});
});
