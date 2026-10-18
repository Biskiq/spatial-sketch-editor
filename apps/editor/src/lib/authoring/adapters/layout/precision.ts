/**
 * T1.P01.S04 — the existing-Layout precision operation set.
 *
 * One `DomainPlanner` per writable fact, each delegating to a **retained**
 * Layout planner (`layout-core`). Nothing here hand-mutates geometry: the
 * planner's own candidate gates validate the document, reconcile Rooms and
 * maintain the identity ledger, so an accepted candidate is a real
 * current-format Layout rather than a shape that merely resembles one.
 *
 * Writable facts (and nothing else):
 *
 * | Operation | Kind | Retained planner |
 * | --- | --- | --- |
 * | Wall height | `layout-wall-height` | `planExactWallHeight` |
 * | Wall thickness | `layout-wall-thickness` | `planExactWallThickness` |
 * | Opening offset/width/height/sill | `layout-opening-measure` | `planUpdateWallFirstOpening` |
 * | Wall/Opening name | `layout-entity-name` | `planWallMetadataUpdate` / `planOpeningMetadataUpdate` |
 * | Place → Layout plinth | `layout-plinth-place` | `planCommitLayoutObjectPresetWithId` |
 *
 * Explicitly absent: independent arch rise, Wall roles, profile conversion,
 * Floor storey height and Layout-object rename. Those are read-only facts and
 * the Instrument explains them as unavailable rather than exposing a disabled
 * control that looks writable.
 */

import {
	planCommitLayoutObjectPresetWithId,
	planExactWallHeight,
	planExactWallThickness,
	planOpeningMetadataUpdate,
	planUpdateWallFirstOpening,
	planWallMetadataUpdate,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	CURRENT_SOURCE_KIND,
	CURRENT_SOURCE_VERSION,
	type AuthoringIntent,
	type DomainPlanner,
	type PlannerOutcome,
	type PlannerRequest,
	type PreparedCandidate,
	type ProjectDocument,
	type SemanticReference
} from '@portfolio/project-model';

export const LAYOUT_WALL_HEIGHT_KIND = 'layout-wall-height';
export const LAYOUT_WALL_THICKNESS_KIND = 'layout-wall-thickness';
export const LAYOUT_OPENING_MEASURE_KIND = 'layout-opening-measure';
export const LAYOUT_ENTITY_NAME_KIND = 'layout-entity-name';
export const LAYOUT_PLINTH_PLACE_KIND = 'layout-plinth-place';

/** The one opening field each edit owns; the UI never sends a combined patch. */
export type LayoutOpeningField = 'offset' | 'width' | 'height' | 'sillHeight';

export type LayoutSubjectKind = 'wall' | 'opening' | 'object';

export type LayoutSubject = {
	readonly kind: LayoutSubjectKind;
	readonly id: string;
};

export type LayoutFact = { readonly label: string; readonly value: string };

const PAYLOAD_KEYS: Readonly<Record<string, readonly string[]>> = {
	[LAYOUT_WALL_HEIGHT_KIND]: ['wallId', 'height'],
	[LAYOUT_WALL_THICKNESS_KIND]: ['wallId', 'thickness'],
	[LAYOUT_OPENING_MEASURE_KIND]: ['openingId', 'field', 'value'],
	[LAYOUT_ENTITY_NAME_KIND]: ['subjectKind', 'subjectId', 'name'],
	[LAYOUT_PLINTH_PLACE_KIND]: ['point', 'floorElevation', 'objectId']
};

/**
 * A payload with exactly the keys its operation owns. An unknown key is refused
 * rather than ignored: a UI that starts sending `keepBottom` must be told the
 * operation does not support it, not silently have it dropped.
 */
function readPayload(
	kind: string,
	payload: unknown
): { readonly value: Record<string, unknown> } | { readonly message: string } {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return { message: 'The operation payload must be an object.' };
	}
	const record = payload as Record<string, unknown>;
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

function finitePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function opaqueId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

export function isLayoutOpeningField(value: unknown): value is LayoutOpeningField {
	return value === 'offset' || value === 'width' || value === 'height' || value === 'sillHeight';
}

/** An exact F.1 reference to one Layout subject in the current level. */
export function layoutReference(
	snapshot: PlannerRequest<ProjectDocument>['snapshot'],
	subject: LayoutSubject,
	contentRevision: string
): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: subject.kind, id: subject.id },
		instancePath: [],
		location: {
			kind: 'layout-location',
			// The authored level id, read from the admitted source rather than a second
			// level registry: P23 has exactly one canonical Floor.
			levelId: snapshot.domain.source.layout.floor.id,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
}

function rejected(code: string, message: string): PlannerOutcome<ProjectDocument> {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

function layoutPlanner(
	kind: string,
	prepare: (request: PlannerRequest<ProjectDocument>) => PlannerOutcome<ProjectDocument>
): DomainPlanner<ProjectDocument> {
	return {
		id: `layout.${kind}`,
		kind,
		admission: Object.freeze({ domain: 'layout', compound: false, units: false, resources: false }),
		sourceKinds: [CURRENT_SOURCE_KIND],
		sourceVersions: [CURRENT_SOURCE_VERSION],
		prepare
	};
}

/**
 * The intent must address exactly the subject its payload edits.
 *
 * Without this check a stale instrument (selection moved, payload not rebuilt)
 * could edit one Wall while its correspondence claims another survived, and the
 * accepted selection would requalify the wrong entry.
 */
function addressedSubject(
	request: PlannerRequest<ProjectDocument>,
	kind: LayoutSubjectKind,
	id: string
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
	if (request.intent.targets.length !== 1) {
		return { ok: false, message: 'A Layout precision intent addresses exactly one subject.' };
	}
	const target = request.intent.targets[0]!;
	if (target.domain !== 'layout' || target.subject.kind !== kind || target.subject.id !== id) {
		return {
			ok: false,
			message: `The intent must address the ${kind} "${id}" it edits.`
		};
	}
	return { ok: true };
}

function prepared(
	request: PlannerRequest<ProjectDocument>,
	operationKind: string,
	subject: LayoutSubject,
	document: LayoutDocumentWallFirst,
	fields: readonly string[],
	options: { readonly created?: boolean; readonly id?: string } = {}
): PlannerOutcome<ProjectDocument> {
	const reference = layoutReference(request.snapshot, subject, request.snapshot.sourceContentId);
	const candidate: PreparedCandidate<ProjectDocument> = {
		operationId: request.intent.operationId,
		sourceKind: CURRENT_SOURCE_KIND,
		sourceVersion: CURRENT_SOURCE_VERSION,
		source: { ...request.snapshot.domain.source, layout: document },
		changes: [{ kind: operationKind, subjectIds: [options.id ?? subject.id], fields: [...fields] }],
		correspondence: [
			options.created
				? { relation: 'created', before: null, after: reference }
				: { relation: 'preserved', before: reference, after: reference }
		],
		diagnostics: []
	};
	return { kind: 'prepared', candidate };
}

function wallHeightPlanner(): DomainPlanner<ProjectDocument> {
	return layoutPlanner(LAYOUT_WALL_HEIGHT_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_HEIGHT_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, height } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(height)) {
			return rejected('invalid-value', 'A Wall height needs one wall id and one finite positive height in meters.');
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallHeight(request.snapshot.domain.source.layout, wallId, height);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(request, 'layout-wall-height', { kind: 'wall', id: wallId }, plan.document, [
			'height'
		]);
	});
}

function wallThicknessPlanner(): DomainPlanner<ProjectDocument> {
	return layoutPlanner(LAYOUT_WALL_THICKNESS_KIND, (request) => {
		const payload = readPayload(LAYOUT_WALL_THICKNESS_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { wallId, thickness } = payload.value;
		if (!opaqueId(wallId) || !finitePositive(thickness)) {
			return rejected('invalid-value', 'A Wall thickness needs one wall id and one finite positive thickness in meters.');
		}
		const addressed = addressedSubject(request, 'wall', wallId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planExactWallThickness(
			request.snapshot.domain.source.layout,
			wallId,
			thickness
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-wall-thickness',
			{ kind: 'wall', id: wallId },
			plan.document,
			['thickness']
		);
	});
}

function openingMeasurePlanner(): DomainPlanner<ProjectDocument> {
	return layoutPlanner(LAYOUT_OPENING_MEASURE_KIND, (request) => {
		const payload = readPayload(LAYOUT_OPENING_MEASURE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { openingId, field, value } = payload.value;
		if (!opaqueId(openingId) || !isLayoutOpeningField(field)) {
			return rejected(
				'invalid-value',
				'An Opening measure needs one opening id and one of offset, width, height or sill height.'
			);
		}
		// Offset and sill are non-negative; width and height must be positive. The
		// retained planner enforces the same rule, so this only names the field earlier.
		const valid = field === 'offset' || field === 'sillHeight' ? finiteNonNegative(value) : finitePositive(value);
		if (!valid) {
			return rejected(
				'invalid-value',
				`An Opening ${field} must be a finite ${field === 'offset' || field === 'sillHeight' ? 'non-negative' : 'positive'} number of meters.`
			);
		}
		const addressed = addressedSubject(request, 'opening', openingId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const plan = planUpdateWallFirstOpening(
			request.snapshot.domain.source.layout,
			openingId,
			{ [field]: value } as Parameters<typeof planUpdateWallFirstOpening>[2]
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-opening-measure',
			{ kind: 'opening', id: openingId },
			plan.document,
			[field]
		);
	});
}

function entityNamePlanner(): DomainPlanner<ProjectDocument> {
	return layoutPlanner(LAYOUT_ENTITY_NAME_KIND, (request) => {
		const payload = readPayload(LAYOUT_ENTITY_NAME_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { subjectKind, subjectId, name } = payload.value;
		if (
			(subjectKind !== 'wall' && subjectKind !== 'opening') ||
			!opaqueId(subjectId) ||
			typeof name !== 'string'
		) {
			return rejected(
				'invalid-value',
				'A Layout name edit needs one Wall or Opening id and one string name.'
			);
		}
		const addressed = addressedSubject(request, subjectKind, subjectId);
		if (!addressed.ok) return rejected('invalid-value', addressed.message);
		const document = request.snapshot.domain.source.layout;
		const plan =
			subjectKind === 'wall'
				? planWallMetadataUpdate(document, subjectId, { name })
				: planOpeningMetadataUpdate(document, subjectId, { name });
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-entity-name',
			{ kind: subjectKind, id: subjectId },
			plan.document,
			['name']
		);
	});
}

function plinthPlanner(): DomainPlanner<ProjectDocument> {
	return layoutPlanner(LAYOUT_PLINTH_PLACE_KIND, (request) => {
		const payload = readPayload(LAYOUT_PLINTH_PLACE_KIND, request.intent.payload);
		if ('message' in payload) return rejected('invalid-value', payload.message);
		const { point, floorElevation, objectId } = payload.value;
		if (!opaqueId(objectId)) {
			return rejected('invalid-value', 'A plinth placement needs the captured object id.');
		}
		if (
			!Array.isArray(point) ||
			point.length !== 2 ||
			!point.every((value) => typeof value === 'number' && Number.isFinite(value))
		) {
			return rejected('invalid-value', 'A plinth placement needs two finite working-plane X/Z meters.');
		}
		if (typeof floorElevation !== 'number' || !Number.isFinite(floorElevation)) {
			return rejected('invalid-value', 'A plinth placement needs a finite floor datum.');
		}
		// The captured datum must still be the mounted level's datum: placing at a
		// stale elevation would create an object floating at the previous floor.
		const datumMeters = request.snapshot.domain.source.layout.floor.elevation;
		if (floorElevation !== datumMeters) {
			return rejected(
				'stale-datum',
				`The captured floor datum ${floorElevation} m no longer matches the mounted level datum ${datumMeters} m.`
			);
		}
		if (request.intent.targets.length !== 0) {
			return rejected('invalid-value', 'A plinth placement addresses no existing subject.');
		}
		if (
			!request.intent.allocatedIds.some(
				(allocation) => allocation.kind === 'layout-object' && allocation.id === objectId
			)
		) {
			return rejected(
				'invalid-value',
				'A plinth placement must capture its new layout-object id before evaluation.'
			);
		}
		const plan = planCommitLayoutObjectPresetWithId(
			request.snapshot.domain.source.layout,
			'plinth',
			point as LayoutVec2,
			floorElevation,
			objectId
		);
		if (plan.kind === 'rejected') {
			return rejected(plan.rejection.code, plan.rejection.message);
		}
		return prepared(
			request,
			'layout-plinth-place',
			{ kind: 'object', id: objectId },
			plan.document,
			['objects'],
			{ created: true, id: objectId }
		);
	});
}

/** The five production Layout planners, one operation kind each. */
export function createLayoutPlanners(): readonly DomainPlanner<ProjectDocument>[] {
	return [
		wallHeightPlanner(),
		wallThicknessPlanner(),
		openingMeasurePlanner(),
		entityNamePlanner(),
		plinthPlanner()
	];
}

/** The subject a selection names, or `null` for a non-Layout / read-only selection. */
export function layoutSubjectOf(
	selection: { readonly sourceKind: string; readonly sourceId: string } | null
): LayoutSubject | null {
	if (selection === null) return null;
	if (selection.sourceKind === 'wall') return { kind: 'wall', id: selection.sourceId };
	if (selection.sourceKind === 'opening') return { kind: 'opening', id: selection.sourceId };
	if (selection.sourceKind === 'object') return { kind: 'object', id: selection.sourceId };
	return null;
}

/**
 * Full typed values, never rounded display values. JavaScript's shortest
 * round-trip number formatting is the exact value that will be saved.
 */
export function formatMeters(value: number): string {
	return `${value} m`;
}

/** Every settled writable/read-only fact the Dimensions instrument shows. */
export function layoutFacts(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly LayoutFact[] {
	if (subject.kind === 'wall') {
		const wall = document.walls.find((candidate) => candidate.id === subject.id);
		if (wall === undefined) return [];
		return [
			{ label: 'Kind', value: 'Wall' },
			{ label: 'Name', value: wall.name ?? '(unnamed)' },
			{ label: 'Height', value: formatMeters(wall.height) },
			{ label: 'Thickness', value: formatMeters(wall.thickness) },
			{ label: 'Role', value: `${wall.role} (read-only)` }
		];
	}
	if (subject.kind === 'opening') {
		const opening = document.openings.find((candidate) => candidate.id === subject.id);
		if (opening === undefined) return [];
		return [
			{ label: 'Kind', value: opening.kind === 'door' ? 'Door' : 'Window' },
			{ label: 'Name', value: opening.name ?? '(unnamed)' },
			{ label: 'Offset', value: formatMeters(opening.offset) },
			{ label: 'Width', value: formatMeters(opening.width) },
			{ label: 'Height', value: formatMeters(opening.height) },
			{ label: 'Sill', value: formatMeters(opening.sillHeight) }
		];
	}
	const object = document.objects.find((candidate) => candidate.id === subject.id);
	if (object === undefined) return [];
	return [
		{ label: 'Kind', value: object.kind },
		{ label: 'Name', value: '(read-only identity)' },
		{ label: 'Position', value: object.position.map(formatMeters).join(' · ') },
		{ label: 'Dimensions', value: object.dimensions.map(formatMeters).join(' · ') }
	];
}

/**
 * The facts a Dimensions instrument offers for editing, in fixed semantic order.
 * A fact is writable only when a production planner owns it; everything else is
 * reported read-only with the reason, never as an inert control.
 */
export type LayoutWritableFact =
	| { readonly id: string; readonly label: string; readonly value: number; readonly unit: 'm' }
	| { readonly id: string; readonly label: string; readonly value: string; readonly unit: 'text' };

export function layoutWritableFacts(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly LayoutWritableFact[] {
	if (subject.kind === 'wall') {
		const wall = document.walls.find((candidate) => candidate.id === subject.id);
		if (wall === undefined) return [];
		return [
			{ id: 'name', label: 'Name', value: wall.name ?? '', unit: 'text' },
			{ id: 'height', label: 'Height', value: wall.height, unit: 'm' },
			{ id: 'thickness', label: 'Thickness', value: wall.thickness, unit: 'm' }
		];
	}
	if (subject.kind === 'opening') {
		const opening = document.openings.find((candidate) => candidate.id === subject.id);
		if (opening === undefined) return [];
		return [
			{ id: 'name', label: 'Name', value: opening.name ?? '', unit: 'text' },
			{ id: 'offset', label: 'Offset', value: opening.offset, unit: 'm' },
			{ id: 'width', label: 'Width', value: opening.width, unit: 'm' },
			{ id: 'height', label: 'Height', value: opening.height, unit: 'm' },
			{ id: 'sillHeight', label: 'Sill', value: opening.sillHeight, unit: 'm' }
		];
	}
	return [];
}

/**
 * Parse exact numeric entry. TD-2: blank, non-finite and malformed input never
 * become zero and never become a `:invalid` state that a later blur can commit.
 */
export type MeasureParse =
	| { readonly ok: true; readonly value: number }
	| { readonly ok: false; readonly code: 'blank' | 'non-finite' | 'malformed'; readonly reason: string };

export function parseMeasureInput(text: string): MeasureParse {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return { ok: false, code: 'blank', reason: 'Enter a value; an empty field is not zero.' };
	}
	const value = Number(trimmed);
	if (!Number.isFinite(value)) {
		if (/^[-+]?(infinity|nan)$/i.test(trimmed) || /^[-+]?\d+(\.\d+)?e[-+]?\d+$/i.test(trimmed)) {
			return { ok: false, code: 'non-finite', reason: 'The value must be finite.' };
		}
		return { ok: false, code: 'malformed', reason: 'Enter a decimal number of meters.' };
	}
	return { ok: true, value };
}

export type PlacementParse =
	| { readonly ok: true; readonly point: LayoutVec2 }
	| { readonly ok: false; readonly code: 'blank' | 'non-finite' | 'malformed'; readonly reason: string };

export function parsePlacementXZ(xText: string, zText: string): PlacementParse {
	const x = parseMeasureInput(xText);
	if (!x.ok) return x;
	const z = parseMeasureInput(zText);
	if (!z.ok) return z;
	return { ok: true, point: [x.value, z.value] };
}

/** Build the F.4 intent for one writable fact, with captured identity and revision. */
export function buildLayoutIntent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly targets: readonly SemanticReference[];
	readonly payload: AuthoringIntent['payload'];
	readonly allocatedIds?: AuthoringIntent['allocatedIds'];
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [...input.targets],
		payload: input.payload,
		capturedInputs: [],
		allocatedIds: [...(input.allocatedIds ?? [])]
	};
}
