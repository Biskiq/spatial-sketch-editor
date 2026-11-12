// @vitest-environment jsdom
/**
 * T1 A8 — Opening Repeat, through the production Layout adapter, the real F4
 * host and the Card's own Repeat writer.
 *
 * The journey pinned here is the slice's acceptance:
 *
 * 1. **Repeat** on a selected Opening takes a count and a spacing in metres;
 * 2. every proposed copy appears along the host Wall as a Stage candidate before
 *    anything is written;
 * 3. the committed batch preserves kind, width, height, sill and profile, and
 *    the generated Opening ids are the captured ones (Undo/Redo replays them);
 * 4. a set that would leave the Wall or collide with another Opening refuses
 *    whole, in words, writing nothing and adding no history;
 * 5. straight and curved hosts both repeat;
 * 6. one Repeat is one history entry and the accepted document round-trips
 *    through Save/Load unchanged.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import {
	createEmptyWallFirstLayoutDocument,
	layoutCapturedId,
	mintLayoutIdCapture,
	planCreateWallFirstOpening,
	planWallChain,
	validateWallFirstLayoutDocument,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanSourceRef
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { openingFacePaper } from '$lib/authoring/adapters/layout/candidate-preview';
import { wallStationFrame } from '$lib/authoring/adapters/layout/precision';
import {
	openingRepeatIntent,
	previewOpeningRepeat
} from '$lib/authoring/adapters/layout/opening-repeat';
import {
	clearOpeningRepeatProposal,
	publishOpeningRepeatProposal
} from '$lib/authoring/adapters/layout/opening-repeat-proposal';
import LayoutOpeningRepeat from '$lib/authoring/adapters/layout/LayoutOpeningRepeat.svelte';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-a8-repeat';
const ELEVATION = 0.5;

type Fixture = {
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
};

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
};

/** A 12 × 4 m enclosure with one rounded window at `openingOffset`. */
function enclosureFixture(openingOffset: number): Fixture {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[12, 0],
			[12, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the A8 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{
			wallId,
			kind: 'window',
			offset: openingOffset,
			width: 1,
			height: 1.2,
			sillHeight: 1,
			profile: 'rounded'
		},
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`A8 Opening fixture refused: ${opening.rejection.message}`);
	return {
		document: opening.document,
		wallId,
		openingId: opening.changedOpeningIds[0]!
	};
}

/** The enclosure with a second window at 6 m, for live A → B retargeting. */
function twoOpeningsFixture(): Fixture & { readonly secondOpeningId: string } {
	const fixture = enclosureFixture(1);
	const second = planCreateWallFirstOpening(
		fixture.document,
		{
			wallId: fixture.wallId,
			kind: 'window',
			offset: 6,
			width: 1,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		fixture.document.floor.id
	);
	if (second.kind === 'rejected') throw new Error(`A8 second Opening refused: ${second.rejection.message}`);
	return { ...fixture, document: second.document, secondOpeningId: second.changedOpeningIds[0]! };
}

/** The same enclosure plus a second window further along the same Wall. */
function collidingFixture(): Fixture {
	const fixture = enclosureFixture(1);
	const second = planCreateWallFirstOpening(
		fixture.document,
		{
			wallId: fixture.wallId,
			kind: 'window',
			offset: 7.5,
			width: 1,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		fixture.document.floor.id
	);
	if (second.kind === 'rejected') throw new Error(`A8 second Opening refused: ${second.rejection.message}`);
	return { ...fixture, document: second.document };
}

/** One open curved Wall between two junctions, with one window. */
function curvedFixture(): Fixture {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	base.junctions = [
		{ id: 'curve-start', point: [0, 0] },
		{ id: 'curve-end', point: [6, 0] }
	];
	base.walls = [
		{
			id: 'curve-wall',
			startJunctionId: 'curve-start',
			endJunctionId: 'curve-end',
			thickness: 0.2,
			height: 3,
			centerline: {
				kind: 'cubic-chain',
				knots: [],
				spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
			}
		}
	];
	const frame = wallStationFrame(base, 'curve-wall');
	if (frame === null) throw new Error('the A8 curved fixture did not resolve');
	const opening = planCreateWallFirstOpening(
		base,
		{
			wallId: 'curve-wall',
			kind: 'window',
			offset: frame.length * 0.25,
			width: 0.5,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		base.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`A8 curved Opening refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId: 'curve-wall', openingId: opening.changedOpeningIds[0]! };
}

async function mountProject(fixture: Fixture): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'A8 opening repeat',
		layout: fixture.document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-a8-repeat',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`A8 fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	let services: StageAdapterServices | undefined;
	const registration = mountStageAdapter(facade, host, (port) => {
		services = port;
		return createAdapter(port);
	});
	if (registration.kind !== 'registered' || services === undefined) throw new Error('Layout adapter did not mount');
	return { facade, session, host, services };
}

/** A complete selection for one Opening of the mounted source. */
function selectOpening(facade: StageFacade, sourceId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'opening' as const, id: sourceId },
		instancePath: [],
		location: {
			kind: 'layout-location' as const,
			levelId: snapshot.domain.layoutLevelId,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
	const representation: PlanSourceRef = {
		sourceId,
		sourceKind: 'opening',
		generationId: snapshot.compileGeneration,
		stream: 'projected',
		subRef: null
	};
	facade.setSelection({ ordered: [{ reference, representation }], primary: reference });
}

function settle(facade: StageFacade, clockSeconds = 2): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.tasks();
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

function publishRepeat(mounted: Mounted, openingId: string, count: number, spacing: number): void {
	const wallId = acceptedLayout(mounted.facade).openings.find((opening) => opening.id === openingId)!.wallId;
	publishOpeningRepeatProposal({
		sourceContentId: mounted.facade.snapshot().sourceContentId,
		openingId,
		wallId,
		count,
		spacing
	});
	settle(mounted.facade);
	mounted.facade.notifySurfaceChange();
}

function repeatOutcome(mounted: Mounted, openingId: string, count: number, spacing: number) {
	const snapshot = mounted.facade.snapshot();
	return mounted.services.authoring.accept(
		openingRepeatIntent({
			openingId,
			count,
			spacing,
			capture: mintLayoutIdCapture(),
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: mounted.services.authoring.acceptedRevision().revisionId,
			contentRevision: snapshot.domain.unitRevisions.layout,
			levelId: snapshot.domain.layoutLevelId
		})
	);
}

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('T1 A8 — Opening Repeat', () => {
	it('[cap:layout.opening-repeat core] registers the retained planner and previews every copy on the host Wall', async () => {
		const fixture = enclosureFixture(1);
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);

		// Capability registration: the one coordinator holds the one Repeat planner.
		expect(mounted.host.coordinator().planners().map((planner) => planner.kind)).toContain(
			'layout-opening-repeat'
		);

		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const preview = previewOpeningRepeat({
			document: before,
			openingId: fixture.openingId,
			count: 4,
			spacing: 2
		});
		expect(preview.kind).toBe('planned');
		if (preview.kind !== 'planned') throw new Error(preview.message);
		expect(preview.createdOpeningIds).toHaveLength(4);
		expect(preview.document.openings).toHaveLength(5);
		const source = before.openings.find((opening) => opening.id === fixture.openingId)!;
		const offsets = preview.document.openings
			.filter((opening) => preview.createdOpeningIds.includes(opening.id))
			.map((opening) => opening.offset)
			.sort((a, b) => a - b);
		expect(offsets).toEqual([3, 5, 7, 9]);
		for (const copy of preview.document.openings.filter((opening) => preview.createdOpeningIds.includes(opening.id))) {
			expect(copy.wallId).toBe(fixture.wallId);
			expect(copy.kind).toBe(source.kind);
			expect(copy.width).toBe(source.width);
			expect(copy.height).toBe(source.height);
			expect(copy.sillHeight).toBe(source.sillHeight);
			expect(copy.profile).toBe(source.profile);
		}
		expect(validateWallFirstLayoutDocument(preview.document).success).toBe(true);

		// The Stage paints the same proposal: every copy, from the planner's own
		// candidate document, before anything is written. A four-copy batch must
		// draw exactly four times the geometry of a one-copy batch — no copy is
		// merged, deduplicated or dropped.
		const oneCopy = previewOpeningRepeat({
			document: before,
			openingId: fixture.openingId,
			count: 1,
			spacing: 2
		});
		expect(oneCopy.kind).toBe('planned');
		if (oneCopy.kind !== 'planned') throw new Error(oneCopy.message);
		const oneGeometry = openingFacePaper(oneCopy.document, new Set(oneCopy.createdOpeningIds), ELEVATION);
		const fourGeometry = openingFacePaper(preview.document, new Set(preview.createdOpeningIds), ELEVATION);
		expect(oneGeometry.segments.length).toBeGreaterThan(0);
		expect(fourGeometry.segments.length).toBe(oneGeometry.segments.length * 4);

		publishRepeat(mounted, fixture.openingId, 4, 2);
		const candidates = mounted.facade.candidatePreviews();
		const proposal = candidates.find((candidate) => candidate.id === 'layout-candidate-opening-repeat');
		expect(proposal).toBeDefined();
		expect(proposal!.role).toBe('subject');
		expect(proposal!.segments).toHaveLength(fourGeometry.segments.length);
		// A proposal is not a write: the accepted bytes are untouched.
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);

		// Clearing the proposal removes the proposal and changes no document.
		clearOpeningRepeatProposal(mounted.facade.snapshot().sourceContentId, fixture.openingId);
		settle(mounted.facade);
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-repeat')).toBe(false);
	});

	it('[cap:layout.opening-repeat core] commits one deterministic, undoable batch with captured ids and preserved values', async () => {
		const fixture = enclosureFixture(1);
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);

		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const capture = mintLayoutIdCapture();
		const snapshot = mounted.facade.snapshot();
		const outcome = await mounted.services.authoring.accept(
			openingRepeatIntent({
				openingId: fixture.openingId,
				count: 4,
				spacing: 2,
				capture,
				operationId: 'a8-repeat-commit',
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: mounted.services.authoring.acceptedRevision().revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId
			})
		);
		expect(outcome.kind).toBe('installed');

		const after = acceptedLayout(mounted.facade);
		expect(after.openings).toHaveLength(5);
		const createdIds = after.openings
			.map((opening) => opening.id)
			.filter((id) => before.openings.every((opening) => opening.id !== id));
		expect(createdIds).toEqual([
			layoutCapturedId(capture, `${fixture.openingId}-copy-1`),
			layoutCapturedId(capture, `${fixture.openingId}-copy-2`),
			layoutCapturedId(capture, `${fixture.openingId}-copy-3`),
			layoutCapturedId(capture, `${fixture.openingId}-copy-4`)
		]);
		const copies = after.openings.filter((opening) => createdIds.includes(opening.id));
		expect(copies.map((opening) => opening.offset).sort((a, b) => a - b)).toEqual([3, 5, 7, 9]);
		for (const copy of copies) {
			expect(copy.wallId).toBe(fixture.wallId);
			expect(copy.kind).toBe('window');
			expect(copy.width).toBe(1);
			expect(copy.height).toBe(1.2);
			expect(copy.sillHeight).toBe(1);
			expect(copy.profile).toBe('rounded');
		}
		// The source keeps its id and station.
		expect(after.openings.find((opening) => opening.id === fixture.openingId)).toMatchObject({
			wallId: fixture.wallId,
			offset: 1,
			profile: 'rounded'
		});
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});

		// Undo restores the exact pre-repeat bytes; Redo replays the same ids.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect((await mounted.host.redo()).kind).toBe('installed');
		expect(
			acceptedLayout(mounted.facade).openings
				.map((opening) => opening.id)
				.filter((id) => before.openings.every((opening) => opening.id !== id))
		).toEqual(createdIds);

		// The accepted batch is an ordinary canonical document: Save/Load admits it.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'a8-repeat-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-a8-repeat-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);
	});

	it('[cap:layout.opening-repeat edge] refuses an overflowing batch whole, in words, with no proposals and no history', async () => {
		const fixture = enclosureFixture(1);
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// last copy: 1 + 4 × 3.5 + 1 = 16 m on a 12 m Wall.
		const preview = previewOpeningRepeat({
			document: acceptedLayout(mounted.facade),
			openingId: fixture.openingId,
			count: 4,
			spacing: 3.5
		});
		expect(preview.kind).toBe('refused');
		if (preview.kind !== 'refused') throw new Error('the overflowing preview was accepted');
		expect(preview.message).toContain('past the 12.00 m Wall');
		expect(preview.message).toContain('Reduce the count or the spacing');

		publishRepeat(mounted, fixture.openingId, 4, 3.5);
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-repeat')).toBe(false);

		const outcome = await repeatOutcome(mounted, fixture.openingId, 4, 3.5);
		expect(outcome.kind).toBe('refused');
		if (outcome.kind === 'refused') expect(outcome.message).toContain('past the 12.00 m Wall');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('[cap:layout.opening-repeat edge] refuses a colliding copy whole, in words, with no history', async () => {
		const fixture = collidingFixture();
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// copies at 4, 7, 10 m; the 7 m copy overlaps the second window at 7.5 m.
		const preview = previewOpeningRepeat({
			document: acceptedLayout(mounted.facade),
			openingId: fixture.openingId,
			count: 3,
			spacing: 3
		});
		expect(preview.kind).toBe('refused');
		if (preview.kind !== 'refused') throw new Error('the colliding preview was accepted');
		expect(preview.message).toContain('collide with another Opening');

		const outcome = await repeatOutcome(mounted, fixture.openingId, 3, 3);
		expect(outcome.kind).toBe('refused');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('[cap:layout.opening-repeat core] repeats along a curved host Wall at exact stations', async () => {
		const fixture = curvedFixture();
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);

		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const source = before.openings.find((opening) => opening.id === fixture.openingId)!;
		const frame = wallStationFrame(before, fixture.wallId)!;

		const twoCopies = previewOpeningRepeat({
			document: before,
			openingId: fixture.openingId,
			count: 2,
			spacing: 1
		});
		const oneCopy = previewOpeningRepeat({
			document: before,
			openingId: fixture.openingId,
			count: 1,
			spacing: 1
		});
		if (twoCopies.kind !== 'planned' || oneCopy.kind !== 'planned') throw new Error('the curved preview was refused');
		const twoGeometry = openingFacePaper(twoCopies.document, new Set(twoCopies.createdOpeningIds), ELEVATION);
		const oneGeometry = openingFacePaper(oneCopy.document, new Set(oneCopy.createdOpeningIds), ELEVATION);
		expect(twoGeometry.segments.length).toBe(oneGeometry.segments.length * 2);

		publishRepeat(mounted, fixture.openingId, 2, 1);
		const proposal = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-opening-repeat');
		expect(proposal).toBeDefined();
		expect(proposal!.segments).toHaveLength(twoGeometry.segments.length);

		const outcome = await repeatOutcome(mounted, fixture.openingId, 2, 1);
		expect(outcome.kind).toBe('installed');
		const after = acceptedLayout(mounted.facade);
		const copies = after.openings.filter((opening) => opening.id !== fixture.openingId);
		expect(copies).toHaveLength(2);
		expect(copies.map((opening) => opening.offset).sort((a, b) => a - b)).toEqual([
			source.offset + 1,
			source.offset + 2
		]);
		for (const copy of copies) {
			expect(copy.wallId).toBe(fixture.wallId);
			expect(copy.width).toBe(source.width);
		}
		// Every copy resolves on the same physical host, never past its end.
		for (const copy of copies) {
			const at = frame.pointAt(copy.offset);
			expect(at).not.toBeNull();
		}
		expect(wallFirstWallLength(after, fixture.wallId)).toBeCloseTo(frame.length, 6);
		expect(after.openings.every((opening) => opening.wallId === fixture.wallId)).toBe(true);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('[cap:layout.opening-repeat core] renders Repeat in the Opening Card and commits from it', async () => {
		const fixture = enclosureFixture(1);
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);

		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutOpeningRepeat, {
			target,
			props: { services: mounted.services }
		});
		const beforeHistory = mounted.host.history();
		try {
			await tick();
			expect(target.querySelector('[data-opening-repeat]')).not.toBeNull();
			const count = target.querySelector<HTMLInputElement>('[data-opening-repeat-count]')!;
			const spacing = target.querySelector<HTMLInputElement>('[data-opening-repeat-spacing]')!;
			// Selecting the Opening writes nothing, but the default batch is already
			// the Stage proposal: Repeat cannot commit a batch it has not shown.
			const beforeEdit = acceptedLayout(mounted.facade);
			expect(beforeEdit.openings).toHaveLength(1);
			expect(target.querySelector('[data-opening-repeat-note]')!.textContent).toContain('Adds 2 windows');
			const initialPreview = previewOpeningRepeat({
				document: beforeEdit,
				openingId: fixture.openingId,
				count: 2,
				spacing: 1
			});
			if (initialPreview.kind !== 'planned') throw new Error(initialPreview.message);
			const initialGeometry = openingFacePaper(
				initialPreview.document,
				new Set(initialPreview.createdOpeningIds),
				ELEVATION
			);
			const initialProposal = mounted.facade
				.candidatePreviews()
				.find((candidate) => candidate.id === 'layout-candidate-opening-repeat');
			expect(initialProposal).toBeDefined();
			expect(initialProposal!.segments).toHaveLength(initialGeometry.segments.length);

			count.value = '4';
			count.dispatchEvent(new Event('input', { bubbles: true }));
			spacing.value = '2';
			spacing.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			settle(mounted.facade);
			expect(target.querySelector('[data-opening-repeat-note]')!.textContent).toContain('4 windows');
			expect(target.querySelector('[data-opening-repeat-note]')!.textContent).toContain('12.00 m Wall');
			// The Stage shows the proposal before the press.
			expect(
				mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-repeat')
			).toBe(true);

			const submit = target.querySelector<HTMLButtonElement>('[data-opening-repeat-submit]')!;
			expect(submit.disabled).toBe(false);
			submit.click();
			await eventually(() => acceptedLayout(mounted.facade).openings.length === 5);
			const after = acceptedLayout(mounted.facade);
			expect(after.openings.filter((opening) => opening.wallId === fixture.wallId)).toHaveLength(5);
			expect(mounted.host.history()).toMatchObject({
				depth: beforeHistory.depth + 1,
				position: beforeHistory.position + 1
			});
			// The committed copies replace the proposal, never double it.
			settle(mounted.facade);
			expect(
				mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-repeat')
			).toBe(false);
			// The success notice stands alone: the same values now collide with the
			// copies they just made, and that refusal must not read as a failure.
			await eventually(() => target.querySelector('[data-opening-repeat-notice]') !== null);
			expect(target.querySelector('[data-opening-repeat-notice]')!.textContent).toContain('Added 4 copies.');
			expect(target.querySelector('[data-opening-repeat-note]')).toBeNull();
		} finally {
			await unmount(component);
		}
	});

	it('[cap:layout.opening-repeat core] retargets a live Card panel when the selection moves from one Opening to another', async () => {
		const fixture = twoOpeningsFixture();
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);
		const before = acceptedLayout(mounted.facade);
		const beforeHistory = mounted.host.history();

		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutOpeningRepeat, {
			target,
			props: { services: mounted.services }
		});
		try {
			await tick();
			// A → B while the same panel instance stays mounted. The facade's own
			// change notification must re-read the subject, not keep the first Opening.
			selectOpening(mounted.facade, fixture.secondOpeningId);
			settle(mounted.facade);
			await tick();

			// The retargeted panel's own defaults are on the Stage before any edit.
			expect(target.querySelector('[data-opening-repeat-note]')!.textContent).toContain('Adds 2 windows');
			expect(
				mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-repeat')
			).toBe(true);

			const spacing = target.querySelector<HTMLInputElement>('[data-opening-repeat-spacing]')!;
			spacing.value = '2';
			spacing.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			settle(mounted.facade);
			expect(target.querySelector('[data-opening-repeat-note]')!.textContent).toContain('Adds 2 windows');
			const proposal = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-opening-repeat');
			expect(proposal).toBeDefined();

			target.querySelector<HTMLButtonElement>('[data-opening-repeat-submit]')!.click();
			await eventually(() => acceptedLayout(mounted.facade).openings.length === 4);

			const after = acceptedLayout(mounted.facade);
			const created = after.openings.filter((opening) => before.openings.every((entry) => entry.id !== opening.id));
			// B is at 6 m; its copies land at 8 and 10 m. A (at 1 m) is untouched.
			expect(created.map((opening) => opening.offset).sort((a, b) => a - b)).toEqual([8, 10]);
			expect(after.openings.some((opening) => Math.abs(opening.offset - 3) < 1e-9)).toBe(false);
			expect(mounted.host.history()).toMatchObject({
				depth: beforeHistory.depth + 1,
				position: beforeHistory.position + 1
			});
		} finally {
			await unmount(component);
		}
	});

	it('[cap:layout.opening-repeat core] runs a second Repeat against the refreshed source after its own install', async () => {
		const fixture = enclosureFixture(1);
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);
		const beforeHistory = mounted.host.history();

		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutOpeningRepeat, {
			target,
			props: { services: mounted.services }
		});
		try {
			await tick();
			const count = target.querySelector<HTMLInputElement>('[data-opening-repeat-count]')!;
			const spacing = target.querySelector<HTMLInputElement>('[data-opening-repeat-spacing]')!;
			count.value = '1';
			count.dispatchEvent(new Event('input', { bubbles: true }));
			spacing.value = '2';
			spacing.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			target.querySelector<HTMLButtonElement>('[data-opening-repeat-submit]')!.click();
			await eventually(() => acceptedLayout(mounted.facade).openings.length === 2);
			settle(mounted.facade);

			// The accepted edit replaced the source. The panel must publish its next
			// proposal under the new source key, or the Stage would show nothing.
			spacing.value = '6';
			spacing.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			settle(mounted.facade);
			expect(
				mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-opening-repeat')
			).toBe(true);

			target.querySelector<HTMLButtonElement>('[data-opening-repeat-submit]')!.click();
			await eventually(() => acceptedLayout(mounted.facade).openings.length === 3);
			const after = acceptedLayout(mounted.facade);
			expect(after.openings.map((opening) => opening.offset).sort((a, b) => a - b)).toEqual([1, 3, 7]);
			expect(mounted.host.history()).toMatchObject({
				depth: beforeHistory.depth + 2,
				position: beforeHistory.position + 2
			});
		} finally {
			await unmount(component);
		}
	});

	it('[cap:layout.opening-repeat edge] keeps a refused Card batch in words and writes nothing', async () => {
		const fixture = enclosureFixture(1);
		const mounted = await mountProject(fixture);
		selectOpening(mounted.facade, fixture.openingId);
		settle(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutOpeningRepeat, {
			target,
			props: { services: mounted.services }
		});
		try {
			await tick();
			const count = target.querySelector<HTMLInputElement>('[data-opening-repeat-count]')!;
			const spacing = target.querySelector<HTMLInputElement>('[data-opening-repeat-spacing]')!;
			count.value = '4';
			count.dispatchEvent(new Event('input', { bubbles: true }));
			spacing.value = '3.5';
			spacing.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			settle(mounted.facade);
			const note = target.querySelector('[data-opening-repeat-note]')!;
			expect(note.textContent).toContain('past the 12.00 m Wall');
			expect(note.classList.contains('refused')).toBe(true);
			// A refused proposal is not actionable, and the reason is already spoken.
			expect(target.querySelector<HTMLButtonElement>('[data-opening-repeat-submit]')!.disabled).toBe(true);
			expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
			expect(mounted.host.history()).toEqual(beforeHistory);
		} finally {
			await unmount(component);
		}
	});
});
