import { REFERENCE_FAILURE_CODES, isReferenceDomain } from '../../references/types';
import { validateSemanticReference } from '../../references/validate';
import { ShapeReader, type ShapeIssue, type ShapeValidation } from '../../strict-shape';
import { type ProjectEnvelope, type RequiredCapability, type ResourcePin, type UnresolvedBinding } from '../types';

export const ENVELOPE_KEYS = ['formatVersion', 'id', 'name', 'acceptedRevision', 'dependencyLock', 'units'] as const;
export const HEADER_KEYS = ['domain', 'unitId', 'formatVersion', 'contentRevision'] as const;
export const LOCK_KEYS = ['formatVersion', 'entries'] as const;
export const LOCK_ENTRY_KEYS = [
	'domain',
	'subjectKind',
	'subjectId',
	'instancePath',
	'contentRevision',
	'requiredCapabilities',
	'pin'
] as const;
export const PIN_KEYS = ['hash', 'mime', 'size', 'locator'] as const;
export const CAPABILITY_KEYS = ['id', 'version'] as const;
export const BINDING_KEYS = ['reference', 'domain', 'status', 'message'] as const;

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

export function failed<T>(reader: ShapeReader): ShapeValidation<T> {
	return { success: false, issues: reader.issues };
}

export function delegatedIssues(issues: readonly { path: string; code: string; message: string }[]): ShapeIssue[] {
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

export function readPin(reader: ShapeReader, input: unknown, path: string): ResourcePin | null {
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

export function readCapabilities(reader: ShapeReader, input: unknown, path: string): RequiredCapability[] | null {
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
