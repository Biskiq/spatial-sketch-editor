/**
 * V1c — the region operation set.
 *
 * One `DomainPlanner` per writable region fact, each delegating to a retained
 * planner in `@portfolio/layout-core` (§5.3 and §5.5). Nothing here mutates a
 * document by hand: the planner's own gates (G1–G5, Opening fit, compiled
 * acceptance) decide, so an accepted candidate is a real current-format Layout.
 *
 * The Card, the direct-manipulation grips and the Stage viewport all build the
 * same intents from this module, so one gesture is one intent and one history
 * entry on the one F4 path.
 */
import {
	allocateCapturedId,
	duplicateRegionSurfaceLineage,
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	planCreateRegion,
	planDuplicateRegion,
	planFitRegionEdgeToWall,
	planFitRegionToSpace,
	planFitRegionToWalls,
	planFitWallsToRegion,
	planMoveRegion,
	planRemoveRegion,
	planRenameRegion,
	planRotateRegion,
	planSetRegionElevation,
	planSetRegionFootprint,
	planSetRegionIntendedGap,
	planSetRegionThickness,
	regionWallRelations,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutRegion,
	type LayoutSurfaceLineage,
	type LayoutVec2,
	type RegionPlan
} from '@portfolio/layout-core';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PlannerRequest
} from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { stageLayout, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

import { compileLayoutGeometryNow } from './compile-context';
import { layoutSubjectReference } from './drawing-planners';
import { layoutPlanner, preparedLayoutCandidate } from './precision';

export const LAYOUT_REGION_CREATE_KIND = 'layout-region-create';
export const LAYOUT_REGION_MOVE_KIND = 'layout-region-move';
export const LAYOUT_REGION_ROTATE_KIND = 'layout-region-rotate';
export const LAYOUT_REGION_FOOTPRINT_KIND = 'layout-region-footprint';
export const LAYOUT_REGION_ELEVATION_KIND = 'layout-region-elevation';
export const LAYOUT_REGION_THICKNESS_KIND = 'layout-region-thickness';
export const LAYOUT_REGION_INTENDED_GAP_KIND = 'layout-region-intended-gap';
export const LAYOUT_REGION_NAME_KIND = 'layout-region-name';
export const LAYOUT_REGION_REMOVE_KIND = 'layout-region-remove';
export const LAYOUT_REGION_DUPLICATE_KIND = 'layout-region-duplicate';
export const LAYOUT_REGION_FIT_SPACE_KIND = 'layout-region-fit-space';
export const LAYOUT_REGION_FIT_EDGE_KIND = 'layout-region-fit-edge';
export const LAYOUT_REGION_FIT_ROOF_KIND = 'layout-region-fit-roof';
export const LAYOUT_REGION_FIT_WALLS_KIND = 'layout-region-fit-walls';

/** The two roles an authored region can be born with. Immutable after birth. */
export type RegionRole = LayoutRegion['role'];

type Payload = Readonly<Record<string, unknown>>;

const PAYLOAD_KEYS: Readonly<Record<string, readonly string[]>> = {
	[LAYOUT_REGION_CREATE_KIND]: ['regionId', 'role', 'footprint', 'elevation', 'thickness', 'name'],
	[LAYOUT_REGION_MOVE_KIND]: ['regionId', 'deltaX', 'deltaZ'],
	[LAYOUT_REGION_ROTATE_KIND]: ['regionId', 'angleRadians'],
	[LAYOUT_REGION_FOOTPRINT_KIND]: ['regionId', 'points'],
	[LAYOUT_REGION_ELEVATION_KIND]: ['regionId', 'elevation'],
	[LAYOUT_REGION_THICKNESS_KIND]: ['regionId', 'thickness'],
	[LAYOUT_REGION_INTENDED_GAP_KIND]: ['regionId', 'wallId', 'intended'],
	[LAYOUT_REGION_NAME_KIND]: ['regionId', 'name'],
	[LAYOUT_REGION_REMOVE_KIND]: ['regionId'],
	[LAYOUT_REGION_DUPLICATE_KIND]: ['regionId', 'sourceRegionId', 'deltaX', 'deltaZ'],
	[LAYOUT_REGION_FIT_SPACE_KIND]: ['regionId', 'roomId'],
	[LAYOUT_REGION_FIT_EDGE_KIND]: ['regionId', 'wallId'],
	[LAYOUT_REGION_FIT_ROOF_KIND]: ['regionId', 'wallIds'],
	[LAYOUT_REGION_FIT_WALLS_KIND]: ['regionId', 'wallIds']
};

function rejected(code: string, message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

function opaqueId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function finiteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function readPayload(
	kind: string,
	payload: AuthoringIntent['payload']
): { readonly value: Payload } | PlanFailure {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return { message: 'The operation payload must be an object.' };
	}
	const record = payload as Payload;
	const expected = PAYLOAD_KEYS[kind]!;
	const unknown = Object.keys(record).filter((key) => !expected.includes(key));
	if (unknown.length > 0) {
		return { message: `The ${kind} payload cannot carry ${unknown.join(', ')}.` };
	}
	for (const key of expected) {
		if (!(key in record)) return { message: `The ${kind} payload is missing "${key}".` };
	}
	return { value: record };
}

type PlanFailure = { readonly message: string };

function isFailure(value: { readonly value: Payload } | PlanFailure): value is PlanFailure {
	return 'message' in value;
}

/** Points must arrive as the plain `[x, z]` pairs an intent can serialize. */
function readPoints(value: unknown): LayoutVec2[] | null {
	if (!Array.isArray(value) || value.length < 3) return null;
	const points: LayoutVec2[] = [];
	for (const entry of value) {
		if (
			!Array.isArray(entry) ||
			entry.length !== 2 ||
			!finiteNumber(entry[0]) ||
			!finiteNumber(entry[1])
		) {
			return null;
		}
		points.push([entry[0], entry[1]]);
	}
	return points;
}

function readWallIds(value: unknown): string[] | null {
	if (!Array.isArray(value) || !value.every(opaqueId)) return null;
	return [...new Set(value)];
}

function readName(value: unknown): string | null | undefined {
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;
	return value;
}

/**
 * A region intent addresses exactly one region, or — for a birth — no existing
 * subject and the identity its capture derives.
 */
function addressedRegion(
	request: PlannerRequest<ProjectEnvelope>,
	regionId: string
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
	if (request.intent.targets.length !== 1) {
		return { ok: false, message: 'A region edit addresses exactly one region.' };
	}
	const target = request.intent.targets[0]!;
	if (target.domain !== 'layout' || target.subject.kind !== 'region' || target.subject.id !== regionId) {
		return {
			ok: false,
			message: `The intent must address the region "${regionId}" it edits.`
		};
	}
	return { ok: true };
}

function addressedBirth(
	request: PlannerRequest<ProjectEnvelope>
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
	if (request.intent.targets.length !== 0) {
		return { ok: false, message: 'A region birth addresses no existing subject.' };
	}
	return { ok: true };
}

function capturedIdentity(
	request: PlannerRequest<ProjectEnvelope>
): { readonly capture: LayoutIdCapture; readonly levelId: string } | PlanFailure {
	const capture = readLayoutIdCapture(request.intent.capturedInputs);
	if (capture === null) {
		return { message: 'The region must capture its identity before evaluation.' };
	}
	const levelId = readLayoutWorkingLevel(request.intent.capturedInputs);
	if (levelId === null) {
		return { message: 'The intent must capture its working Layout level before evaluation.' };
	}
	return { capture, levelId };
}

function documentIds(document: LayoutDocumentWallFirst): Set<string> {
	const ids = new Set<string>([document.floor.id]);
	for (const collection of [
		document.junctions,
		document.walls,
		document.rooms,
		document.openings,
		document.objects,
		document.regions
	]) {
		for (const entry of collection as readonly { id: string }[]) ids.add(entry.id);
	}
	return ids;
}

/**
 * The id one birth capture derives. The Stage needs it before acceptance to
 * address its own candidate and to select the created subject after install, and
 * it must be the planner's answer rather than a second allocation rule.
 */
export function regionIdFromCapture(
	document: LayoutDocumentWallFirst,
	capture: LayoutIdCapture
): string {
	return allocateCapturedId(documentIds(document), 'region', capture);
}

function regionPlanOutcome(
	request: PlannerRequest<ProjectEnvelope>,
	kind: string,
	plan: RegionPlan,
	fields: readonly string[],
	options: {
		readonly created?: boolean;
		readonly retired?: boolean;
		readonly id?: string;
		readonly surfaceLineage?: LayoutSurfaceLineage;
	} = {}
): PlannerOutcome<ProjectEnvelope> {
	if (plan.kind === 'rejected') {
		return rejected(plan.rejection.code, plan.rejection.message);
	}
	const regionId = options.id ?? plan.regionId;
	return preparedLayoutCandidate(
		request,
		kind,
		{ kind: 'region', id: regionId },
		plan.document,
		fields,
		{
			...(options.created === true ? { created: true } : {}),
			...(options.retired === true ? { retired: true } : {}),
			id: regionId,
			// Edits keep their ids and removal is pruned by the Scene applicator.
			// Duplicate is the one operation that carries a shared Finish.
			surfaceLineage: options.surfaceLineage ?? []
		}
	);
}

/* --- Intent builders --------------------------------------------------- */

export function regionCreateIntent(input: {
	readonly regionId: string;
	readonly role: RegionRole;
	readonly footprint: readonly LayoutVec2[];
	readonly elevation: number;
	readonly thickness: number;
	readonly name?: string | null;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return regionIntent(LAYOUT_REGION_CREATE_KIND, input, [], {
		regionId: input.regionId,
		role: input.role,
		footprint: input.footprint.map(([x, z]) => [x, z]),
		elevation: input.elevation,
		thickness: input.thickness,
		name: input.name ?? null
	}, input.capture);
}

export function regionDuplicateIntent(input: {
	readonly regionId: string;
	readonly sourceRegionId: string;
	readonly delta: LayoutVec2;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return regionIntent(
		LAYOUT_REGION_DUPLICATE_KIND,
		input,
		[regionReference(input.sourceRegionId, input.contentRevision, input.levelId)],
		{
			regionId: input.regionId,
			sourceRegionId: input.sourceRegionId,
			deltaX: input.delta[0],
			deltaZ: input.delta[1]
		},
		input.capture
	);
}

export function regionEditIntent(input: {
	readonly kind: string;
	readonly regionId: string;
	readonly payload: AuthoringIntent['payload'];
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return regionIntent(
		input.kind,
		input,
		[regionReference(input.regionId, input.contentRevision, input.levelId)],
		// Every region operation payload names its subject once; callers that edit
		// or manipulate a region never repeat the id.
		typeof input.payload === 'object' && input.payload !== null && !Array.isArray(input.payload)
			? { regionId: input.regionId, ...input.payload }
			: { regionId: input.regionId }
	);
}

function regionIntent(
	kind: string,
	input: {
		readonly operationId: string;
		readonly projectId: string;
		readonly revisionId: string;
		readonly contentRevision: string;
		readonly levelId: string;
	},
	targets: AuthoringIntent['targets'],
	payload: AuthoringIntent['payload'],
	capture?: LayoutIdCapture
): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [...targets],
		payload,
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			...(capture === undefined ? [] : [layoutIdCaptureInput(capture)])
		],
		allocatedIds: []
	};
}

function regionReference(regionId: string, contentRevision: string, levelId: string): AuthoringIntent['targets'][number] {
	return layoutSubjectReference({ kind: 'region', id: regionId, contentRevision, levelId });
}

/**
 * The compiled facts a region relation gate reads. A planner request carries the
 * prior source, not derived geometry; these operations are rare (a fit, a gap
 * mark), so the cold oracle is the honest read rather than a second cache.
 */
function compiledNow(request: PlannerRequest<ProjectEnvelope>) {
	return compileLayoutGeometryNow(request.snapshot.domain.source.units.layout.data);
}

/* --- Planners ---------------------------------------------------------- */

function regionCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_CREATE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_CREATE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const birth = addressedBirth(request);
		if (!birth.ok) return rejected('invalid-value', birth.message);
		const identity = capturedIdentity(request);
		if ('message' in identity) return rejected('invalid-value', identity.message);
		const record = payload.value;
		const footprint = readPoints(record.footprint);
		const role = record.role;
		const name = readName(record.name);
		if (!opaqueId(record.regionId) || !footprint) {
			return rejected('invalid-value', 'A region needs its derived id and a footprint of 3 to 1024 points.');
		}
		if (role !== 'floor' && role !== 'overhead') {
			return rejected('invalid-value', "A region role must be 'floor' or 'overhead'.");
		}
		if (!finiteNumber(record.elevation) || !finiteNumber(record.thickness)) {
			return rejected('invalid-value', 'A region needs finite elevation and thickness in meters.');
		}
		if (name === undefined) return rejected('invalid-value', 'A region name must be a string or null.');
		const baseline = request.snapshot.domain.source.units.layout.data;
		const expected = regionIdFromCapture(baseline, identity.capture);
		if (record.regionId !== expected) {
			return rejected(
				'invalid-value',
				`The region payload names '${record.regionId}', but this operation's nonce derives '${expected}'.`
			);
		}
		const plan = planCreateRegion({
			baseline,
			capture: identity.capture,
			intent: {
				role,
				footprint,
				elevation: record.elevation,
				thickness: record.thickness,
				...(name === null ? {} : { name })
			}
		});
		return regionPlanOutcome(request, LAYOUT_REGION_CREATE_KIND, plan, ['regions'], {
			created: true,
			id: expected
		});
	});
}

function regionMovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_MOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_MOVE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, deltaX, deltaZ } = payload.value;
		if (!opaqueId(regionId) || !finiteNumber(deltaX) || !finiteNumber(deltaZ)) {
			return rejected('invalid-value', 'A region move needs one region id and a finite X/Z delta.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planMoveRegion(request.snapshot.domain.source.units.layout.data, regionId, [
			deltaX,
			deltaZ
		]);
		return regionPlanOutcome(request, LAYOUT_REGION_MOVE_KIND, plan, ['regions']);
	});
}

function regionRotatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_ROTATE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_ROTATE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, angleRadians } = payload.value;
		if (!opaqueId(regionId) || !finiteNumber(angleRadians)) {
			return rejected('invalid-value', 'A region rotation needs one region id and a finite angle.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planRotateRegion(
			request.snapshot.domain.source.units.layout.data,
			regionId,
			angleRadians
		);
		return regionPlanOutcome(request, LAYOUT_REGION_ROTATE_KIND, plan, ['regions']);
	});
}

function regionFootprintPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_FOOTPRINT_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_FOOTPRINT_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const regionId = payload.value.regionId;
		const points = readPoints(payload.value.points);
		if (!opaqueId(regionId) || points === null) {
			return rejected('invalid-value', 'A footprint edit needs one region id and 3 to 1024 finite points.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planSetRegionFootprint(
			request.snapshot.domain.source.units.layout.data,
			regionId,
			points
		);
		return regionPlanOutcome(request, LAYOUT_REGION_FOOTPRINT_KIND, plan, ['regions']);
	});
}

function regionElevationPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_ELEVATION_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_ELEVATION_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, elevation } = payload.value;
		if (!opaqueId(regionId) || !finiteNumber(elevation)) {
			return rejected('invalid-value', 'A region elevation needs one region id and a finite height.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planSetRegionElevation(
			request.snapshot.domain.source.units.layout.data,
			regionId,
			elevation
		);
		return regionPlanOutcome(request, LAYOUT_REGION_ELEVATION_KIND, plan, ['regions']);
	});
}

function regionThicknessPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_THICKNESS_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_THICKNESS_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, thickness } = payload.value;
		if (!opaqueId(regionId) || !finiteNumber(thickness)) {
			return rejected('invalid-value', 'A region thickness needs one region id and a finite thickness.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planSetRegionThickness(
			request.snapshot.domain.source.units.layout.data,
			regionId,
			thickness
		);
		return regionPlanOutcome(request, LAYOUT_REGION_THICKNESS_KIND, plan, ['regions']);
	});
}

function regionIntendedGapPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_INTENDED_GAP_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_INTENDED_GAP_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, wallId, intended } = payload.value;
		if (!opaqueId(regionId) || !opaqueId(wallId) || typeof intended !== 'boolean') {
			return rejected('invalid-value', 'An intended gap needs one region, one Wall and a boolean.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planSetRegionIntendedGap(
			request.snapshot.domain.source.units.layout.data,
			compiledNow(request),
			regionId,
			wallId,
			intended
		);
		return regionPlanOutcome(request, LAYOUT_REGION_INTENDED_GAP_KIND, plan, [
			'regions',
			'intendedGaps'
		]);
	});
}

function regionNamePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_NAME_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_NAME_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const regionId = payload.value.regionId;
		const name = readName(payload.value.name);
		if (!opaqueId(regionId) || name === undefined) {
			return rejected('invalid-value', 'A region name needs one region id and a string or null.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planRenameRegion(
			request.snapshot.domain.source.units.layout.data,
			regionId,
			{ name }
		);
		return regionPlanOutcome(request, LAYOUT_REGION_NAME_KIND, plan, ['regions', 'name']);
	});
}

function regionRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_REMOVE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_REMOVE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const regionId = payload.value.regionId;
		if (!opaqueId(regionId)) return rejected('invalid-value', 'Removing a region needs its id.');
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planRemoveRegion(request.snapshot.domain.source.units.layout.data, regionId);
		return regionPlanOutcome(request, LAYOUT_REGION_REMOVE_KIND, plan, ['regions'], {
			retired: true
		});
	});
}

function regionDuplicatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_DUPLICATE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_DUPLICATE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const identity = capturedIdentity(request);
		if ('message' in identity) return rejected('invalid-value', identity.message);
		const { regionId, sourceRegionId, deltaX, deltaZ } = payload.value;
		if (
			!opaqueId(regionId) ||
			!opaqueId(sourceRegionId) ||
			!finiteNumber(deltaX) ||
			!finiteNumber(deltaZ)
		) {
			return rejected('invalid-value', 'A region duplicate needs its derived id, a source and a delta.');
		}
		const addressed = addressedRegion(request, sourceRegionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const baseline = request.snapshot.domain.source.units.layout.data;
		const expected = regionIdFromCapture(baseline, identity.capture);
		if (regionId !== expected) {
			return rejected(
				'invalid-value',
				`The region payload names '${regionId}', but this operation's nonce derives '${expected}'.`
			);
		}
		const plan = planDuplicateRegion(
			baseline,
			{ regionId: sourceRegionId, delta: [deltaX, deltaZ] },
			identity.capture
		);
		return regionPlanOutcome(request, LAYOUT_REGION_DUPLICATE_KIND, plan, ['regions'], {
			created: true,
			id: expected,
			surfaceLineage: duplicateRegionSurfaceLineage(sourceRegionId, expected)
		});
	});
}

function regionFitSpacePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_FIT_SPACE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_FIT_SPACE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, roomId } = payload.value;
		if (!opaqueId(regionId) || !opaqueId(roomId)) {
			return rejected('invalid-value', 'Fit to space needs one region and one Room.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planFitRegionToSpace(
			request.snapshot.domain.source.units.layout.data,
			compiledNow(request),
			regionId,
			roomId
		);
		return regionPlanOutcome(request, LAYOUT_REGION_FIT_SPACE_KIND, plan, ['regions']);
	});
}

function regionFitEdgePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_FIT_EDGE_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_FIT_EDGE_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const { regionId, wallId } = payload.value;
		if (!opaqueId(regionId) || !opaqueId(wallId)) {
			return rejected('invalid-value', 'Meet wall needs one region and one Wall.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planFitRegionEdgeToWall(
			request.snapshot.domain.source.units.layout.data,
			compiledNow(request),
			regionId,
			wallId
		);
		return regionPlanOutcome(request, LAYOUT_REGION_FIT_EDGE_KIND, plan, ['regions']);
	});
}

function regionFitRoofPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_FIT_ROOF_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_FIT_ROOF_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const regionId = payload.value.regionId;
		const wallIds = readWallIds(payload.value.wallIds);
		if (!opaqueId(regionId) || wallIds === null) {
			return rejected('invalid-value', 'Fit roof to walls needs one region and its chosen Walls.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planFitRegionToWalls(
			request.snapshot.domain.source.units.layout.data,
			compiledNow(request),
			regionId,
			wallIds
		);
		return regionPlanOutcome(request, LAYOUT_REGION_FIT_ROOF_KIND, plan, ['regions']);
	});
}

function regionFitWallsPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_REGION_FIT_WALLS_KIND, (request) => {
		const payload = readPayload(LAYOUT_REGION_FIT_WALLS_KIND, request.intent.payload);
		if (isFailure(payload)) return rejected('invalid-value', payload.message);
		const regionId = payload.value.regionId;
		const wallIds = readWallIds(payload.value.wallIds);
		if (!opaqueId(regionId) || wallIds === null) {
			return rejected('invalid-value', 'Fit walls to roof needs one region and its chosen Walls.');
		}
		const addressed = addressedRegion(request, regionId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planFitWallsToRegion(
			request.snapshot.domain.source.units.layout.data,
			compiledNow(request),
			regionId,
			wallIds
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		const outcome = preparedLayoutCandidate(
			request,
			LAYOUT_REGION_FIT_WALLS_KIND,
			{ kind: 'region', id: regionId },
			plan.document,
			['regions', 'walls'],
			{ id: regionId, surfaceLineage: [] }
		);
		return outcome;
	});
}

/** Every V1c region planner, one operation kind each. */
export function createRegionPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [
		regionCreatePlanner(),
		regionMovePlanner(),
		regionRotatePlanner(),
		regionFootprintPlanner(),
		regionElevationPlanner(),
		regionThicknessPlanner(),
		regionIntendedGapPlanner(),
		regionNamePlanner(),
		regionRemovePlanner(),
		regionDuplicatePlanner(),
		regionFitSpacePlanner(),
		regionFitEdgePlanner(),
		regionFitRoofPlanner(),
		regionFitWallsPlanner()
	];
}

/**
 * The relations the Card shows for one region, or `null` while they cannot be
 * read. Relations are derived on demand for the selected region only.
 */
export function layoutRegionNameTarget(
	services: StageAdapterServices,
	regionId: string
): {
	readonly value: string;
	commit(name: string): Promise<{ kind: 'accepted' } | { kind: 'refused'; code: string; message: string }>;
} {
	const document = stageLayout(services.stage.snapshot());
	return {
		value: document.regions.find((region) => region.id === regionId)?.name ?? '',
		async commit(name: string) {
			const snapshot = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				regionEditIntent({
					kind: LAYOUT_REGION_NAME_KIND,
					regionId,
					payload: { regionId, name },
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: snapshot.domain.unitRevisions.layout,
					levelId: snapshot.domain.layoutLevelId
				})
			);
			if (outcome.kind === 'refused') {
				return { kind: 'refused', code: outcome.code, message: outcome.message };
			}
			return { kind: 'accepted' };
		}
	};
}

export function regionRelationsNow(
	compiled: Parameters<typeof regionWallRelations>[0],
	region: LayoutRegion
): ReturnType<typeof regionWallRelations> {
	return regionWallRelations(compiled, region);
}
