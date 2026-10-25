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
 */
export function canonicalUnitJson(value: unknown): string {
	return canonicalize(value);
}

function canonicalize(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new TypeError('A unit value may not contain a non-finite number');
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record)
			.filter((key) => record[key] !== undefined)
			.sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
	}
	throw new TypeError(`A unit value may not contain a ${typeof value}`);
}

/** UTF-8 canonical bytes of one unit's domain data. */
export function canonicalUnitBytes(data: unknown): Uint8Array {
	return new TextEncoder().encode(canonicalUnitJson(data));
}

/** One unit's content revision: `sha256Bytes` over its canonical domain data. */
export async function computeUnitContentRevision(
	data: unknown,
	instrumentation?: SaveWorkInstrumentation,
	phase = 'unit-content'
): Promise<string> {
	if (!instrumentation) return sha256Bytes(canonicalUnitBytes(data));
	const bytes = instrumentation.sync(`${phase}.canonical-encode`, () => canonicalUnitBytes(data));
	return instrumentation.async(`${phase}.sha256-wall`, () => sha256Bytes(bytes, instrumentation.sync, `${phase}.sha256`));
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
