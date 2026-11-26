import { countWork } from '@portfolio/layout-core/kernel';
import { validateWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import { linkClonedCowCandidate } from '@portfolio/layout-core/world';
import { ShapeReader, type ShapeValidation } from '../../strict-shape';
import {
	ADMITTED_UNIT_VERSIONS,
	UNIT_DOMAINS,
	type DomainUnit,
	type LayoutUnitPayload,
	type PayloadOf,
	type UnitDomain,
	type UnitHeader,
	type UnitPayload,
} from '../types';
import { validateCameraPayload } from './camera';
import { validateExperiencePayload } from './experience';
import {
	type PayloadReader,
	isDeeplyFrozenPlainJson,
	freezePlainJsonSubgraph,
} from './frozen-json';
import { validateResourcePayload } from './resources';
import { validateCameraFreeScenePayload } from './scene';
import { HEADER_KEYS, delegatedIssues } from './shared';

/** Strict read of the current wall-first Layout payload. */
export function validateLayoutPayload(input: unknown): ShapeValidation<LayoutUnitPayload> {
	const result = validateWallFirstLayoutDocument(input);
	if (!result.success) return { success: false, issues: delegatedIssues(result.issues) };
	if (typeof input === 'object' && input !== null) {
		linkClonedCowCandidate(input as LayoutUnitPayload, result.document);
	}
	return { success: true, value: result.document, ignoredOptionalExtensions: [] };
}

export const VALIDATED_PAYLOAD_CACHE: {
	[D in UnitDomain]: WeakMap<object, ShapeValidation<UnitPayload>>;
} = {
	layout: new WeakMap(),
	scene: new WeakMap(),
	camera: new WeakMap(),
	experience: new WeakMap(),
	resources: new WeakMap(),
};

export const PAYLOAD_READERS: Readonly<Record<UnitDomain, PayloadReader>> = {
	layout: validateLayoutPayload as PayloadReader,
	scene: validateCameraFreeScenePayload as PayloadReader,
	camera: validateCameraPayload as PayloadReader,
	experience: validateExperiencePayload as PayloadReader,
	resources: validateResourcePayload as PayloadReader,
};

/**
 * Read any admitted unit payload. The payload declares its own version, and that
 * version must be the domain's admitted one: a payload that claims another
 * version is a version negotiation failure, not a variant to interpret.
 */
export function validateUnitPayload(
	domain: UnitDomain,
	input: unknown,
): ShapeValidation<UnitPayload> {
	if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
		const cached = VALIDATED_PAYLOAD_CACHE[domain].get(input);
		if (cached !== undefined) {
			countWork(`validation:payload-hit:${domain}`);
			return cached;
		}
		countWork(`validation:payload-read:${domain}`);
		const result = PAYLOAD_READERS[domain](input);
		if (result.success) {
			freezePlainJsonSubgraph(result.value);
			if (domain === 'layout') {
				linkClonedCowCandidate(
					input as unknown as Parameters<typeof linkClonedCowCandidate>[0],
					result.value as unknown as Parameters<typeof linkClonedCowCandidate>[1],
				);
			}
			VALIDATED_PAYLOAD_CACHE[domain].set(input, result);
			VALIDATED_PAYLOAD_CACHE[domain].set(result.value as object, result);
		}
		return result;
	}
	countWork(`validation:payload-read:${domain}`);
	return PAYLOAD_READERS[domain](input);
}

export function readUnitHeader(
	reader: ShapeReader,
	input: unknown,
	path: string,
	domain: UnitDomain,
): UnitHeader | null {
	const record = reader.object(input, path, HEADER_KEYS);
	if (record === null) return null;
	const declaredDomain = reader.tag(record.domain, `${path}.domain`, UNIT_DOMAINS);
	if (declaredDomain !== null && declaredDomain !== domain) {
		reader.problem(
			`${path}.domain`,
			'unit-domain-mismatch',
			`${path}.domain is "${declaredDomain}" and the unit is filed under "${domain}"`,
		);
		return null;
	}
	const unitId = reader.opaqueId(record.unitId, `${path}.unitId`);
	if (record.formatVersion !== ADMITTED_UNIT_VERSIONS[domain]) {
		reader.problem(
			`${path}.formatVersion`,
			'unsupported_format_version',
			domain === 'scene' && record.formatVersion === 8
				? 'Scene 8 projects and releases require re-authoring in Scene 9 before publishing again.'
				: `${path}.formatVersion must be ${ADMITTED_UNIT_VERSIONS[domain]} for the ${domain} unit`,
		);
		return null;
	}
	const contentRevision = reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
	if (declaredDomain === null || unitId === null || contentRevision === null) return null;
	return {
		domain: declaredDomain as UnitDomain,
		unitId,
		formatVersion: ADMITTED_UNIT_VERSIONS[domain],
		contentRevision,
	};
}

export function readDomainUnit<D extends UnitDomain>(
	reader: ShapeReader,
	input: unknown,
	path: string,
	domain: D,
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
			`${path}.data.formatVersion ${payload.value.formatVersion} does not match the header's ${header.formatVersion}`,
		);
		return null;
	}
	// One cast, contained here: `validateUnitPayload` returns the union and the
	// domain is the key that selects the member.
	return { header, data: payload.value as PayloadOf<D> };
}
