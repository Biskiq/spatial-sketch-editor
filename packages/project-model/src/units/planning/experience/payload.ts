import { type SemanticReference } from '../../../references/types';
import { validateSemanticReference } from '../../../references/validate';
import { ShapeReader } from '../../../strict-shape';
import { type StagedUnitResource } from '../../acceptance-staging';
import { EXPERIENCE_STAY_DEFAULT_SECONDS, EXPERIENCE_TRANSITIONS, type ExperienceTransitionKind, type ResourcePin } from '../../types';
import { readStaySeconds } from '../../validate';

export const STOP_PAYLOAD_KEYS = ['staySeconds', 'transition', 'guideId', 'afterStopId'] as const;
export const COMPOUND_PAYLOAD_KEYS = ['view', 'presentation', 'stop', 'firstGuide', 'resource', 'newExperience'] as const;
export const FIRST_GUIDE_PAYLOAD_KEYS = ['label'] as const;
export const PRESENTATION_PAYLOAD_KEYS = ['label', 'subject', 'text'] as const;
export const RESOURCE_UPDATE_KEYS = ['contentRevision', 'pin'] as const;

export type ResourceUpdate = { readonly contentRevision: string | null; readonly pin: ResourcePin | null };

/** Read the optional staged-resource change; at least one identity is required. */
export function readResourceUpdate(reader: ShapeReader, input: unknown, path: string): ResourceUpdate | null {
	const record = reader.object(input, path, RESOURCE_UPDATE_KEYS);
	if (record === null) return null;
	const contentRevision = record.contentRevision === undefined || record.contentRevision === null
		? null
		: reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
	const pin = record.pin === undefined || record.pin === null ? null : readPin(reader, record.pin, `${path}.pin`);
	if (contentRevision === null && pin === null) {
		reader.problem(path, 'missing-resource-identity', `${path} must name a content revision, an external-bytes pin, or both`);
		return null;
	}
	if ((record.contentRevision !== undefined && record.contentRevision !== null && contentRevision === null) || (record.pin !== undefined && record.pin !== null && pin === null)) {
		return null;
	}
	return { contentRevision, pin };
}

export type SubjectRead =
	| { readonly ok: true; readonly value: SemanticReference | null }
	| { readonly ok: false };

/** A Presentation subject is a whole Scene entity or Layout element, no component. */
export function readSubjectPayload(reader: ShapeReader, input: unknown, path: string): SubjectRead {
	if (input === null) return { ok: true, value: null };
	const read = validateSemanticReference(input);
	if (!read.success) {
		for (const issue of read.issues) reader.problem(`${path}${issue.path.slice(1)}`, issue.code, issue.message);
		return { ok: false };
	}
	if (read.value.componentId !== null) {
		reader.problem(`${path}.componentId`, 'component-not-admitted', 'a Presentation subject names a whole subject; a component-scoped reference is not admitted');
		return { ok: false };
	}
	if (read.value.domain !== 'scene' && read.value.domain !== 'layout') {
		reader.problem(`${path}.domain`, 'unsupported-subject-domain', `a Presentation subject resolves to a Scene entity or a Layout element; "${read.value.domain}" is neither`);
		return { ok: false };
	}
	return { ok: true, value: read.value };
}

/** An edge's authored Cut/Travel selector; absent means Cut. */
export function readOptionalTransition(
	reader: ShapeReader,
	input: unknown,
	path: string
): ExperienceTransitionKind | undefined | null {
	if (input === undefined || input === null) return undefined;
	return reader.tag(input, path, EXPERIENCE_TRANSITIONS) as ExperienceTransitionKind | null;
}

export type StopPayload = {
	readonly staySeconds: number;
	readonly transition: ExperienceTransitionKind | undefined;
	/** The existing Guide the Stop joins, or `null` when the capture creates the first Guide. */
	readonly guideId: string | null;
	readonly afterStopId: string | null;
};

export function readStopPayload(reader: ShapeReader, input: unknown, path: string): StopPayload | null {
	const record = reader.object(input, path, STOP_PAYLOAD_KEYS);
	if (record === null) return null;
	const staySeconds = record.staySeconds === undefined ? EXPERIENCE_STAY_DEFAULT_SECONDS : readStaySeconds(reader, record.staySeconds, `${path}.staySeconds`);
	const transition = readOptionalTransition(reader, record.transition, `${path}.transition`);
	const guideId = record.guideId === null || record.guideId === undefined
		? null
		: reader.opaqueId(record.guideId, `${path}.guideId`);
	let afterStopId: string | null = null;
	if (record.afterStopId !== undefined && record.afterStopId !== null) {
		const parsed = reader.opaqueId(record.afterStopId, `${path}.afterStopId`);
		if (parsed === null) return null;
		afterStopId = parsed;
	}
	if (staySeconds === null || transition === null) return null;
	return { staySeconds, transition, guideId, afterStopId };
}

/** The first Guide's authored label; its identities are the intent's captured ids. */
export function readFirstGuidePayload(
	reader: ShapeReader,
	input: unknown,
	path: string
): { readonly label: string } | null {
	const record = reader.object(input, path, FIRST_GUIDE_PAYLOAD_KEYS);
	if (record === null) return null;
	const label = reader.string(record.label, `${path}.label`);
	return label === null ? null : { label };
}

export const PIN_KEYS = ['hash', 'mime', 'size', 'locator'] as const;

export function readPin(reader: ShapeReader, input: unknown, path: string): ResourcePin | null {
	if (input === null) return null;
	const record = reader.object(input, path, PIN_KEYS);
	if (record === null) return null;
	const hash = reader.opaqueId(record.hash, `${path}.hash`);
	const mime = reader.string(record.mime, `${path}.mime`);
	const size = reader.integerAtLeast(record.size, `${path}.size`, 0);
	const locator = reader.string(record.locator, `${path}.locator`);
	if (hash === null || mime === null || size === null || locator === null) return null;
	return { hash, mime, size, locator };
}

/** Read the host-captured staging set exactly; it is compared, never trusted. */
export function readCapturedStaging(reader: ShapeReader, input: unknown): StagedUnitResource[] | null {
	if (!Array.isArray(input)) {
		reader.problem('$.capturedInputs.staged', 'not-an-array', 'the captured staging set must be an array');
		return null;
	}
	const result: StagedUnitResource[] = [];
	for (const [index, entry] of input.entries()) {
		const path = `$.capturedInputs.staged[${index}]`;
		const record = reader.object(entry, path, ['kind', 'id', 'contentRevision', 'pin']);
		if (record === null) return null;
		const kind = reader.string(record.kind, `${path}.kind`);
		const id = reader.opaqueId(record.id, `${path}.id`);
		const contentRevision = reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
		const pin = record.pin === undefined || record.pin === null ? null : readPin(reader, record.pin, `${path}.pin`);
		if (kind === null || id === null || contentRevision === null || (record.pin !== null && record.pin !== undefined && pin === null)) return null;
		result.push({ kind, id, contentRevision, pin });
	}
	return result;
}

export function sameStaging(left: readonly StagedUnitResource[], right: readonly StagedUnitResource[]): boolean {
	const key = (item: StagedUnitResource) => `${item.kind}:${item.id}`;
	const sortedLeft = [...left].sort((a, b) => key(a).localeCompare(key(b)));
	const sortedRight = [...right].sort((a, b) => key(a).localeCompare(key(b)));
	if (sortedLeft.length !== sortedRight.length) return false;
	return sortedLeft.every((item, index) => {
		const other = sortedRight[index]!;
		if (key(item) !== key(other) || item.contentRevision !== other.contentRevision) return false;
		if (item.pin === null || other.pin === null) return item.pin === other.pin;
		// A pin is four facts. Comparing only its hash would admit different bytes
		// under one content identity.
		return (
			item.pin.hash === other.pin.hash &&
			item.pin.mime === other.pin.mime &&
			item.pin.size === other.pin.size &&
			item.pin.locator === other.pin.locator
		);
	});
}

