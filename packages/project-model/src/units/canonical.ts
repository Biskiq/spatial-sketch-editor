import { hasOwnedFrozenJsonProof } from '../json-immutability';
import { countWork } from '@portfolio/layout-core';
/**
 * F.2 `unit-envelope-v1` canonical bytes and content identities (AM-2).
 *
 * Two identities live here and they are not the same thing:
 *
 * - a **unit content revision** hashes that unit's canonical domain data alone.
 *   It excludes the header (and therefore excludes itself), every session value
 *   and every document-level identity, so two sources with equal domain data
 *   have equal content revisions.
 * - the **envelope source-content digest** hashes the authored envelope
 *   *without* `acceptedRevision` and without any session, history or receipt
 *   metadata, so an accepted revision change or a Save receipt never changes the
 *   content identity of identical authored contents.
 *
 * Both forms are key-order and whitespace invariant: the canonicalizer writes
 * object keys in sorted order and drops absent (`undefined`) values, so a value
 * assembled in a different insertion order — or a re-parse of pretty-printed
 * JSON — produces byte-identical canonical output. Arrays keep their authored
 * order: entity, guide and view order are authored data, not map iteration.
 *
 * The hash primitive is the landed `sha256Bytes`; this module defines no second
 * hashing implementation.
 */

import { validateUnitPayload } from './validate';
import { sha256Bytes, type SynchronousWorkMeasure } from '../package-sha';
import {
	ADMITTED_UNIT_VERSIONS,
	type DependencyLock,
	type DomainUnit,
	type LayoutUnitPayload,
	type CameraFreeSceneDocument,
	type CameraUnitPayload,
	type ExperienceUnitPayload,
	type ProjectEnvelope,
	type ProjectUnits,
	type ResourceUnitPayload,
	type UnitDomain,
	type PayloadOf,
	type UnitHeader
} from './types';

const CANONICAL_JSON_BY_FROZEN_OBJECT = new WeakMap<object, string>();
const UNIT_REVISION_BY_FROZEN_OBJECT = new WeakMap<object, string>();

function isPlainJsonContainer(value: object): boolean {
	if (hasOwnedFrozenJsonProof(value)) return true;
	const proto = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return false;
	return Reflect.ownKeys(value).every((key) => {
		countWork('canonical:frozen-property-check');
		return 'value' in Object.getOwnPropertyDescriptor(value, key)!;
	});
}

type CanonicalizedResult = {
	readonly json: string;
	readonly deeplyFrozen: boolean;
};

/** Optional, runtime-neutral probes for a Save's own synchronous and async work. */
export type SaveWorkInstrumentation = {
	sync: SynchronousWorkMeasure;
	async: <T>(phase: string, work: () => Promise<T>) => Promise<T>;
};

/**
 * Deterministic canonical JSON for authored domain data: object keys sorted,
 * `undefined` values omitted, finite numbers in their JSON form. Anything a
 * validated unit cannot carry (a function, a symbol, a non-finite number) is a
 * defect and throws rather than serializing to a silently different value.
 *
 * Inductively memoizes canonical substrings in a `WeakMap` **only** for plain
 * JSON containers whose entire transitive subgraph is verified `Object.isFrozen`,
 * preserving 100% identical canonical bytes while making repeated digests over
 * unchanged F4-frozen units O(1).
 */
export function canonicalUnitJson(value: unknown): string {
	return canonicalizeTracked(value).json;
}

function canonicalizeTracked(value: unknown): CanonicalizedResult {
	countWork('canonical:value-visit');
	if (value === null) return { json: 'null', deeplyFrozen: true };
	if (typeof value === 'string' || typeof value === 'boolean') {
		return { json: JSON.stringify(value), deeplyFrozen: true };
	}
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new TypeError('A unit value may not contain a non-finite number');
		return { json: JSON.stringify(value), deeplyFrozen: true };
	}
	if (Array.isArray(value)) {
		const cached = CANONICAL_JSON_BY_FROZEN_OBJECT.get(value);
		if (cached !== undefined) { countWork('canonical:substring-hit'); return { json: cached, deeplyFrozen: true }; }
		let deeplyFrozen = Object.isFrozen(value) && isPlainJsonContainer(value);
		countWork('canonical:array-slots', value.length);
		const parts = new Array<string>(value.length);
		for (let i = 0; i < value.length; i += 1) {
			const child = canonicalizeTracked(value[i]);
			parts[i] = child.json;
			if (!child.deeplyFrozen) deeplyFrozen = false;
		}
		const json = `[${parts.join(',')}]`;
		countWork('canonical:assembled-utf16', json.length);
		if (deeplyFrozen) CANONICAL_JSON_BY_FROZEN_OBJECT.set(value, json);
		return { json, deeplyFrozen };
	}
	if (typeof value === 'object') {
		const cached = CANONICAL_JSON_BY_FROZEN_OBJECT.get(value);
		if (cached !== undefined) { countWork('canonical:substring-hit'); return { json: cached, deeplyFrozen: true }; }
		let deeplyFrozen = Object.isFrozen(value) && isPlainJsonContainer(value);
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record)
			.filter((key) => record[key] !== undefined)
			.sort();
		const parts = new Array<string>(keys.length);
		for (let i = 0; i < keys.length; i += 1) {
			const key = keys[i]!;
			const child = canonicalizeTracked(record[key]);
			parts[i] = `${JSON.stringify(key)}:${child.json}`;
			if (!child.deeplyFrozen) deeplyFrozen = false;
		}
		const json = `{${parts.join(',')}}`;
		countWork('canonical:assembled-utf16', json.length);
		if (deeplyFrozen) CANONICAL_JSON_BY_FROZEN_OBJECT.set(value, json);
		return { json, deeplyFrozen };
	}
	throw new TypeError(`A unit value may not contain a ${typeof value}`);
}

/** UTF-8 canonical bytes of one unit's domain data. */
export function canonicalUnitBytes(data: unknown): Uint8Array {
	const bytes = new TextEncoder().encode(canonicalUnitJson(data));
	countWork('canonical:utf8-bytes', bytes.byteLength);
	return bytes;
}

/** One unit's content revision: `sha256Bytes` over its canonical domain data. */
export async function computeUnitContentRevision(
	data: unknown,
	instrumentation?: SaveWorkInstrumentation,
	phase = 'unit-content'
): Promise<string> {
	if (typeof data === 'object' && data !== null) {
		// The revision is a pure function of the canonical bytes, so a deeply frozen value
		// answers from the memo — the memo hit is what makes a repeated digest over an
		// unchanged F4-frozen unit O(1). Attribution still sees the digest it replaces.
		const cachedRevision = UNIT_REVISION_BY_FROZEN_OBJECT.get(data);
		if (cachedRevision !== undefined) {
			countWork('canonical:unit-revision-hit');
			return cachedRevision;
		}
		const encode = (): { bytes: Uint8Array; deeplyFrozen: boolean } => {
			const { json, deeplyFrozen } = canonicalizeTracked(data);
			return { bytes: new TextEncoder().encode(json), deeplyFrozen };
		};
		const encoded = instrumentation ? instrumentation.sync(`${phase}.canonical-encode`, encode) : encode();
		countWork('canonical:utf8-bytes', encoded.bytes.byteLength);
		// One digest, measured as the Save-owned async wall when the caller asked for it.
		const revision = instrumentation
			? await instrumentation.async(`${phase}.sha256-wall`, () =>
				sha256Bytes(encoded.bytes, instrumentation.sync, `${phase}.sha256`)
			)
			: await sha256Bytes(encoded.bytes);
		if (encoded.deeplyFrozen) UNIT_REVISION_BY_FROZEN_OBJECT.set(data, revision);
		return revision;
	}
	if (!instrumentation) return sha256Bytes(canonicalUnitBytes(data));
	const bytes = instrumentation.sync(`${phase}.canonical-encode`, () => canonicalUnitBytes(data));
	return instrumentation.async(`${phase}.sha256-wall`, () =>
		sha256Bytes(bytes, instrumentation.sync, `${phase}.sha256`)
	);
}

/** Build a header for validated domain data at the domain's admitted version. */
export async function createUnitHeader(
	domain: UnitDomain,
	unitId: string,
	data: unknown
): Promise<UnitHeader> {
	return {
		domain,
		unitId,
		formatVersion: ADMITTED_UNIT_VERSIONS[domain],
		contentRevision: await computeUnitContentRevision(data)
	};
}

/** Wrap validated domain data as a complete unit. */
export async function createDomainUnit<D extends UnitDomain>(
	domain: D,
	unitId: string,
	data: PayloadOf<D>
): Promise<DomainUnit<PayloadOf<D>>> {
	const result = validateUnitPayload(domain, data);
	if (!result.success) {
		const first = result.issues[0]!;
		throw new Error(`${first.path} (${first.code}): ${first.message}`);
	}
	// Hash the same normalized domain data that a reader returns.
	const normalized = result.value as PayloadOf<D>;
	return { header: await createUnitHeader(domain, unitId, normalized), data: normalized };
}

/**
 * What the source-content digest hashes: the authored envelope without
 * `acceptedRevision`. Session, history and receipt metadata have no field in the
 * envelope type at all, so their exclusion is structural rather than a filter.
 */
export function envelopeSourceCore(envelope: ProjectEnvelope): unknown {
	return {
		formatVersion: envelope.formatVersion,
		id: envelope.id,
		name: envelope.name,
		dependencyLock: envelope.dependencyLock,
		units: unitCores(envelope.units)
	};
}

function unitCores(units: ProjectUnits): Record<string, unknown> {
	const core: Record<string, unknown> = {};
	for (const [domain, unit] of Object.entries(units)) {
		const header = (unit as DomainUnit<unknown>).header;
		core[domain] = {
			header: { domain: header.domain, unitId: header.unitId, formatVersion: header.formatVersion },
			data: (unit as DomainUnit<unknown>).data
		};
	}
	return core;
}

/** The envelope's source-content digest: canonical authored contents, no revision. */
export async function computeEnvelopeSourceContentId(
	envelope: ProjectEnvelope,
	instrumentation?: SaveWorkInstrumentation,
	phase = 'envelope-source'
): Promise<string> {
	if (!instrumentation) return sha256Bytes(canonicalUnitBytes(envelopeSourceCore(envelope)));
	const bytes = instrumentation.sync(`${phase}.canonical-encode`, () => canonicalUnitBytes(envelopeSourceCore(envelope)));
	return instrumentation.async(`${phase}.sha256-wall`, () => sha256Bytes(bytes, instrumentation.sync, `${phase}.sha256`));
}

export type ContentRevisionMismatch = {
	/** Envelope-relative path of the unit whose revision disagrees. */
	path: string;
	declared: string;
	recomputed: string;
};

/**
 * Recompute every unit's content revision and report disagreements. A reader
 * that trusts a declared revision without recomputing would admit an envelope
 * whose bytes and identity disagree; this is the check that makes the envelope
 * self-verifying.
 */
export async function verifyUnitContentRevisions(
	envelope: ProjectEnvelope
): Promise<ContentRevisionMismatch[]> {
	const mismatches: ContentRevisionMismatch[] = [];
	for (const domain of Object.keys(envelope.units) as Array<keyof ProjectUnits>) {
		const unit = envelope.units[domain] as DomainUnit<unknown>;
		const recomputed = await computeUnitContentRevision(unit.data);
		if (recomputed !== unit.header.contentRevision) {
			mismatches.push({ path: `$.units.${domain}`, declared: unit.header.contentRevision, recomputed });
		}
	}
	return mismatches;
}

export type ProjectEnvelopeInput = {
	id: string;
	name: string;
	acceptedRevision: ProjectEnvelope['acceptedRevision'];
	dependencyLock: DependencyLock;
	layout: { unitId: string; data: LayoutUnitPayload };
	scene: { unitId: string; data: CameraFreeSceneDocument };
	camera: { unitId: string; data: CameraUnitPayload };
	experience: { unitId: string; data: ExperienceUnitPayload };
	resources: { unitId: string; data: ResourceUnitPayload };
};

/**
 * Assemble a complete envelope and compute every content revision. The result is
 * exactly what a reader accepts: five units, each at its domain's admitted
 * version, with revisions that `verifyUnitContentRevisions` confirms.
 */
export async function createProjectEnvelope(input: ProjectEnvelopeInput): Promise<ProjectEnvelope> {
	const [layout, scene, camera, experience, resources] = await Promise.all([
		createDomainUnit('layout', input.layout.unitId, input.layout.data),
		createDomainUnit('scene', input.scene.unitId, input.scene.data),
		createDomainUnit('camera', input.camera.unitId, input.camera.data),
		createDomainUnit('experience', input.experience.unitId, input.experience.data),
		createDomainUnit('resources', input.resources.unitId, input.resources.data)
	]);
	return {
		formatVersion: 1,
		id: input.id,
		name: input.name,
		acceptedRevision: input.acceptedRevision,
		dependencyLock: input.dependencyLock,
		units: { layout, scene, camera, experience, resources }
	};
}
