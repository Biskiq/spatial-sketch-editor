/**
 * Strict validation for the F.1 `references-v1` shapes (AM-1).
 *
 * A reference is a cross-domain format, so the reader is strict: unknown keys,
 * empty identities, non-finite numbers and unsupported versions are rejected
 * with a path and code rather than tolerated. Extension/capability references
 * declare themselves required or optional — an unsupported **required**
 * extension makes the reference incompatible, an unsupported optional one is
 * ignored and cannot change core identity, because an extension entry carries
 * no payload.
 */

import { ShapeReader, type ShapeValidation } from '../strict-shape';
import {
	REFERENCES_VERSION,
	REFERENCE_DOMAINS,
	isReferenceDomain,
	type AcceptedRevision,
	type DerivedSourceRef,
	type DerivedSubRef,
	type FrameOwner,
	type FrameReference,
	type ReferenceExtension,
	type ReferenceLocation,
	type ReferenceRevision,
	type ReferenceSubject,
	type SemanticReference,
	type SnapshotIdentity
} from './types';

const SEMANTIC_DOMAINS = REFERENCE_DOMAINS satisfies readonly FrameOwner[];

export type ReferenceValidationOptions = {
	/** Extension ids this reader supports. Anything else is unsupported. */
	supportedExtensions?: readonly string[];
};

/** Supported required extensions that no resolver in this reader can honour. */
export type ReferenceValidation = ShapeValidation<SemanticReference> & {
	/** Names the incompatible extension when a required one is unsupported. */
	unsupportedRequiredExtension?: string;
};

const SEMANTIC_REFERENCE_KEYS = [
	'version',
	'domain',
	'revision',
	'subject',
	'instancePath',
	'location',
	'componentId',
	'capabilityId',
	'extensions'
] as const;

function readExtensions(
	reader: ShapeReader,
	input: unknown,
	path: string,
	supported: readonly string[]
): { extensions: ReferenceExtension[]; ignored: string[]; unsupportedRequired: string | null } {
	if (input === undefined || input === null) return { extensions: [], ignored: [], unsupportedRequired: null };
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return { extensions: [], ignored: [], unsupportedRequired: null };
	}
	const extensions: ReferenceExtension[] = [];
	const ignored: string[] = [];
	let unsupportedRequired: string | null = null;
	const seen = new Set<string>();
	for (const [index, entry] of input.entries()) {
		const entryPath = `${path}[${index}]`;
		const record = reader.object(entry, entryPath, ['id', 'required']);
		if (record === null) continue;
		const id = reader.opaqueId(record.id, `${entryPath}.id`);
		const required = reader.boolean(record.required, `${entryPath}.required`);
		if (id === null || required === null) continue;
		if (seen.has(id)) reader.problem(`${entryPath}.id`, 'duplicate-extension', `${id} is declared twice`);
		seen.add(id);
		extensions.push({ id, required });
		if (!supported.includes(id)) {
			if (required) {
				if (unsupportedRequired === null) unsupportedRequired = id;
			} else ignored.push(id);
		}
	}
	return { extensions, ignored, unsupportedRequired };
}

function readSubject(reader: ShapeReader, input: unknown, path: string): ReferenceSubject | null {
	const record = reader.object(input, path, ['kind', 'id']);
	if (record === null) return null;
	const kind = reader.opaqueId(record.kind, `${path}.kind`);
	const id = reader.opaqueId(record.id, `${path}.id`);
	if (kind === null || id === null) return null;
	return { kind, id };
}

function readRevision(reader: ShapeReader, input: unknown, path: string): ReferenceRevision | null {
	const record = reader.object(input, path, ['kind', 'contentRevision', 'projectId']);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['exact', 'project-lock']);
	if (kind === 'exact') {
		const contentRevision = reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
		if (contentRevision === null) return null;
		if (record.projectId !== undefined) reader.problem(`${path}.projectId`, 'unknown-key', `${path}.projectId belongs to a project-lock revision`);
		return { kind: 'exact', contentRevision };
	}
	if (kind === 'project-lock') {
		const projectId = reader.opaqueId(record.projectId, `${path}.projectId`);
		if (projectId === null) return null;
		if (record.contentRevision !== undefined) {
			reader.problem(`${path}.contentRevision`, 'unknown-key', `${path}.contentRevision belongs to an exact revision`);
		}
		return { kind: 'project-lock', projectId };
	}
	return null;
}

function readLocation(reader: ShapeReader, input: unknown, path: string): ReferenceLocation | null {
	const record = reader.object(input, path, ['kind', 'levelId', 'structureInstancePath']);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['project-root', 'layout-location']);
	if (kind === 'project-root') {
		for (const stray of ['levelId', 'structureInstancePath']) {
			if (record[stray] !== undefined) reader.problem(`${path}.${stray}`, 'unknown-key', `${path}.${stray} belongs to a layout-location`);
		}
		return { kind: 'project-root' };
	}
	if (kind === 'layout-location') {
		const levelId = reader.opaqueId(record.levelId, `${path}.levelId`);
		const structureInstancePath = reader.opaqueIdArray(record.structureInstancePath, `${path}.structureInstancePath`);
		if (levelId === null || structureInstancePath === null) return null;
		return { kind: 'layout-location', levelId, structureInstancePath };
	}
	return null;
}

/**
 * Validate one `SemanticReference@1`. Structural defects are blocking; an
 * unsupported **required** extension is reported as `unsupported-extension` and
 * surfaces as `incompatible` at resolution time.
 */
export function validateSemanticReference(
	input: unknown,
	options: ReferenceValidationOptions = {}
): ReferenceValidation {
	const supported = options.supportedExtensions ?? [];
	const reader = new ShapeReader();
	const record = reader.object(input, '$', SEMANTIC_REFERENCE_KEYS);
	if (record === null) return { success: false, issues: reader.issues };

	if (record.version !== REFERENCES_VERSION) {
		reader.problem('$.version', 'unsupported-version', `$.version must be ${REFERENCES_VERSION}`);
	}
	if (typeof record.domain !== 'string' || !isReferenceDomain(record.domain)) {
		reader.problem('$.domain', 'unsupported-domain', '$.domain must be Layout, Scene, Camera, Experience or a declared typed-resource kind');
	}
	const revision = readRevision(reader, record.revision, '$.revision');
	const subject = readSubject(reader, record.subject, '$.subject');
	const instancePath = reader.opaqueIdArray(record.instancePath, '$.instancePath');
	const location = readLocation(reader, record.location, '$.location');
	const componentId = reader.nullableOpaqueId(record.componentId, '$.componentId');
	const capabilityId = reader.nullableOpaqueId(record.capabilityId, '$.capabilityId');
	const { extensions, ignored, unsupportedRequired } = readExtensions(reader, record.extensions, '$.extensions', supported);
	if (unsupportedRequired !== null) {
		reader.problem('$.extensions', 'unsupported-extension', `required extension "${unsupportedRequired}" is not supported`);
	}
	if (reader.issues.length > 0) return { success: false, issues: reader.issues };
	if (
		typeof record.domain !== 'string' ||
		revision === null ||
		subject === null ||
		instancePath === null ||
		location === null ||
		componentId === undefined ||
		capabilityId === undefined
	) {
		return { success: false, issues: reader.issues };
	}
	return {
		success: true,
		value: {
			version: REFERENCES_VERSION,
			domain: record.domain as SemanticReference['domain'],
			revision,
			subject,
			instancePath,
			location,
			componentId,
			capabilityId,
			...(extensions.length > 0 ? { extensions } : {})
		},
		ignoredOptionalExtensions: ignored
	};
}

/** Validate one `FrameReference@1`; an owner-qualified frame needs owner, id and revision. */
export function validateFrameReference(input: unknown): ShapeValidation<FrameReference> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['version', 'kind', 'owner', 'frameId', 'revision']);
	if (record === null) return { success: false, issues: reader.issues };
	if (record.version !== REFERENCES_VERSION) {
		reader.problem('$.version', 'unsupported-version', `$.version must be ${REFERENCES_VERSION}`);
	}
	const kind = reader.tag(record.kind, '$.kind', ['project-world', 'owner-frame']);
	if (kind === 'project-world') {
		for (const stray of ['owner', 'frameId', 'revision']) {
			if (record[stray] !== undefined) reader.problem(`$.${stray}`, 'unknown-key', `$.${stray} belongs to an owner-frame`);
		}
		if (reader.issues.length > 0) return { success: false, issues: reader.issues };
		return { success: true, value: { version: REFERENCES_VERSION, kind: 'project-world' }, ignoredOptionalExtensions: [] };
	}
	if (kind === 'owner-frame') {
		const owner = reader.tag(record.owner, '$.owner', SEMANTIC_DOMAINS);
		const frameId = reader.opaqueId(record.frameId, '$.frameId');
		const revision = reader.opaqueId(record.revision, '$.revision');
		if (reader.issues.length > 0 || owner === null || frameId === null || revision === null) {
			return { success: false, issues: reader.issues };
		}
		return {
			success: true,
			value: { version: REFERENCES_VERSION, kind: 'owner-frame', owner: owner as FrameOwner, frameId, revision },
			ignoredOptionalExtensions: []
		};
	}
	return { success: false, issues: reader.issues };
}

function readSubRef(reader: ShapeReader, input: unknown, path: string): DerivedSubRef | null {
	if (input === null || input === undefined) return null;
	const record = reader.object(input, path, ['kind', 'componentId', 'start', 'end']);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['component', 'interval']);
	if (kind === 'component') {
		const componentId = reader.opaqueId(record.componentId, `${path}.componentId`);
		if (componentId === null) return null;
		return { kind: 'component', componentId };
	}
	if (kind === 'interval') {
		const start = reader.number(record.start, `${path}.start`);
		const end = reader.number(record.end, `${path}.end`);
		if (start === null || end === null) return null;
		if (end <= start) {
			reader.problem(path, 'invalid-interval', `${path} must have end > start`);
			return null;
		}
		return { kind: 'interval', start, end };
	}
	return null;
}

/**
 * Validate one runtime-only `DerivedSourceRef@1`. Its source must be a valid
 * reference and its generation identity must be present: a fragment without a
 * generation qualification cannot be checked for expiry.
 */
export function validateDerivedSourceRef(
	input: unknown,
	options: ReferenceValidationOptions = {}
): ShapeValidation<DerivedSourceRef> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['source', 'generationId', 'stream', 'subRef']);
	if (record === null) return { success: false, issues: reader.issues };
	const generationId = reader.opaqueId(record.generationId, '$.generationId');
	const stream = reader.opaqueId(record.stream, '$.stream');
	const subRef = readSubRef(reader, record.subRef, '$.subRef');
	const source = validateSemanticReference(record.source, options);
	if (!source.success) for (const issue of source.issues) reader.problem(`$.source${issue.path.slice(1)}`, issue.code, issue.message);
	if (reader.issues.length > 0 || generationId === null || stream === null || !source.success) {
		return { success: false, issues: reader.issues };
	}
	return {
		success: true,
		value: { source: source.value, generationId, stream, subRef },
		ignoredOptionalExtensions: source.ignoredOptionalExtensions
	};
}

/** Validate an opaque `AcceptedRevision`; equality only, never a currency inference. */
export function validateAcceptedRevision(input: unknown): ShapeValidation<AcceptedRevision> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['projectId', 'revisionId']);
	if (record === null) return { success: false, issues: reader.issues };
	const projectId = reader.opaqueId(record.projectId, '$.projectId');
	const revisionId = reader.opaqueId(record.revisionId, '$.revisionId');
	if (reader.issues.length > 0 || projectId === null || revisionId === null) return { success: false, issues: reader.issues };
	return { success: true, value: { projectId, revisionId }, ignoredOptionalExtensions: [] };
}

/** Validate `SnapshotIdentity@1`: accepted revision plus separately hashed source content. */
export function validateSnapshotIdentity(input: unknown): ShapeValidation<SnapshotIdentity> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['acceptedRevision', 'sourceContentId']);
	if (record === null) return { success: false, issues: reader.issues };
	const revision = validateAcceptedRevision(record.acceptedRevision);
	if (!revision.success) for (const issue of revision.issues) reader.problem(`$.acceptedRevision${issue.path.slice(1)}`, issue.code, issue.message);
	const sourceContentId = reader.opaqueId(record.sourceContentId, '$.sourceContentId');
	if (reader.issues.length > 0 || sourceContentId === null || !revision.success) {
		return { success: false, issues: reader.issues };
	}
	return {
		success: true,
		value: { acceptedRevision: revision.value, sourceContentId },
		ignoredOptionalExtensions: []
	};
}
