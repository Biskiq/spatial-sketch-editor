/**
 * Strict validation for F.2 `unit-envelope-v1` (AM-2).
 *
 * One reader, three kinds of answer, and the difference between them is the
 * contract rather than a convention:
 *
 * - **issues** (blocking) — structural defects: unknown keys, non-finite
 *   numbers, a header/payload version mismatch, a duplicate or conflicting lock
 *   pin, a duplicate identity inside one unit, an unreadable payload.
 * - **diagnostics** (non-blocking) — a repairable authored binding whose target
 *   is not in this envelope yet. It stays typed and named; it is never rewritten
 *   into a fabricated resolution.
 * - **closure** (blocking for execution only) — an executable requirement the
 *   envelope cannot satisfy, such as a lock entry for a resource the registry
 *   does not carry. Structural failure and executable closure are different
 *   answers.
 *
 * No payload shape is validated twice: the shared Scene records (textures,
 * materials, entities, clusters, navigation connections) go to the landed Scene
 * v1 validator, which is the one parser for that grammar. Scene 2 and Camera 1
 * supply the records it expects and never re-interpret them.
 */

import { dependencyLockKey } from './identity';
import {
	countWork,
	linkClonedCowCandidate,
	p2311Measure,
	validateWallFirstLayoutDocument
} from '@portfolio/layout-core';
import { ShapeReader, type ShapeIssue, type ShapeValidation } from '../strict-shape';
import { validateAcceptedRevision, validateSemanticReference } from '../references/validate';
import { REFERENCE_FAILURE_CODES, isReferenceDomain } from '../references/types';
import { validateProjectSceneCameraPoses } from '../project-layout-semantics';
import { SCENE_WORLD_LOCAL_FORMAT_VERSION } from '../scene';
import { validateSceneDocument } from '../scene-codec';
import {
	ADMITTED_UNIT_VERSIONS,
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_TEXT_KINDS,
	EXPERIENCE_TEXT_MAX_LENGTH,
	EXPERIENCE_TRANSITIONS,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	MODEL_DERIVATIVE_MAX_BYTES,
	MODEL_RESOURCE_MIME,
	MODEL_SOURCE_SET_MAX_BYTES,
	RESOURCE_KINDS,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_DOMAINS,
	UNIT_ENVELOPE_FORMAT_VERSION,
	type CameraFreeSceneDocument,
	type CameraUnitPayload,
	type CameraView,
	type DependencyLock,
	type DependencyLockEntry,
	type DomainUnit,
	type Experience,
	type ExperienceContinuation,
	type ExperienceDetour,
	type ExperienceGate,
	type ExperienceGuide,
	type ExperiencePresentation,
	type ExperiencePresentationText,
	type ExperienceStop,
	type ExperienceTransitionKind,
	type ExperienceUnitPayload,
	type LayoutUnitPayload,
	type ModelResourceDetail,
	type PayloadOf,
	type ProjectEnvelope,
	type ProjectUnits,
	type RequiredCapability,
	type ResourcePin,
	type ResourceUnitPayload,
	type TypedResource,
	type UnitDomain,
	type UnitHeader,
	type UnitPayload,
	type UnresolvedBinding
} from './types';

const ENVELOPE_KEYS = ['formatVersion', 'id', 'name', 'acceptedRevision', 'dependencyLock', 'units'] as const;
const HEADER_KEYS = ['domain', 'unitId', 'formatVersion', 'contentRevision'] as const;
const LOCK_KEYS = ['formatVersion', 'entries'] as const;
const LOCK_ENTRY_KEYS = [
	'domain',
	'subjectKind',
	'subjectId',
	'instancePath',
	'contentRevision',
	'requiredCapabilities',
	'pin'
] as const;
const PIN_KEYS = ['hash', 'mime', 'size', 'locator'] as const;
const CAPABILITY_KEYS = ['id', 'version'] as const;
const BINDING_KEYS = ['reference', 'domain', 'status', 'message'] as const;

/** A repairable authored binding that is not resolved in this envelope. */
export type EnvelopeDiagnostic = { path: string; code: string; message: string };

/** An executable requirement this envelope cannot satisfy. */
export type EnvelopeClosureFinding = { path: string; code: string; message: string };

export type EnvelopeValidation =
	| {
			success: true;
			envelope: ProjectEnvelope;
			diagnostics: readonly EnvelopeDiagnostic[];
			closure: readonly EnvelopeClosureFinding[];
			ignoredOptionalExtensions: readonly string[];
	  }
	| { success: false; issues: readonly ShapeIssue[] };

function failed<T>(reader: ShapeReader): ShapeValidation<T> {
	return { success: false, issues: reader.issues };
}

function delegatedIssues(issues: readonly { path: string; code: string; message: string }[]): ShapeIssue[] {
	return issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message }));
}

/** Strict read of one `UnresolvedBinding`; it always retains its F.1 reference. */
export function validateUnresolvedBinding(input: unknown): ShapeValidation<UnresolvedBinding> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', BINDING_KEYS);
	if (record === null) return failed(reader);
	const reference = validateSemanticReference(record.reference);
	if (!reference.success) {
		for (const issue of reference.issues) {
			reader.problem(`$.reference${issue.path.slice(1)}`, issue.code, issue.message);
		}
	}
	const domain = reader.string(record.domain, '$.domain');
	if (domain !== null && !isReferenceDomain(domain)) {
		reader.problem('$.domain', 'unknown-domain', `$.domain "${domain}" is not an admitted reference domain`);
	}
	const status = reader.tag(record.status, '$.status', REFERENCE_FAILURE_CODES);
	const message = reader.string(record.message, '$.message');
	if (reader.issues.length > 0 || !reference.success || domain === null || status === null || message === null) {
		return failed(reader);
	}
	return {
		success: true,
		value: {
			reference: reference.value,
			domain: domain as UnresolvedBinding['domain'],
			status: status as UnresolvedBinding['status'],
			message
		},
		ignoredOptionalExtensions: reference.ignoredOptionalExtensions
	};
}

function readPin(reader: ShapeReader, input: unknown, path: string): ResourcePin | null {
	const record = reader.object(input, path, PIN_KEYS);
	if (record === null) return null;
	const hash = reader.opaqueId(record.hash, `${path}.hash`);
	const mime = reader.string(record.mime, `${path}.mime`);
	const size = reader.integerAtLeast(record.size, `${path}.size`, 0);
	const locator = reader.string(record.locator, `${path}.locator`);
	if (hash === null || mime === null || size === null || locator === null) return null;
	if (!Number.isSafeInteger(size)) {
		reader.problem(`${path}.size`, 'out-of-range', 'a resource byte size must be an exact safe integer');
		return null;
	}
	return { hash, mime, size, locator };
}

function readCapabilities(reader: ShapeReader, input: unknown, path: string): RequiredCapability[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return null;
	}
	const capabilities: RequiredCapability[] = [];
	const seen = new Set<string>();
	for (const [index, entry] of input.entries()) {
		const entryPath = `${path}[${index}]`;
		const record = reader.object(entry, entryPath, CAPABILITY_KEYS);
		if (record === null) return null;
		const id = reader.opaqueId(record.id, `${entryPath}.id`);
		const version = reader.opaqueId(record.version, `${entryPath}.version`);
		if (id === null || version === null) return null;
		const key = id;
		if (seen.has(key)) {
			reader.problem(`${entryPath}.id`, 'duplicate-capability', `capability ${id} is required more than once by one lock entry`);
		}
		seen.add(key);
		capabilities.push({ id, version });
	}
	return capabilities;
}

/** The qualified identity/instance scope a lock entry is keyed by. */
function lockKey(entry: DependencyLockEntry): string {
	return dependencyLockKey(entry.domain, entry.subjectKind, entry.subjectId, entry.instancePath);
}

/**
 * Strict read of a `DependencyLock`.
 *
 * The lock is a deterministic set keyed by qualified identity/instance scope, so
 * a repeated key is a defect however equal its values look, and two entries that
 * pin the same scope to different content revisions or bytes are a *conflict*
 * reported as such — never silently deduplicated or last-writer-wins.
 */
export function validateDependencyLock(input: unknown): ShapeValidation<DependencyLock> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', LOCK_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== UNIT_ENVELOPE_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${UNIT_ENVELOPE_FORMAT_VERSION}`);
		return failed(reader);
	}
	if (!Array.isArray(record.entries)) {
		reader.problem('$.entries', 'not-an-array', '$.entries must be an array');
		return failed(reader);
	}
	const entries: DependencyLockEntry[] = [];
	const byKey = new Map<string, DependencyLockEntry>();
	for (const [index, entry] of record.entries.entries()) {
		const path = `$.entries[${index}]`;
		const entryRecord = reader.object(entry, path, LOCK_ENTRY_KEYS);
		if (entryRecord === null) return failed(reader);
		const domain = reader.string(entryRecord.domain, `${path}.domain`);
		if (domain !== null && !isReferenceDomain(domain)) {
			reader.problem(`${path}.domain`, 'unknown-domain', `${path}.domain "${domain}" is not an admitted reference domain`);
		}
		const subjectKind = reader.opaqueId(entryRecord.subjectKind, `${path}.subjectKind`);
		const subjectId = reader.opaqueId(entryRecord.subjectId, `${path}.subjectId`);
		const instancePath = reader.opaqueIdArray(entryRecord.instancePath, `${path}.instancePath`);
		const contentRevision = reader.opaqueId(entryRecord.contentRevision, `${path}.contentRevision`);
		const capabilities = readCapabilities(reader, entryRecord.requiredCapabilities, `${path}.requiredCapabilities`);
		const pin = entryRecord.pin === null ? null : readPin(reader, entryRecord.pin, `${path}.pin`);
		if (
			domain === null ||
			subjectKind === null ||
			subjectId === null ||
			instancePath === null ||
			contentRevision === null ||
			capabilities === null ||
			(entryRecord.pin !== null && pin === null)
		) {
			return failed(reader);
		}
		const value: DependencyLockEntry = {
			domain: domain as DependencyLockEntry['domain'],
			subjectKind,
			subjectId,
			instancePath,
			contentRevision,
			requiredCapabilities: capabilities,
			pin
		};
		const key = lockKey(value);
		const previous = byKey.get(key);
		if (previous !== undefined) {
			const same =
				previous.contentRevision === value.contentRevision && samePin(previous.pin, value.pin);
			reader.problem(
				`${path}.subjectId`,
				same ? 'duplicate-lock-entry' : 'conflicting-pins',
				same
					? `the lock already pins "${key}"; the lock is a set, not a list`
					: `the lock pins "${key}" to two different contents (${previous.contentRevision} and ${value.contentRevision})`
			);
			return failed(reader);
		}
		byKey.set(key, value);
		entries.push(value);
	}
	if (reader.issues.length > 0) return failed(reader);
	return { success: true, value: { formatVersion: UNIT_ENVELOPE_FORMAT_VERSION, entries }, ignoredOptionalExtensions: [] };
}

function samePin(left: ResourcePin | null, right: ResourcePin | null): boolean {
	if (left === null || right === null) return left === right;
	return left.hash === right.hash && left.mime === right.mime && left.size === right.size && left.locator === right.locator;
}

/** Strict read of the landed Layout payload (wall-first format 6). */
export function validateLayoutPayload(input: unknown): ShapeValidation<LayoutUnitPayload> {
	const result = validateWallFirstLayoutDocument(input);
	if (!result.success) return { success: false, issues: delegatedIssues(result.issues) };
	if (typeof input === 'object' && input !== null) {
		linkClonedCowCandidate(input as LayoutUnitPayload, result.document);
	}
	return { success: true, value: result.document, ignoredOptionalExtensions: [] };
}

/**
 * Strict read of the Camera-free Scene 2 payload.
 *
 * Scene 2 owns exactly the landed shared records; the navigation graph is not
 * part of it, so `navigationNodes`/`connections` are not allowed keys at all
 * rather than tolerated-but-ignored. The shared record grammar itself is the
 * landed Scene v1 validator's, called with an explicitly empty navigation graph.
 */
export function validateCameraFreeScenePayload(input: unknown): ShapeValidation<CameraFreeSceneDocument> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['formatVersion', 'textures', 'materials', 'entities', 'clusters']);
	if (record === null) return failed(reader);
	if (record.formatVersion !== SCENE_UNIT_FORMAT_VERSION) {
		reader.problem(
			'$.formatVersion',
			'unsupported_format_version',
			`$.formatVersion must be ${SCENE_UNIT_FORMAT_VERSION}; Scene ${SCENE_UNIT_FORMAT_VERSION} is Camera-free and carries no navigation graph`
		);
		return failed(reader);
	}
	if (reader.issues.length > 0) return failed(reader);
	const delegated = validateSceneDocument({
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures: record.textures,
		materials: record.materials,
		entities: record.entities,
		...(record.clusters === undefined ? {} : { clusters: record.clusters }),
		navigationNodes: [],
		connections: []
	});
	if (!delegated.success) return { success: false, issues: delegatedIssues(delegated.issues) };
	const document = delegated.document;
	return {
		success: true,
		value: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: document.textures,
			materials: document.materials,
			entities: document.entities,
			...(document.clusters === undefined ? {} : { clusters: document.clusters })
		},
		ignoredOptionalExtensions: []
	};
}

const CAMERA_VIEW_KEYS = ['id', 'label', 'eye', 'target', 'fov', 'connectedViewIds'] as const;
const CAMERA_PAYLOAD_KEYS = ['formatVersion', 'views', 'connections'] as const;

/**
 * Strict read of the Camera 1 payload.
 *
 * A view is the non-editorial half of a landed navigation node — id, label,
 * eye/target/fov and connectivity — so an order link, a stop hold, a lock or a
 * detour field on a view is an unknown key and is rejected here rather than
 * being silently dropped by the migration. The connections are the landed Scene
 * connection records and are validated by the landed validator, with the views
 * supplied as its navigation nodes, so endpoint and path semantics keep exactly
 * one implementation.
 */
export function validateCameraPayload(input: unknown): ShapeValidation<CameraUnitPayload> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', CAMERA_PAYLOAD_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== CAMERA_UNIT_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${CAMERA_UNIT_FORMAT_VERSION}`);
		return failed(reader);
	}
	if (!Array.isArray(record.views)) {
		reader.problem('$.views', 'not-an-array', '$.views must be an array');
		return failed(reader);
	}
	const views: CameraView[] = [];
	const viewIds = new Set<string>();
	for (const [index, entry] of record.views.entries()) {
		const path = `$.views[${index}]`;
		const viewRecord = reader.object(entry, path, CAMERA_VIEW_KEYS);
		if (viewRecord === null) return failed(reader);
		const id = reader.opaqueId(viewRecord.id, `${path}.id`);
		const label = reader.string(viewRecord.label, `${path}.label`);
		const eye = reader.vector3(viewRecord.eye, `${path}.eye`);
		const target = reader.vector3(viewRecord.target, `${path}.target`);
		const fov = reader.number(viewRecord.fov, `${path}.fov`);
		const connectedViewIds = reader.opaqueIdArray(viewRecord.connectedViewIds, `${path}.connectedViewIds`);
		if (id === null || label === null || eye === null || target === null || fov === null || connectedViewIds === null) {
			return failed(reader);
		}
		if (viewIds.has(id)) reader.problem(`${path}.id`, 'duplicate-identity', `view "${id}" is declared twice`);
		viewIds.add(id);
		views.push({ id, label, eye, target, fov, connectedViewIds });
	}
	if (reader.issues.length > 0) return failed(reader);
	const delegated = validateSceneDocument({
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [],
		navigationNodes: views.map((view) => ({
			id: view.id,
			label: view.label,
			position: [...view.eye] as [number, number, number],
			cameraTarget: [...view.target] as [number, number, number],
			fov: view.fov,
			connectedNodeIds: [...view.connectedViewIds]
		})),
		connections: record.connections
	});
	if (!delegated.success) return { success: false, issues: delegatedIssues(delegated.issues) };
	const poseIssues = validateProjectSceneCameraPoses(delegated.document);
	if (poseIssues.length > 0) return { success: false, issues: poseIssues.map((issue) => ({ ...issue, path: issue.path.replace('$.scene.', '$.') })) };
	const resolved: CameraView[] = delegated.document.navigationNodes.map((node) => ({
		id: node.id,
		label: node.label,
		eye: [...node.position] as [number, number, number],
		target: [...node.cameraTarget] as [number, number, number],
		fov: node.fov,
		connectedViewIds: [...node.connectedNodeIds]
	}));
	return {
		success: true,
		value: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: resolved, connections: delegated.document.connections },
		ignoredOptionalExtensions: []
	};
}

const EXPERIENCE_KEYS = [
	'id',
	'label',
	'entryGuideId',
	'presentations',
	'stops',
	'guides',
	'gates',
	'detours'
] as const;
const GATE_KEYS = ['id', 'presentationId'] as const;
const PRESENTATION_KEYS = ['id', 'label', 'viewIds', 'defaultViewId', 'subject', 'text'] as const;
const PRESENTATION_TEXT_KEYS = ['kind', 'body'] as const;
const STOP_KEYS = ['id', 'presentationId', 'entryViewId', 'holdSeconds', 'continuation'] as const;
const GUIDE_KEYS = ['id', 'label', 'stopIds', 'entryStopId'] as const;
const DETOUR_KEYS = ['id', 'fromStopId', 'toStopId', 'returnToStopId'] as const;
const EXPERIENCE_PAYLOAD_KEYS = ['formatVersion', 'experiences'] as const;

/** An edge's authored Cut/Travel selector; absent means Cut. */
function readTransition(reader: ShapeReader, input: unknown, path: string): ExperienceTransitionKind | null {
	if (input === undefined) return 'cut';
	const transition = reader.tag(input, path, EXPERIENCE_TRANSITIONS);
	return transition as ExperienceTransitionKind | null;
}

function readContinuation(reader: ShapeReader, input: unknown, path: string): ExperienceContinuation | null {
	if (input === undefined) return { kind: 'sequence-next', transition: 'cut' };
	const record = reader.object(input, path, ['kind', 'stopId', 'transition']);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['sequence-next', 'stop', 'end']);
	if (kind === null) return null;
	if (kind !== 'stop') {
		if (record.stopId !== undefined) reader.problem(`${path}.stopId`, 'unknown-key', `${path}.stopId is not part of the ${kind} continuation`);
		if (kind === 'end') {
			if (record.transition !== undefined) {
				reader.problem(`${path}.transition`, 'unknown-key', `${path}.transition is not part of the end continuation`);
				return null;
			}
			return { kind: 'end' };
		}
		const transition = readTransition(reader, record.transition, `${path}.transition`);
		if (transition === null) return null;
		return { kind: 'sequence-next', transition };
	}
	const stopId = reader.opaqueId(record.stopId, `${path}.stopId`);
	const transition = readTransition(reader, record.transition, `${path}.transition`);
	if (stopId === null || transition === null) return null;
	return { kind: 'stop', stopId, transition };
}

/** One Presentation's bounded plain text; `null` input is the explicit no-text state. */
function readPresentationText(
	reader: ShapeReader,
	input: unknown,
	path: string
): ExperiencePresentationText | null {
	const record = reader.object(input, path, PRESENTATION_TEXT_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, EXPERIENCE_TEXT_KINDS);
	const body = reader.string(record.body, `${path}.body`);
	if (kind === null || body === null) return null;
	const length = [...body].length;
	if (length > EXPERIENCE_TEXT_MAX_LENGTH) {
		reader.problem(
			`${path}.body`,
			'text-too-long',
			`${path}.body carries ${length} code points; Presentation text is bounded at ${EXPERIENCE_TEXT_MAX_LENGTH}`
		);
		return null;
	}
	return { kind: 'plain', body };
}

function readExperience(reader: ShapeReader, input: unknown, path: string): Experience | null {
	const record = reader.object(input, path, EXPERIENCE_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const label = reader.string(record.label, `${path}.label`);
	const entryGuideId =
		record.entryGuideId === null ? null : reader.opaqueId(record.entryGuideId, `${path}.entryGuideId`);

	const presentations = readCollection(reader, record.presentations, `${path}.presentations`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, PRESENTATION_KEYS);
		if (value === null) return null;
		const presentationId = reader.opaqueId(value.id, `${entryPath}.id`);
		const presentationLabel = reader.string(value.label, `${entryPath}.label`);
		const viewIds = reader.opaqueIdArray(value.viewIds, `${entryPath}.viewIds`);
		const defaultViewId =
			value.defaultViewId === null
				? null
				: reader.opaqueId(value.defaultViewId, `${entryPath}.defaultViewId`);
		const text = value.text === null ? null : readPresentationText(reader, value.text, `${entryPath}.text`);
		let subject: ExperiencePresentation['subject'] = null;
		if (value.subject !== null) {
			const read = validateSemanticReference(value.subject);
			if (!read.success) {
				for (const issue of read.issues) {
					reader.problem(`${entryPath}.subject${issue.path.slice(1)}`, issue.code, issue.message);
				}
				return null;
			}
			if (read.value.componentId !== null) {
				reader.problem(
					`${entryPath}.subject.componentId`,
					'component-not-admitted',
					'a Presentation subject names a whole subject; a component-scoped reference is not admitted'
				);
				return null;
			}
			if (read.value.capabilityId !== null) {
				reader.problem(
					`${entryPath}.subject.capabilityId`,
					'component-not-admitted',
					'a Presentation subject names a whole subject; a capability-scoped reference is not admitted'
				);
				return null;
			}
			if (read.value.domain !== 'scene' && read.value.domain !== 'layout') {
				reader.problem(
					`${entryPath}.subject.domain`,
					'unsupported-subject-domain',
					`a Presentation subject resolves to a Scene entity or a Layout element; "${read.value.domain}" is neither`
				);
				return null;
			}
			subject = read.value;
		}
		if (
			presentationId === null ||
			presentationLabel === null ||
			viewIds === null ||
			(value.defaultViewId !== null && defaultViewId === null) ||
			(value.text !== null && text === null)
		) {
			return null;
		}
		if (new Set(viewIds).size !== viewIds.length) {
			reader.problem(`${entryPath}.viewIds`, 'duplicate-identity', `${entryPath}.viewIds names a View twice`);
			return null;
		}
		if (defaultViewId !== null && !viewIds.includes(defaultViewId)) {
			reader.problem(
				`${entryPath}.defaultViewId`,
				'default-not-in-views',
				`${entryPath}.defaultViewId "${defaultViewId}" is not one of this Presentation's views`
			);
			return null;
		}
		return {
			id: presentationId,
			label: presentationLabel,
			viewIds,
			defaultViewId,
			subject,
			text
		} satisfies ExperiencePresentation;
	});

	const stops = readCollection(reader, record.stops, `${path}.stops`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, STOP_KEYS);
		if (value === null) return null;
		const stopId = reader.opaqueId(value.id, `${entryPath}.id`);
		const presentationId = reader.opaqueId(value.presentationId, `${entryPath}.presentationId`);
		const entryViewId =
			value.entryViewId === undefined
				? undefined
				: reader.opaqueId(value.entryViewId, `${entryPath}.entryViewId`);
		const hold = value.holdSeconds === undefined ? undefined : reader.numberAtLeast(value.holdSeconds, `${entryPath}.holdSeconds`, 0, false);
		const continuation = readContinuation(reader, value.continuation, `${entryPath}.continuation`);
		if (stopId === null || presentationId === null || continuation === null) return null;
		if (value.holdSeconds !== undefined && hold === null) return null;
		if (value.entryViewId !== undefined && entryViewId === null) return null;
		return {
			id: stopId,
			presentationId,
			...(entryViewId === null || entryViewId === undefined ? {} : { entryViewId }),
			...(hold === null || hold === undefined ? {} : { holdSeconds: hold }),
			continuation
		} satisfies ExperienceStop;
	});

	const guides = readCollection(reader, record.guides, `${path}.guides`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, GUIDE_KEYS);
		if (value === null) return null;
		const guideId = reader.opaqueId(value.id, `${entryPath}.id`);
		const guideLabel = reader.string(value.label, `${entryPath}.label`);
		const stopIds = reader.opaqueIdArray(value.stopIds, `${entryPath}.stopIds`);
		const entryStopId = reader.opaqueId(value.entryStopId, `${entryPath}.entryStopId`);
		if (guideId === null || guideLabel === null || stopIds === null || entryStopId === null) return null;
		if (new Set(stopIds).size !== stopIds.length) {
			reader.problem(`${entryPath}.stopIds`, 'duplicate-identity', 'repeated guided placements require distinct Stop identities');
			return null;
		}
		if (!stopIds.includes(entryStopId)) {
			reader.problem(
				`${entryPath}.entryStopId`,
				'entry-not-in-guide',
				`${entryPath}.entryStopId "${entryStopId}" is not one of the guide's ordered stops`
			);
			return null;
		}
		return { id: guideId, label: guideLabel, stopIds, entryStopId } satisfies ExperienceGuide;
	});

	const gates = readCollection(reader, record.gates, `${path}.gates`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, GATE_KEYS);
		if (value === null) return null;
		const gateId = reader.opaqueId(value.id, `${entryPath}.id`);
		const presentationId = reader.opaqueId(value.presentationId, `${entryPath}.presentationId`);
		if (gateId === null || presentationId === null) return null;
		return { id: gateId, presentationId } satisfies ExperienceGate;
	});

	const detours = readCollection(reader, record.detours, `${path}.detours`, (entry, entryPath) => {
		const value = reader.object(entry, entryPath, DETOUR_KEYS);
		if (value === null) return null;
		const detourId = reader.opaqueId(value.id, `${entryPath}.id`);
		const fromStopId = reader.opaqueId(value.fromStopId, `${entryPath}.fromStopId`);
		const toStopId = reader.opaqueId(value.toStopId, `${entryPath}.toStopId`);
		const returnToStopId = reader.opaqueId(value.returnToStopId, `${entryPath}.returnToStopId`);
		if (detourId === null || fromStopId === null || toStopId === null || returnToStopId === null) return null;
		return { id: detourId, fromStopId, toStopId, returnToStopId } satisfies ExperienceDetour;
	});

	// `entryGuideId` is deliberately absent from this gate: `null` is the legal
	// "this Experience enters nothing" value of a Guide-free Experience. A
	// malformed value is already reported by the reader and fails below.
	if (
		id === null ||
		label === null ||
		presentations === null ||
		stops === null ||
		guides === null ||
		gates === null ||
		detours === null
	) {
		return null;
	}
	// A Stop's entry View is one of its Presentation's views. It is checked after
	// both collections are read, so a Stop is never rejected for a Presentation
	// the same reader is about to report as invalid.
	if (presentations !== null && stops !== null) {
		const viewsByPresentation = new Map(presentations.map((entry) => [entry.id, new Set(entry.viewIds)]));
		for (const [position, stop] of stops.entries()) {
			if (stop.entryViewId === undefined) continue;
			const views = viewsByPresentation.get(stop.presentationId);
			if (views !== undefined && !views.has(stop.entryViewId)) {
				reader.problem(
					`${path}.stops[${position}].entryViewId`,
					'entry-view-not-in-presentation',
					`Stop "${stop.id}" enters at View "${stop.entryViewId}", which its Presentation does not carry`
				);
				return null;
			}
		}
	}

	const duplicate = firstDuplicate([
		presentations.map((item) => item.id),
		stops.map((item) => item.id),
		guides.map((item) => item.id),
		gates.map((item) => item.id),
		detours.map((item) => item.id)
	]);
	if (duplicate !== null) {
		reader.problem(path, 'duplicate-identity', `${path} declares "${duplicate}" twice`);
		return null;
	}
	if (guides.length === 0) {
		// An Experience with no Guide is legal — a free-only source produces
		// Presentations and no order — but then it enters nothing, explicitly.
		if (entryGuideId !== null) {
			reader.problem(`${path}.entryGuideId`, 'missing-entry-guide', `${path}.entryGuideId must be null when the Experience carries no guide`);
			return null;
		}
	} else if (entryGuideId === null || !guides.some((guide) => guide.id === entryGuideId)) {
		reader.problem(`${path}.entryGuideId`, 'missing-entry-guide', `${path}.entryGuideId "${entryGuideId ?? 'null'}" names no guide`);
		return null;
	}
	return { id, label, entryGuideId, presentations, stops, guides, gates, detours };
}

function firstDuplicate(groups: readonly (readonly string[])[]): string | null {
	const seen = new Set<string>();
	for (const group of groups) {
		for (const id of group) {
			if (seen.has(id)) return id;
			seen.add(id);
		}
	}
	return null;
}

function readCollection<T>(
	reader: ShapeReader,
	input: unknown,
	path: string,
	read: (entry: unknown, entryPath: string) => T | null
): T[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return null;
	}
	const values: T[] = [];
	for (const [index, entry] of input.entries()) {
		const value = read(entry, `${path}[${index}]`);
		if (value === null) return null;
		values.push(value);
	}
	return values;
}

/**
 * Strict read of the Experience 2 payload. The payload is a collection because
 * several Experiences share one world; an empty collection is explicit. Stop,
 * Presentation and Guide identity are independent: repeated visits create fresh
 * runs of a Stop, and repeated guided placements use distinct Stop IDs.
 *
 * Format 2 is a pre-baseline cutover, not a migration: a format-1 payload is
 * refused as an unsupported version, never negotiated or upgraded in place.
 */
export function validateExperiencePayload(input: unknown): ShapeValidation<ExperienceUnitPayload> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', EXPERIENCE_PAYLOAD_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== EXPERIENCE_UNIT_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${EXPERIENCE_UNIT_FORMAT_VERSION}`);
		return failed(reader);
	}
	if (!Array.isArray(record.experiences)) {
		reader.problem('$.experiences', 'not-an-array', '$.experiences must be an array');
		return failed(reader);
	}
	const experiences: Experience[] = [];
	const ids = new Set<string>();
	for (const [index, entry] of record.experiences.entries()) {
		const path = `$.experiences[${index}]`;
		const experience = readExperience(reader, entry, path);
		if (experience === null) return failed(reader);
		if (ids.has(experience.id)) reader.problem(`${path}.id`, 'duplicate-identity', `experience "${experience.id}" is declared twice`);
		ids.add(experience.id);
		experiences.push(experience);
	}
	if (reader.issues.length > 0) return failed(reader);
	return {
		success: true,
		value: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences },
		ignoredOptionalExtensions: []
	};
}

const RESOURCE_KEYS = ['kind', 'id', 'contentRevision', 'pin', 'unresolved', 'model'] as const;
const RESOURCE_PAYLOAD_KEYS = ['formatVersion', 'resources'] as const;
const MODEL_KEYS = ['source', 'recipe', 'reportDigest', 'placement'] as const;
const MODEL_SOURCE_KEYS = ['manifestHash', 'size', 'fileCount'] as const;
const MODEL_RECIPE_KEYS = ['id', 'version'] as const;
const MODEL_PLACEMENT_KEYS = [
	'metresPerSourceUnit',
	'pivot',
	'footprint',
	'contactMinY',
	'placement'
] as const;
const MODEL_FOOTPRINT_KEYS = ['width', 'depth'] as const;
const SHA256_PATTERN = /^sha256-[0-9a-f]{64}$/;

/**
 * Strict read of the typed-resource payload (format 2).
 *
 * A resource is either resolved — an exact content revision, and for external
 * bytes a real pin — or it carries the typed diagnostic that says what is
 * missing. A resource with neither is rejected: admission never fabricates a pin,
 * and an empty registry is valid only when nothing requires a resource (which the
 * envelope reader checks against the lock).
 *
 * A `model` resource is the creator-import kind: its derivative bytes are its
 * `pin` (content revision is that pin's hash), and the retained source pin, the
 * recipe, the report digest and the placement definition are required. It is
 * always an approved, immutable revision, so an unresolved model is a
defect rather than a repairable binding.
 */
export function validateResourcePayload(input: unknown): ShapeValidation<ResourceUnitPayload> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', RESOURCE_PAYLOAD_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== RESOURCE_UNIT_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${RESOURCE_UNIT_FORMAT_VERSION}`);
		return failed(reader);
	}
	if (!Array.isArray(record.resources)) {
		reader.problem('$.resources', 'not-an-array', '$.resources must be an array');
		return failed(reader);
	}
	const resources: TypedResource[] = [];
	const ids = new Set<string>();
	for (const [index, entry] of record.resources.entries()) {
		const path = `$.resources[${index}]`;
		const value = reader.object(entry, path, RESOURCE_KEYS);
		if (value === null) return failed(reader);
		const kind = reader.tag(value.kind, `${path}.kind`, RESOURCE_KINDS);
		const id = reader.opaqueId(value.id, `${path}.id`);
		const contentRevision = value.contentRevision === null ? null : reader.opaqueId(value.contentRevision, `${path}.contentRevision`);
		const pin = value.pin === null ? null : readPin(reader, value.pin, `${path}.pin`);
		let unresolved: UnresolvedBinding | null = null;
		if (value.unresolved !== null) {
			const binding = validateUnresolvedBinding(value.unresolved);
			if (!binding.success) {
				for (const issue of binding.issues) reader.problem(`${path}.unresolved${issue.path.slice(1)}`, issue.code, issue.message);
				return failed(reader);
			}
			unresolved = binding.value;
		}
		if (value.model === null) {
			reader.problem(`${path}.model`, 'invalid-type', `${path}.model must be a model detail object when present, not null`);
			return failed(reader);
		}
		const model = value.model === undefined ? undefined : readModelDetail(reader, value.model, `${path}.model`);
		if (kind === null || id === null || (value.pin !== null && pin === null)) return failed(reader);
		if (value.model !== undefined && model === undefined) return failed(reader);
		if (contentRevision === null && pin === null && unresolved === null) {
			reader.problem(path, 'unresolved-resource-without-diagnostic', `${path} is neither pinned nor revised and carries no diagnostic`);
			return failed(reader);
		}
		if (kind === 'model') {
			if (model === undefined) {
				reader.problem(`${path}.model`, 'missing-model-detail', `${path} is a model resource and must carry its retained source, recipe, report digest and placement`);
				return failed(reader);
			}
			if (pin === null || unresolved !== null) {
				reader.problem(`${path}.pin`, 'unapproved-model-resource', `${path} is a model resource and must be an approved revision with a derivative pin`);
				return failed(reader);
			}
			if (pin.mime !== MODEL_RESOURCE_MIME) {
				reader.problem(`${path}.pin.mime`, 'unsupported-media-type', `${path}.pin.mime must be ${MODEL_RESOURCE_MIME}`);
				return failed(reader);
			}
			if (pin.size > MODEL_DERIVATIVE_MAX_BYTES) {
				reader.problem(`${path}.pin.size`, 'out-of-range', `${path}.pin.size must not exceed ${MODEL_DERIVATIVE_MAX_BYTES} bytes`);
				return failed(reader);
			}
			if (contentRevision === null || contentRevision !== pin.hash) {
				reader.problem(`${path}.contentRevision`, 'content-revision-mismatch', `${path}.contentRevision must be the derivative pin's own hash`);
				return failed(reader);
			}
		} else if (model !== undefined) {
			reader.problem(`${path}.model`, 'unknown-key', `${path}.model is only part of a model resource`);
			return failed(reader);
		}
		const key = `${kind}:${id}`;
		if (ids.has(key)) reader.problem(`${path}.id`, 'duplicate-identity', `resource "${key}" is declared twice`);
		ids.add(key);
		resources.push({
			kind: kind as TypedResource['kind'],
			id,
			contentRevision,
			pin,
			unresolved,
			...(model === undefined ? {} : { model })
		});
	}
	if (reader.issues.length > 0) return failed(reader);
	return {
		success: true,
		value: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources },
		ignoredOptionalExtensions: []
	};
}

/** Strict read of the retained model provenance and placement definition. */
function readModelDetail(reader: ShapeReader, input: unknown, path: string): ModelResourceDetail | undefined {
	const record = reader.object(input, path, MODEL_KEYS);
	if (record === null) return undefined;

	const sourceRecord = reader.object(record.source, `${path}.source`, MODEL_SOURCE_KEYS);
	if (sourceRecord === null) return undefined;
	const manifestHash = readModelHash(reader, sourceRecord.manifestHash, `${path}.source.manifestHash`);
	const size = reader.integerAtLeast(sourceRecord.size, `${path}.source.size`, 1);
	const fileCount = reader.integerAtLeast(sourceRecord.fileCount, `${path}.source.fileCount`, 1);
	if (size !== null && size > MODEL_SOURCE_SET_MAX_BYTES) {
		reader.problem(`${path}.source.size`, 'out-of-range', `${path}.source.size must not exceed ${MODEL_SOURCE_SET_MAX_BYTES} bytes`);
		return undefined;
	}

	const recipeRecord = reader.object(record.recipe, `${path}.recipe`, MODEL_RECIPE_KEYS);
	if (recipeRecord === null) return undefined;
	const recipeId = reader.string(recipeRecord.id, `${path}.recipe.id`);
	const recipeVersion = reader.integerAtLeast(recipeRecord.version, `${path}.recipe.version`, 1);
	const reportDigest = readModelHash(reader, record.reportDigest, `${path}.reportDigest`);

	const placementRecord = reader.object(record.placement, `${path}.placement`, MODEL_PLACEMENT_KEYS);
	if (placementRecord === null) return undefined;
	const metresPerSourceUnit = reader.number(placementRecord.metresPerSourceUnit, `${path}.placement.metresPerSourceUnit`);
	if (metresPerSourceUnit !== null && metresPerSourceUnit <= 0) {
		reader.problem(`${path}.placement.metresPerSourceUnit`, 'out-of-range', `${path}.placement.metresPerSourceUnit must be greater than zero`);
		return undefined;
	}
	const pivot = reader.vector3(placementRecord.pivot, `${path}.placement.pivot`);
	const footprintRecord = reader.object(placementRecord.footprint, `${path}.placement.footprint`, MODEL_FOOTPRINT_KEYS);
	if (footprintRecord === null) return undefined;
	const width = reader.number(footprintRecord.width, `${path}.placement.footprint.width`);
	const depth = reader.number(footprintRecord.depth, `${path}.placement.footprint.depth`);
	if ((width !== null && width <= 0) || (depth !== null && depth <= 0)) {
		reader.problem(`${path}.placement.footprint`, 'out-of-range', `${path}.placement.footprint width and depth must be greater than zero`);
		return undefined;
	}
	const contactMinY = reader.number(placementRecord.contactMinY, `${path}.placement.contactMinY`);
	const placement = reader.tag(placementRecord.placement, `${path}.placement.placement`, ['floor'] as const);
	if (
		manifestHash === null ||
		size === null ||
		fileCount === null ||
		recipeId === null ||
		recipeVersion === null ||
		reportDigest === null ||
		metresPerSourceUnit === null ||
		pivot === null ||
		width === null ||
		depth === null ||
		contactMinY === null ||
		placement === null
	) {
		return undefined;
	}
	return {
		source: { manifestHash, size, fileCount },
		recipe: { id: recipeId, version: recipeVersion },
		reportDigest,
		placement: {
			metresPerSourceUnit,
			pivot,
			footprint: { width, depth },
			contactMinY,
			placement: placement as 'floor'
		}
	};
}

function readModelHash(reader: ShapeReader, value: unknown, path: string): string | null {
	if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
		reader.problem(path, 'invalid-identity', `${path} must be a sha256 digest`);
		return null;
	}
	return value;
}

type PayloadReader = (input: unknown) => ShapeValidation<UnitPayload>;

const DEEPLY_FROZEN_PLAIN_JSON = new WeakSet<object>();

/**
 * Returns true if and only if `value` is deeply frozen plain JSON (plain Object
 * or Array with no getters/setters/symbols/prototype modifications).
 * Verified objects are remembered in `DEEPLY_FROZEN_PLAIN_JSON` for O(1) checks.
 */
export function isDeeplyFrozenPlainJson(value: unknown): value is object {
	if (typeof value !== 'object' || value === null) return false;
	if (DEEPLY_FROZEN_PLAIN_JSON.has(value)) return true;
	if (!Object.isFrozen(value)) return false;

	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
		return false;
	}

	const descriptors = Object.getOwnPropertyDescriptors(value);
	for (const key of Object.keys(descriptors)) {
		const desc = descriptors[key]!;
		if (desc.get !== undefined || desc.set !== undefined) return false;
		const val = desc.value;
		if (typeof val === 'object' && val !== null) {
			if (!isDeeplyFrozenPlainJson(val)) return false;
		}
	}

	DEEPLY_FROZEN_PLAIN_JSON.add(value);
	return true;
}

/**
 * Recursively freezes plain JSON object trees and marks each in `DEEPLY_FROZEN_PLAIN_JSON`.
 */
export function freezePlainJsonSubgraph<T>(value: T): T {
	if (typeof value !== 'object' || value === null) return value;
	if (DEEPLY_FROZEN_PLAIN_JSON.has(value as object)) return value;
	const obj = value as Record<string, unknown>;
	for (const key of Object.keys(obj)) {
		const child = obj[key];
		if (typeof child === 'object' && child !== null) {
			freezePlainJsonSubgraph(child);
		}
	}
	if (!Object.isFrozen(obj)) {
		Object.freeze(obj);
	}
	DEEPLY_FROZEN_PLAIN_JSON.add(obj);
	return value;
}

const VALIDATED_PAYLOAD_CACHE: {
	[D in UnitDomain]: WeakMap<object, ShapeValidation<UnitPayload>>;
} = {
	layout: new WeakMap(),
	scene: new WeakMap(),
	camera: new WeakMap(),
	experience: new WeakMap(),
	resources: new WeakMap()
};

const PAYLOAD_READERS: Readonly<Record<UnitDomain, PayloadReader>> = {
	layout: validateLayoutPayload as PayloadReader,
	scene: validateCameraFreeScenePayload as PayloadReader,
	camera: validateCameraPayload as PayloadReader,
	experience: validateExperiencePayload as PayloadReader,
	resources: validateResourcePayload as PayloadReader
};

/**
 * Read any admitted unit payload. The payload declares its own version, and that
 * version must be the domain's admitted one: a payload that claims another
 * version is a version negotiation failure, not a variant to interpret.
 */
export function validateUnitPayload(domain: UnitDomain, input: unknown): ShapeValidation<UnitPayload> {
	if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
		const cached = VALIDATED_PAYLOAD_CACHE[domain].get(input);
		if (cached !== undefined) {
			return cached;
		}
		const result = PAYLOAD_READERS[domain](input);
		if (result.success) {
			freezePlainJsonSubgraph(result.value);
			if (domain === 'layout') {
				linkClonedCowCandidate(
					input as unknown as Parameters<typeof linkClonedCowCandidate>[0],
					result.value as unknown as Parameters<typeof linkClonedCowCandidate>[1]
				);
			}
			VALIDATED_PAYLOAD_CACHE[domain].set(input, result);
			VALIDATED_PAYLOAD_CACHE[domain].set(result.value as object, result);
		}
		return result;
	}
	return PAYLOAD_READERS[domain](input);
}

function readUnitHeader(
	reader: ShapeReader,
	input: unknown,
	path: string,
	domain: UnitDomain
): UnitHeader | null {
	const record = reader.object(input, path, HEADER_KEYS);
	if (record === null) return null;
	const declaredDomain = reader.tag(record.domain, `${path}.domain`, UNIT_DOMAINS);
	if (declaredDomain !== null && declaredDomain !== domain) {
		reader.problem(`${path}.domain`, 'unit-domain-mismatch', `${path}.domain is "${declaredDomain}" and the unit is filed under "${domain}"`);
		return null;
	}
	const unitId = reader.opaqueId(record.unitId, `${path}.unitId`);
	if (record.formatVersion !== ADMITTED_UNIT_VERSIONS[domain]) {
		reader.problem(
			`${path}.formatVersion`,
			'unsupported_format_version',
			`${path}.formatVersion must be ${ADMITTED_UNIT_VERSIONS[domain]} for the ${domain} unit`
		);
		return null;
	}
	const contentRevision = reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
	if (declaredDomain === null || unitId === null || contentRevision === null) return null;
	return { domain: declaredDomain as UnitDomain, unitId, formatVersion: ADMITTED_UNIT_VERSIONS[domain], contentRevision };
}

function readDomainUnit<D extends UnitDomain>(
	reader: ShapeReader,
	input: unknown,
	path: string,
	domain: D
): DomainUnit<PayloadOf<D>> | null {
	const record = reader.object(input, path, ['header', 'data']);
	if (record === null) return null;
	const header = readUnitHeader(reader, record.header, `${path}.header`, domain);
	const payload = validateUnitPayload(domain, record.data);
	if (!payload.success) {
		for (const issue of payload.issues) {
			reader.problem(`${path}.data${issue.path.slice(1)}`, issue.code, issue.message);
		}
		return null;
	}
	if (header === null) return null;
	if (payload.value.formatVersion !== header.formatVersion) {
		reader.problem(
			`${path}.data.formatVersion`,
			'unit-version-mismatch',
			`${path}.data.formatVersion ${payload.value.formatVersion} does not match the header's ${header.formatVersion}`
		);
		return null;
	}
	// One cast, contained here: `validateUnitPayload` returns the union and the
	// domain is the key that selects the member.
	return { header, data: payload.value as PayloadOf<D> };
}

/**
 * Read one complete envelope.
 *
 * The blocking rules are structural. `diagnostics` names bindings that are
 * authored but not resolved yet, and `closure` names executable requirements the
 * envelope cannot satisfy — most importantly a lock entry whose resource the
 * registry does not carry, which makes publication refuse while admission stays
 * possible.
 */
const VALIDATED_ENVELOPE_CACHE = new WeakMap<object, EnvelopeValidation>();

export function validateProjectEnvelope(input: unknown): EnvelopeValidation {
	countWork('envelope:validate');
	if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
		const cached = VALIDATED_ENVELOPE_CACHE.get(input);
		if (cached !== undefined) return cached;
	}
	return p2311Measure('envelope-validate', () => {
		const result = validateProjectEnvelopeOnce(input);
		if (result.success) {
			freezePlainJsonSubgraph(result.envelope);
			if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
				VALIDATED_ENVELOPE_CACHE.set(input, result);
			}
			VALIDATED_ENVELOPE_CACHE.set(result.envelope, result);
		}
		return result;
	});
}

function validateProjectEnvelopeOnce(input: unknown): EnvelopeValidation {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ENVELOPE_KEYS);
	if (record === null) return { success: false, issues: reader.issues };
	if (record.formatVersion !== UNIT_ENVELOPE_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${UNIT_ENVELOPE_FORMAT_VERSION}`);
		return { success: false, issues: reader.issues };
	}
	const id = reader.opaqueId(record.id, '$.id');
	const name = reader.string(record.name, '$.name');
	const acceptedRevision = validateAcceptedRevision(record.acceptedRevision);
	if (!acceptedRevision.success) {
		for (const issue of acceptedRevision.issues) reader.problem(`$.acceptedRevision${issue.path.slice(1)}`, issue.code, issue.message);
	}
	const lock = validateDependencyLock(record.dependencyLock);
	if (!lock.success) {
		for (const issue of lock.issues) reader.problem(`$.dependencyLock${issue.path.slice(1)}`, issue.code, issue.message);
	}
	const unitsRecord = reader.object(record.units, '$.units', UNIT_DOMAINS);
	if (unitsRecord === null) return { success: false, issues: reader.issues };
	const layout = readDomainUnit(reader, unitsRecord.layout, '$.units.layout', 'layout');
	const scene = readDomainUnit(reader, unitsRecord.scene, '$.units.scene', 'scene');
	const camera = readDomainUnit(reader, unitsRecord.camera, '$.units.camera', 'camera');
	const experience = readDomainUnit(reader, unitsRecord.experience, '$.units.experience', 'experience');
	const resources = readDomainUnit(reader, unitsRecord.resources, '$.units.resources', 'resources');
	if (
		reader.issues.length > 0 ||
		id === null ||
		name === null ||
		!acceptedRevision.success ||
		!lock.success ||
		layout === null ||
		scene === null ||
		camera === null ||
		experience === null ||
		resources === null
	) {
		return { success: false, issues: reader.issues };
	}
	if (acceptedRevision.value.projectId !== id) {
		reader.problem('$.acceptedRevision.projectId', 'project-mismatch', 'the accepted revision must belong to this envelope');
		return { success: false, issues: reader.issues };
	}
	const units: ProjectUnits = { layout, scene, camera, experience, resources };
	const found = envelopeFindings(units, lock.value);
	return {
		success: true,
		envelope: {
			formatVersion: UNIT_ENVELOPE_FORMAT_VERSION,
			id,
			name,
			acceptedRevision: acceptedRevision.value,
			dependencyLock: lock.value,
			units
		},
		diagnostics: found.diagnostics,
		closure: found.closure,
		ignoredOptionalExtensions: acceptedRevision.ignoredOptionalExtensions
	};
}

function envelopeFindings(
	units: ProjectUnits,
	lock: DependencyLock
): { diagnostics: EnvelopeDiagnostic[]; closure: EnvelopeClosureFinding[] } {
	const diagnostics: EnvelopeDiagnostic[] = [];
	const closure: EnvelopeClosureFinding[] = [];
	const views = new Set(units.camera.data.views.map((view) => view.id));
	const connectionPairs = new Set<string>();
	for (const connection of units.camera.data.connections) {
		connectionPairs.add(`${connection.fromNodeId}\0${connection.toNodeId}`);
		connectionPairs.add(`${connection.toNodeId}\0${connection.fromNodeId}`);
	}
	const supportedTravel = (fromViewId: string | null, toViewId: string | null): boolean =>
		fromViewId !== null &&
		toViewId !== null &&
		connectionPairs.has(`${fromViewId}\0${toViewId}`);
	const sceneEntities = new Set(units.scene.data.entities.map((entity) => entity.id));

	units.experience.data.experiences.forEach((experience, index) => {
		const path = `$.units.experience.data.experiences[${index}]`;
		const presentationById = new Map(experience.presentations.map((presentation) => [presentation.id, presentation]));
		for (const [position, presentation] of experience.presentations.entries()) {
			for (const [viewPosition, viewId] of presentation.viewIds.entries()) {
				if (!views.has(viewId)) {
					diagnostics.push({
						path: `${path}.presentations[${position}].viewIds[${viewPosition}]`,
						code: 'unresolved-view',
						message: `presentation "${presentation.id}" names camera view "${viewId}", which this envelope does not carry`
					});
				}
			}
			if (presentation.subject !== null) {
				const subject = presentation.subject.subject;
				if (presentation.subject.domain === 'scene') {
					if (subject.kind !== 'entity') {
						diagnostics.push({
							path: `${path}.presentations[${position}].subject`,
							code: 'unresolved-subject',
							message: `presentation "${presentation.id}" names a scene subject of kind "${subject.kind}"; Preview resolves scene entities only`
						});
					} else if (!sceneEntities.has(subject.id)) {
						diagnostics.push({
							path: `${path}.presentations[${position}].subject`,
							code: 'unresolved-subject',
							message: `presentation "${presentation.id}" names scene entity "${subject.id}", which this envelope does not carry`
						});
					}
				} else {
					// A Layout-element subject is admitted by the format, but Preview does
					// not resolve it yet: disclose that it stays authored rather than
					// implying the run presents it.
					diagnostics.push({
						path: `${path}.presentations[${position}].subject`,
						code: 'unresolved-subject',
						message: `presentation "${presentation.id}" names layout "${subject.kind}" subject "${subject.id}", which Preview does not resolve yet`
					});
				}
			}
		}
		const presentationIds = new Set(experience.presentations.map((presentation) => presentation.id));
		const stopById = new Map<string, ExperienceStop>();
		for (const stop of experience.stops) {
			if (!stopById.has(stop.id)) stopById.set(stop.id, stop);
		}
		const stops = new Set(experience.stops.map((stop) => stop.id));
		const successorIdsByStopId = new Map<string, string[]>();
		for (const guide of experience.guides) {
			// Match `guide.stopIds.indexOf(stop.id)` exactly: only the first occurrence
			// of a stopId inside one Guide contributes its immediate successor.
			const seenInGuide = new Set<string>();
			for (let idx = 0; idx + 1 < guide.stopIds.length; idx += 1) {
				const sId = guide.stopIds[idx]!;
				if (seenInGuide.has(sId)) continue;
				seenInGuide.add(sId);
				const list = successorIdsByStopId.get(sId);
				if (list) list.push(guide.stopIds[idx + 1]!);
				else successorIdsByStopId.set(sId, [guide.stopIds[idx + 1]!]);
			}
		}
		/** The View a Stop occurrence enters at: its entry View or the Default. */
		const entryViewOf = (stop: ExperienceStop): string | null => {
			const presentation = presentationById.get(stop.presentationId);
			return stop.entryViewId ?? presentation?.defaultViewId ?? null;
		};
		/**
		 * The Stops that follow `stop` under `sequence-next`. Lowering resolves that
		 * edge through the Guide orders it was asked to lower, and `guide-order`
		 * rewrites a Guide without rewriting this array, so adjacency follows the
		 * authored Guide order here too.
		 *
		 * There is no array-order fallback: a Stop no Guide orders is not part of any
		 * lowered program, and an Experience with Stops but no Guide is refused by
		 * lowering before its edges are traversed.
		 */
		const adjacentTargets = (stop: ExperienceStop): (ExperienceStop | undefined)[] =>
			(successorIdsByStopId.get(stop.id) ?? []).map((id) => stopById.get(id));
		for (const [position, stop] of experience.stops.entries()) {
			if (!presentationIds.has(stop.presentationId)) {
				diagnostics.push({
					path: `${path}.stops[${position}].presentationId`,
					code: 'unresolved-presentation',
					message: `stop "${stop.id}" names presentation "${stop.presentationId}", which this Experience does not carry`
				});
			}
			if (stop.entryViewId !== undefined && !views.has(stop.entryViewId)) {
				diagnostics.push({
					path: `${path}.stops[${position}].entryViewId`,
					code: 'unresolved-view',
					message: `stop "${stop.id}" enters at camera view "${stop.entryViewId}", which this envelope does not carry`
				});
			}
			const continuation = stop.continuation;
			if (
				continuation !== undefined &&
				continuation.kind !== 'end' &&
				continuation.transition === 'travel'
			) {
				// Experience never infers a Cut and never searches the Camera graph: an
				// unsupported Travel stays authored and is reported as a gap. Adjacency
				// follows the Guide orders lowering reads, not this array's order.
				const targets = continuation.kind === 'stop'
					? [stopById.get(continuation.stopId)]
					: adjacentTargets(stop);
				const reported = new Set<string>();
				for (const target of targets) {
					if (target === undefined || reported.has(target.id)) continue;
					reported.add(target.id);
					if (!supportedTravel(entryViewOf(stop), entryViewOf(target))) {
						diagnostics.push({
							path: `${path}.stops[${position}].continuation.transition`,
							code: 'travel-gap',
							message: `the Travel from stop "${stop.id}" has no Camera connection to the View of stop "${target.id}"`
						});
					}
				}
			}
			if (continuation !== undefined && continuation.kind === 'stop' && !stops.has(continuation.stopId)) {
				diagnostics.push({
					path: `${path}.stops[${position}].continuation.stopId`,
					code: 'unresolved-stop',
					message: `stop "${stop.id}" continues to stop "${continuation.stopId}", which this Experience does not carry`
				});
			}
		}
		for (const [position, guide] of experience.guides.entries()) {
			for (const stopId of guide.stopIds) {
				if (!stops.has(stopId)) {
					diagnostics.push({
						path: `${path}.guides[${position}].stopIds`,
						code: 'unresolved-stop',
						message: `guide "${guide.id}" orders stop "${stopId}", which this Experience does not carry`
					});
				}
			}
		}
		for (const [position, gate] of experience.gates.entries()) {
			if (!presentationIds.has(gate.presentationId)) {
				diagnostics.push({
					path: `${path}.gates[${position}].presentationId`,
					code: 'unresolved-presentation',
					message: `gate "${gate.id}" names presentation "${gate.presentationId}", which this Experience does not carry`
				});
			}
		}
		for (const [position, detour] of experience.detours.entries()) {
			for (const [field, stopId] of [
				['fromStopId', detour.fromStopId],
				['toStopId', detour.toStopId],
				['returnToStopId', detour.returnToStopId]
			] as const) {
				if (!stops.has(stopId)) {
					diagnostics.push({
						path: `${path}.detours[${position}].${field}`,
						code: 'unresolved-stop',
						message: `detour "${detour.id}" names stop "${stopId}", which this Experience does not carry`
					});
				}
			}
		}
	});

	const resources = units.resources.data.resources;
	const resourceByKindAndId = new Map<string, TypedResource>();
	for (const [index, resource] of resources.entries()) {
		const key = `${resource.kind}\0${resource.id}`;
		if (!resourceByKindAndId.has(key)) resourceByKindAndId.set(key, resource);
		if (resource.unresolved !== null) diagnostics.push({
			path: `$.units.resources.data.resources[${index}].unresolved`,
			code: resource.unresolved.status, message: resource.unresolved.message
		});
	}
	const modelResourceIds = new Set(resources.filter((resource) => resource.kind === 'model').map((resource) => resource.id));
	// A Scene model names either a catalogue asset or a `model` resource of this
	// envelope. The envelope cannot know the host's catalogue, so a catalogue id
	// keeps the landed asset requirement while a `model` resource id is satisfied
	// by that entry instead — one id space, resolved against the registry.
	const requiredResources = [
		...units.scene.data.textures.map((texture) => ({ kind: 'texture', id: texture.id })),
		...units.scene.data.entities
			.filter((entity) => entity.kind === 'model')
			.map((entity) => (modelResourceIds.has(entity.assetId)
				? { kind: 'model', id: entity.assetId }
				: { kind: 'asset', id: entity.assetId }))
	];
	for (const required of requiredResources) {
		const resource = resourceByKindAndId.get(`${required.kind}\0${required.id}`);
		if (resource === undefined || resource.unresolved !== null) closure.push({
			path: '$.units.resources.data.resources', code: resource === undefined ? 'missing-resource' : 'unresolved-resource',
			message: `Scene requires ${required.kind} "${required.id}" with resolved bytes`
		});
	}

	// A creator model is an approved external revision: the envelope must pin the
	// exact revision it was authored against. The resource entry alone is not a
	// binding, so a `model` resource without its lock entry is an executable
	// closure failure (a lock without its resource is reported below).
	const pinnedModelResourceIds = new Set<string>();
	for (const entry of lock.entries) {
		if (
			entry.domain === 'resource:model' &&
			entry.subjectKind === 'resource' &&
			entry.instancePath.length === 0
		) {
			pinnedModelResourceIds.add(entry.subjectId);
		}
	}
	for (const resource of resources) {
		if (resource.kind !== 'model') continue;
		if (!pinnedModelResourceIds.has(resource.id)) {
			closure.push({
				path: '$.dependencyLock.entries',
				code: 'missing-lock',
				message: `model resource "${resource.id}" is not pinned by a dependency-lock entry`
			});
		}
	}

	// Executable closure: every lock entry whose scope is a resource must be
	// satisfied by a registry record, and a pinned entry must agree with the
	// registry's own pin. This is a closure failure, not a structural defect.
	for (const [index, entry] of lock.entries.entries()) {
		if (!entry.domain.startsWith('resource:')) continue;
		const kind = entry.domain.slice('resource:'.length);
		const path = `$.dependencyLock.entries[${index}]`;
		const record = entry.subjectKind === 'resource' && entry.instancePath.length === 0
			? resourceByKindAndId.get(`${kind}\0${entry.subjectId}`) : undefined;
		if (record === undefined) {
			closure.push({
				path,
				code: 'missing-resource',
				message: `the lock requires ${entry.domain} "${entry.subjectId}" and the resource unit carries no such resource`
			});
			continue;
		}
		if (record.unresolved !== null) closure.push({ path, code: 'unresolved-resource', message: record.unresolved.message });
		const revision = record.contentRevision ?? record.pin?.hash ?? null;
		if (revision !== null && revision !== entry.contentRevision) {
			closure.push({
				path,
				code: 'resource-revision-mismatch',
				message: `the lock pins "${entry.subjectId}" to ${entry.contentRevision} and the resource unit declares ${revision}`
			});
		}
		if (!samePin(record.pin, entry.pin)) {
			closure.push({
				path,
				code: 'resource-pin-mismatch',
				message: `the lock and the resource unit pin different bytes for "${entry.subjectId}"`
			});
		}
	}
	return { diagnostics, closure };
}

/** Serialize a validated envelope in its canonical field order. */
export function serializeProjectEnvelope(envelope: ProjectEnvelope): string {
	countWork('envelope:serialize');
	const result = validateProjectEnvelope(envelope);
	if (!result.success) {
		const first = result.issues[0]!;
		throw new Error(`${first.path} (${first.code}): ${first.message}`);
	}
	return serializeValidatedProjectEnvelope(result.envelope);
}

/**
 * The serialization half, for a caller holding a value this module already
 * validated.
 *
 * `serializeProjectEnvelope` validates because any caller may hand it a value
 * straight from the network; an admission path that just validated the same
 * envelope would otherwise validate it again purely to serialize it. Passing the
 * **validated** envelope — the value the check returned, not the raw input — is
 * what proves the check happened, exactly as with `prepareValidatedUnitRuntime`.
 */
export function serializeValidatedProjectEnvelope(envelope: ProjectEnvelope): string {
	countWork('envelope:serialize-validated');
	return JSON.stringify(envelope, null, 2) + '\n';
}
