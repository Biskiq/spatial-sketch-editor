import { isReferenceDomain } from '../../references/types';
import { ShapeReader, type ShapeValidation } from '../../strict-shape';
import { dependencyLockKey } from '../identity';
import { UNIT_ENVELOPE_FORMAT_VERSION, type DependencyLock, type DependencyLockEntry, type ResourcePin } from '../types';
import { LOCK_KEYS, LOCK_ENTRY_KEYS, failed, readPin, readCapabilities } from './shared';

/** The qualified identity/instance scope a lock entry is keyed by. */
export function lockKey(entry: DependencyLockEntry): string {
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

export function samePin(left: ResourcePin | null, right: ResourcePin | null): boolean {
	if (left === null || right === null) return left === right;
	return left.hash === right.hash && left.mime === right.mime && left.size === right.size && left.locator === right.locator;
}
