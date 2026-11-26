/**
 * The existing-Layout precision operation set.
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
 * | Wall length (fixed endpoint) | `layout-wall-length` | `planExactWallLength` |
 * | Wall angle (fixed endpoint) | `layout-wall-angle` | `planExactWallAngle` |
 * | Rigid Wall translation | `layout-wall-move` | `planRigidWallMove` |
 * | Rigid Room-group translation | `layout-room-move` | `planWallFirstRoomMove` |
 * | Opening offset/width/height/sill | `layout-opening-measure` | `planUpdateWallFirstOpening` |
 * | Wall/Opening/Room name | `layout-entity-name` | `planWallMetadataUpdate` / `planOpeningMetadataUpdate` / `planRoomMetadataUpdate` |
 * | Place → Layout plinth | `layout-plinth-place` | `planCommitLayoutObjectPresetWithId` |
 *
 * Explicitly absent: independent arch rise, an authored Wall role (format 6
 * derives it from Room boundary membership), profile conversion, Floor storey
 * height and Layout-object rename. Those are read-only facts and the Instrument
 * explains them as unavailable rather than exposing a disabled control that
 * looks writable.
 */

import { materializeLayoutSourceForCapture } from '@portfolio/layout-core/kernel';
import { type FixedWallEndpoint, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import {
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	readLayoutWorkingLevel,
	surfaceKey,
	type LayoutIdCapture,
	type LayoutSurfaceLineage,
} from '@portfolio/layout-core/plan';
import { recordPreparedCowCandidate } from '@portfolio/layout-core/world';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PlannerRequest,
	PreparedCandidate,
} from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import {
	applySurfaceLineage,
	newlyRetiredSurfaceReferenceKeys,
	surfaceLineageConsequence,
} from '@portfolio/project-model/scene-planning';
import {
	replaceUnitData,
	canonicalUnitJson,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';

export const LAYOUT_WALL_HEIGHT_KIND = 'layout-wall-height';
export const LAYOUT_WALL_THICKNESS_KIND = 'layout-wall-thickness';
export const LAYOUT_OPENING_MEASURE_KIND = 'layout-opening-measure';
export const LAYOUT_ENTITY_NAME_KIND = 'layout-entity-name';
/** Authored overhead intent: Closed or open to the sky. */
export const LAYOUT_ROOM_OVERHEAD_KIND = 'layout-room-overhead';
/** Remove an open Space record without demolishing its Walls. */
export const LAYOUT_SPACE_REMOVE_KIND = 'layout-space-remove';
export const LAYOUT_PLINTH_PLACE_KIND = 'layout-plinth-place';
/** Exact straight-Wall length, keeping one explicit endpoint fixed. */
export const LAYOUT_WALL_LENGTH_KIND = 'layout-wall-length';
/**
 * Exact straight-Wall angle. The payload carries **radians**, the
 * canonical `atan2(z, x)` unit `planExactWallAngle` solves in; the instrument
 * converts the degrees it displays, so no intent ever carries a display unit.
 */
export const LAYOUT_WALL_ANGLE_KIND = 'layout-wall-angle';
/** Rigid straight-Wall translation: both endpoints move by one delta. */
export const LAYOUT_WALL_MOVE_KIND = 'layout-wall-move';
/**
 * One grab on an open Wall body becomes one bend point and one reshape.
 * The payload carries the physical arc distance the press resolved and the
 * captured id of the bend point the write may insert, so preview and commit
 * address the same identity.
 */
export const LAYOUT_WALL_BEND_KIND = 'layout-wall-bend';
/** The Card's two knot shape actions, through one planner each. */
export const LAYOUT_WALL_KNOT_DELETE_KIND = 'layout-wall-knot-delete';
export const LAYOUT_WALL_STRAIGHTEN_KIND = 'layout-wall-straighten';
/**
 * Review pass 3 — a Room moves rigidly in X/Z. The retained planner moves the
 * Room's connected group (Rooms sharing a Wall travel together) and refuses
 * with the canonical gates' words; Scene objects stay where they are.
 */
export const LAYOUT_ROOM_MOVE_KIND = 'layout-room-move';
/** One shared Junction moves freely in X/Z; every incident Wall follows. */
export const LAYOUT_JUNCTION_MOVE_KIND = 'layout-junction-move';

/** The one opening field each edit owns; the UI never sends a combined patch. */
export type LayoutOpeningField = 'offset' | 'width' | 'height' | 'sillHeight';

export type LayoutSubjectKind = 'wall' | 'opening' | 'object' | 'region';

export type LayoutSubject = {
	readonly kind: LayoutSubjectKind;
	readonly id: string;
};

/** A Room is addressed only by the name planner; it has no field instrument. */
export type LayoutRoomSubject = { readonly kind: 'room'; readonly id: string };

const PAYLOAD_KEYS: Readonly<Record<string, readonly string[]>> = {
	[LAYOUT_WALL_HEIGHT_KIND]: ['wallId', 'height'],
	[LAYOUT_WALL_THICKNESS_KIND]: ['wallId', 'thickness'],
	[LAYOUT_WALL_LENGTH_KIND]: ['wallId', 'length', 'fixed'],
	[LAYOUT_WALL_ANGLE_KIND]: ['wallId', 'angleRadians', 'fixed'],
	[LAYOUT_WALL_MOVE_KIND]: ['wallId', 'deltaX', 'deltaZ'],
	[LAYOUT_WALL_BEND_KIND]: ['wallId', 'distance', 'x', 'z', 'knotId'],
	[LAYOUT_WALL_KNOT_DELETE_KIND]: ['wallId', 'knotId'],
	[LAYOUT_WALL_STRAIGHTEN_KIND]: ['wallId'],
	[LAYOUT_ROOM_MOVE_KIND]: ['roomId', 'deltaX', 'deltaZ'],
	[LAYOUT_JUNCTION_MOVE_KIND]: ['wallId', 'junctionId', 'x', 'z'],
	[LAYOUT_OPENING_MEASURE_KIND]: ['openingId', 'field', 'value'],
	[LAYOUT_ENTITY_NAME_KIND]: ['subjectKind', 'subjectId', 'name'],
	[LAYOUT_ROOM_OVERHEAD_KIND]: ['roomId', 'overhead'],
	[LAYOUT_SPACE_REMOVE_KIND]: ['roomId'],
	[LAYOUT_PLINTH_PLACE_KIND]: ['point', 'floorElevation', 'objectId'],
};

/**
 * A payload with exactly the keys its operation owns. An unknown key is refused
 * rather than ignored: a UI that starts sending `keepBottom` must be told the
 * operation does not support it, not silently have it dropped.
 */
export function readPayload(
	kind: string,
	payload: unknown,
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

export function finitePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function finiteNonNegative(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function opaqueId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

export function isFixedEndpoint(value: unknown): value is FixedWallEndpoint {
	return value === 'start' || value === 'end';
}

export function finiteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function isLayoutOpeningField(value: unknown): value is LayoutOpeningField {
	return value === 'offset' || value === 'width' || value === 'height' || value === 'sillHeight';
}

/** An exact F.1 reference to one Layout subject in the current level. */
export function layoutReference(
	_snapshot: PlannerRequest<ProjectEnvelope>['snapshot'],
	subject: LayoutSubject | LayoutRoomSubject,
	contentRevision: string,
	/** The working level, supplied by the caller as an explicit input. */
	levelId: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: subject.kind, id: subject.id },
		instancePath: [],
		location: {
			kind: 'layout-location',
			levelId,
			structureInstancePath: [],
		},
		componentId: null,
		capabilityId: null,
	};
}

export function rejected(code: string, message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

/**
 * One Layout planner: id, admission and source shape shared by every Layout
 * operation. It binds no compile session; the adapter that registers it runs
 * each `prepare` through its project-epoch compile context
 * (`compile-context.ts`). Called directly (tests), a planner compiles cold, which
 * is equal by the session's construction proof.
 */
export function layoutPlanner(
	kind: string,
	prepare: (request: PlannerRequest<ProjectEnvelope>) => PlannerOutcome<ProjectEnvelope>,
): DomainPlanner<ProjectEnvelope> {
	return {
		id: `layout.${kind}`,
		kind,
		admission: Object.freeze({
			domain: 'layout',
			compound: true,
			writes: ['scene'] as const,
			units: false,
			resources: false,
		}),
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const outcome = prepare(request);
			if (outcome.kind !== 'prepared') return outcome;
			const lineage = layoutSurfaceLineage.get(outcome.candidate);
			if (lineage === undefined) {
				return rejected(
					'surface_lineage_invalid',
					`The ${kind} planner did not provide its required Layout surface lineage.`,
				);
			}
			const accepted = request.snapshot.domain.source;
			const afterLayout = outcome.candidate.source.units.layout.data;
			const applied = applySurfaceLineage({
				beforeScene: accepted.units.scene.data,
				beforeLayout: accepted.units.layout.data,
				afterLayout,
				lineage,
			});
			if (applied.kind === 'rejected') return rejected(applied.code, applied.message);
			const newOrphans = newlyRetiredSurfaceReferenceKeys({
				beforeScene: accepted.units.scene.data,
				beforeLayout: accepted.units.layout.data,
				afterScene: applied.scene,
				afterLayout,
			});
			if (newOrphans.length > 0) {
				return rejected(
					'surface_reference_orphaned',
					`The ${kind} candidate creates retired surface reference "${newOrphans[0]}".`,
				);
			}
			if (canonicalUnitJson(accepted.units.scene.data) === canonicalUnitJson(applied.scene))
				return outcome;
			const beforeByKey = new Map(
				(accepted.units.scene.data.surfaceFinishes ?? []).map((entry) => [
					surfaceKey(entry.surface),
					entry,
				]),
			);
			const afterByKey = new Map(
				(applied.scene.surfaceFinishes ?? []).map((entry) => [surfaceKey(entry.surface), entry]),
			);
			const changedKeys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])]
				.filter(
					(key) =>
						canonicalUnitJson(beforeByKey.get(key) ?? null) !==
						canonicalUnitJson(afterByKey.get(key) ?? null),
				)
				.sort();
			const candidate: PreparedCandidate<ProjectEnvelope> = {
				...outcome.candidate,
				source: replaceUnitData(outcome.candidate.source, 'scene', applied.scene),
				changes: [
					...outcome.candidate.changes,
					{ kind: 'scene-surface-lineage', subjectIds: changedKeys, fields: ['surfaceFinishes'] },
				],
			};
			return { kind: 'prepared', candidate };
		},
	};
}

/** The Join gesture's preview reads the exact Scene transfer used by this planner. */
export function layoutSurfaceLineageConsequence(input: {
	readonly source: ProjectEnvelope;
	readonly beforeLayout: LayoutDocumentWallFirst;
	readonly afterLayout: LayoutDocumentWallFirst;
	readonly lineage: LayoutSurfaceLineage;
}): string {
	const result = applySurfaceLineage({
		beforeScene: input.source.units.scene.data,
		beforeLayout: input.beforeLayout,
		afterLayout: input.afterLayout,
		lineage: input.lineage,
	});
	return result.kind === 'ready' ? surfaceLineageConsequence(result.report) : result.message;
}

/** Planner lineage is runtime metadata and never enters a serialized source. */
const layoutSurfaceLineage = new WeakMap<object, LayoutSurfaceLineage>();

export function registerLayoutSurfaceLineage<T extends PreparedCandidate<ProjectEnvelope>>(
	candidate: T,
	lineage: LayoutSurfaceLineage,
): T {
	layoutSurfaceLineage.set(candidate, lineage);
	return candidate;
}

/**
 * The intent must address exactly the subject its payload edits.
 *
 * Without this check a stale instrument (selection moved, payload not rebuilt)
 * could edit one Wall while its correspondence claims another survived, and the
 * accepted selection would requalify the wrong entry.
 */
export function addressedSubject(
	request: PlannerRequest<ProjectEnvelope>,
	kind: LayoutSubjectKind | 'room',
	id: string,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
	if (request.intent.targets.length !== 1) {
		return { ok: false, message: 'A Layout precision intent addresses exactly one subject.' };
	}
	const target = request.intent.targets[0]!;
	if (target.domain !== 'layout' || target.subject.kind !== kind || target.subject.id !== id) {
		return {
			ok: false,
			message: `The intent must address the ${kind} "${id}" it edits.`,
		};
	}
	return { ok: true };
}

/**
 * The working level is an explicit captured input, never a field
 * read out of the document during planning. A missing or stale level fails closed.
 */
export function capturedWorkingLevel(
	request: PlannerRequest<ProjectEnvelope>,
): { readonly levelId: string } | PlannerOutcome<ProjectEnvelope> {
	const levelId = readLayoutWorkingLevel(request.capturedInputs);
	if (levelId === null) {
		return rejected(
			'invalid-value',
			'The intent must capture its working Layout level before evaluation.',
		);
	}
	if (levelId !== request.snapshot.domain.source.units.layout.data.floor.id) {
		return rejected(
			'stale-level',
			`The captured working level '${levelId}' is not the accepted Layout floor.`,
		);
	}
	return { levelId };
}

/**
 * The shared result construction: one prepared candidate, one change record, one
 * preserve/create correspondence and the prepared-Cow registration the host uses
 * to link the cloned candidate after acceptance.
 */
export function preparedLayoutCandidate(
	request: PlannerRequest<ProjectEnvelope>,
	operationKind: string,
	subject: LayoutSubject | LayoutRoomSubject,
	document: LayoutDocumentWallFirst,
	fields: readonly string[],
	options: {
		readonly surfaceLineage: LayoutSurfaceLineage;
		readonly created?: boolean;
		readonly retired?: boolean;
		readonly id?: string;
	},
): PlannerOutcome<ProjectEnvelope> {
	const level = capturedWorkingLevel(request);
	if ('kind' in level) return level;
	const levelId = level.levelId;
	const reference = layoutReference(
		request.snapshot,
		subject,
		request.snapshot.domain.source.units.layout.header.contentRevision,
		levelId,
	);
	recordPreparedCowCandidate(
		request.intent.operationId,
		document,
		canonicalUnitJson(request.intent),
	);
	materializeLayoutSourceForCapture(document);
	const candidate: PreparedCandidate<ProjectEnvelope> = {
		operationId: request.intent.operationId,
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		source: replaceUnitData(request.snapshot.domain.source, 'layout', document),
		changes: [{ kind: operationKind, subjectIds: [options.id ?? subject.id], fields: [...fields] }],
		correspondence: [
			options.created
				? { relation: 'created', before: null, after: reference }
				: options.retired
					? { relation: 'retired', before: reference, after: null }
					: { relation: 'preserved', before: reference, after: reference },
		],
		diagnostics: [],
	};
	registerLayoutSurfaceLineage(candidate, options.surfaceLineage);
	return { kind: 'prepared', candidate };
}

/** The subject a selection names, or `null` for a non-Layout / read-only selection. */
export function layoutSubjectOf(
	selection: { readonly sourceKind: string; readonly sourceId: string } | null,
): LayoutSubject | null {
	if (selection === null) return null;
	if (selection.sourceKind === 'wall') return { kind: 'wall', id: selection.sourceId };
	if (selection.sourceKind === 'opening') return { kind: 'opening', id: selection.sourceId };
	if (selection.sourceKind === 'object') return { kind: 'object', id: selection.sourceId };
	if (selection.sourceKind === 'region') return { kind: 'region', id: selection.sourceId };
	return null;
}

/**
 * Parse exact numeric entry. TD-2: blank, non-finite and malformed input never
 * become zero and never become a `:invalid` state that a later blur can commit.
 */
export type MeasureParse =
	| { readonly ok: true; readonly value: number }
	| {
			readonly ok: false;
			readonly code: 'blank' | 'non-finite' | 'malformed';
			readonly reason: string;
	  };

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
	| {
			readonly ok: false;
			readonly code: 'blank' | 'non-finite' | 'malformed';
			readonly reason: string;
	  };

export function parsePlacementXZ(xText: string, zText: string): PlacementParse {
	const x = parseMeasureInput(xText);
	if (!x.ok) return x;
	const z = parseMeasureInput(zText);
	if (!z.ok) return z;
	return { ok: true, point: [x.value, z.value] };
}

/**
 * Build the F.4 intent for one writable fact, with captured identity and revision.
 *
 * The working level is always an explicit captured input; an
 * operation that mints Layout identity additionally captures its nonce here, so
 * the planner derives the exact ids this intent recorded. Neither value is read
 * out of the document by planning.
 */
export function buildLayoutIntent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
	readonly targets: readonly SemanticReference[];
	readonly payload: AuthoringIntent['payload'];
	readonly capture?: LayoutIdCapture;
	readonly allocatedIds?: AuthoringIntent['allocatedIds'];
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [...input.targets],
		payload: input.payload,
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			...(input.capture ? [layoutIdCaptureInput(input.capture)] : []),
		],
		allocatedIds: [...(input.allocatedIds ?? [])],
	};
}
