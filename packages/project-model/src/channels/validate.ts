/**
 * Strict validation for the F.3 `inspection-v1` shapes (AM-3).
 *
 * Strictness here is the point: an address is read only through its named fields
 * (never a parsed delimiter string), a descriptor's declared value kind decides
 * which value is admissible, units and ranges are checked rather than coerced,
 * and an unknown required family is reported as unsupported instead of being
 * silently admitted. A declared optional family is instead reported unavailable,
 * which the caller may ignore.
 */

import { ShapeReader, type ShapeIssue, type ShapeValidation } from '../strict-shape';
import { isReferenceDomain } from '../references/types';
import { validateFrameReference, validateSemanticReference } from '../references/validate';
import {
	CHANNEL_ARBITRATIONS,
	CHANNEL_INVALIDATION_INPUTS,
	CHANNEL_INTERPOLATIONS,
	CHANNEL_SCOPES,
	CHANNEL_VALUE_KINDS,
	INSPECTION_VERSION,
	type ChannelAddress,
	type ChannelCapability,
	type ChannelContribution,
	type ChannelDescriptor,
	type ChannelFamilyId,
	type ChannelInvalidationInput,
	type ChannelRange,
	type ChannelSourceIdentity,
	type ChannelUnits,
	type ChannelValue,
	type ChannelValueKind
} from './types';

const UNITS: readonly (ChannelUnits | string)[] = ['meters', 'radians', 'ratio'];

export type ChannelValidationOptions = {
	/** Family ids this reader admits. Anything else is unsupported. */
	admittedFamilies?: readonly ChannelFamilyId[];
};

export type ChannelContributionValidation =
	| { success: true; value: ChannelContribution; unavailableFamilies: readonly string[] }
	| { success: false; issues: readonly ShapeIssue[] };

const ADDRESS_KEYS = ['version', 'ownerReference', 'instancePath', 'componentId', 'capabilityId', 'propertyId', 'frame'] as const;

const DESCRIPTOR_KEYS = [
	'version',
	'family',
	'propertyId',
	'valueKind',
	'units',
	'range',
	'values',
	'scope',
	'arbitration',
	'interpolation',
	'invalidation',
	'capability',
	'validator'
] as const;

const CONTRIBUTION_KEYS = [
	'version',
	'descriptor',
	'address',
	'value',
	'scopeId',
	'invocationId',
	'runEpoch',
	'computedFrom'
] as const;

const NUMERIC_KINDS: readonly ChannelValueKind[] = ['number', 'vector3'];

function readCapability(reader: ShapeReader, input: unknown, path: string): ChannelCapability | null {
	const record = reader.object(input, path, ['id', 'required']);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const required = reader.boolean(record.required, `${path}.required`);
	if (id === null || required === null) return null;
	return { id, required };
}

function readRange(reader: ShapeReader, input: unknown, path: string): ChannelRange | null {
	if (input === null || input === undefined) return null;
	const record = reader.object(input, path, ['min', 'max', 'minExclusive', 'maxExclusive']);
	if (record === null) return null;
	const min = record.min === null ? null : reader.number(record.min, `${path}.min`);
	const max = record.max === null ? null : reader.number(record.max, `${path}.max`);
	const minExclusive = reader.boolean(record.minExclusive, `${path}.minExclusive`);
	const maxExclusive = reader.boolean(record.maxExclusive, `${path}.maxExclusive`);
	if (reader.issues.length > 0 || min === undefined || max === undefined || minExclusive === null || maxExclusive === null) return null;
	if (min !== null && max !== null && min >= max) {
		reader.problem(path, 'invalid-range', `${path} must have min < max`);
		return null;
	}
	return { min, max, minExclusive, maxExclusive };
}

function readInvalidation(reader: ShapeReader, input: unknown, path: string): ChannelInvalidationInput[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return null;
	}
	const inputs: ChannelInvalidationInput[] = [];
	for (const [index, entry] of input.entries()) {
		const tag = reader.tag(entry, `${path}[${index}]`, CHANNEL_INVALIDATION_INPUTS);
		if (tag === null) return null;
		inputs.push(tag as ChannelInvalidationInput);
	}
	return inputs;
}

/** Validate one `ChannelDescriptor@1`, structurally and against its own kind. */
export function validateChannelDescriptor(input: unknown): ShapeValidation<ChannelDescriptor> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', DESCRIPTOR_KEYS);
	if (record === null) return { success: false, issues: reader.issues };

	if (record.version !== INSPECTION_VERSION) {
		reader.problem('$.version', 'unsupported-version', `$.version must be ${INSPECTION_VERSION}`);
	}
	const family = reader.opaqueId(record.family, '$.family');
	const propertyId = reader.opaqueId(record.propertyId, '$.propertyId');
	const valueKind = reader.tag(record.valueKind, '$.valueKind', CHANNEL_VALUE_KINDS) as ChannelValueKind | null;
	if (record.units !== null && (typeof record.units !== 'string' || !UNITS.includes(record.units))) {
		reader.problem('$.units', 'unknown-units', `$.units must be one of ${UNITS.join(' | ')} or null`);
	}
	const units: ChannelUnits = record.units === null ? null : (record.units as ChannelUnits);
	const range = readRange(reader, record.range, '$.range');
	const values =
		record.values === null || record.values === undefined ? null : reader.opaqueIdArray(record.values, '$.values');
	const scope = reader.tag(record.scope, '$.scope', CHANNEL_SCOPES);
	const arbitration = reader.tag(record.arbitration, '$.arbitration', CHANNEL_ARBITRATIONS);
	const interpolation = reader.tag(record.interpolation, '$.interpolation', CHANNEL_INTERPOLATIONS);
	const invalidation = readInvalidation(reader, record.invalidation, '$.invalidation');
	const capability = readCapability(reader, record.capability, '$.capability');
	const validator = reader.opaqueId(record.validator, '$.validator');

	// Units belong to measured values only, and a range belongs to numeric ones only.
	if (valueKind !== null) {
		if (units !== null && !NUMERIC_KINDS.includes(valueKind)) {
			reader.problem('$.units', 'invalid-units', `value kind "${valueKind}" is unitless`);
		}
		if (range !== null && !NUMERIC_KINDS.includes(valueKind)) {
			reader.problem('$.range', 'invalid-range', `value kind "${valueKind}" declares no range`);
		}
		if (values !== null && valueKind !== 'identifier') {
			reader.problem('$.values', 'invalid-values', `only an "identifier" value declares a vocabulary`);
		}
	}

	if (reader.issues.length > 0) return { success: false, issues: reader.issues };
	if (
		family === null ||
		propertyId === null ||
		valueKind === null ||
		scope === null ||
		arbitration === null ||
		interpolation === null ||
		invalidation === null ||
		capability === null ||
		validator === null
	) {
		return { success: false, issues: reader.issues };
	}
	return {
		success: true,
		value: {
			version: INSPECTION_VERSION,
			family,
			propertyId,
			valueKind,
			units,
			range,
			values,
			scope: scope as ChannelDescriptor['scope'],
			arbitration: arbitration as ChannelDescriptor['arbitration'],
			interpolation: interpolation as ChannelDescriptor['interpolation'],
			invalidation,
			capability,
			validator
		},
		ignoredOptionalExtensions: []
	};
}

/** Validate one `ChannelAddress@1`, including its owner reference and frame. */
export function validateChannelAddress(input: unknown): ShapeValidation<ChannelAddress> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ADDRESS_KEYS);
	if (record === null) return { success: false, issues: reader.issues };
	if (record.version !== INSPECTION_VERSION) {
		reader.problem('$.version', 'unsupported-version', `$.version must be ${INSPECTION_VERSION}`);
	}
	const owner = validateSemanticReference(record.ownerReference);
	if (!owner.success) for (const issue of owner.issues) reader.problem(`$.ownerReference${issue.path.slice(1)}`, issue.code, issue.message);
	const instancePath = reader.opaqueIdArray(record.instancePath, '$.instancePath');
	const componentId = reader.nullableOpaqueId(record.componentId, '$.componentId');
	const capabilityId = reader.nullableOpaqueId(record.capabilityId, '$.capabilityId');
	const propertyId = reader.opaqueId(record.propertyId, '$.propertyId');
	const frame = validateFrameReference(record.frame);
	if (!frame.success) for (const issue of frame.issues) reader.problem(`$.frame${issue.path.slice(1)}`, issue.code, issue.message);
	if (reader.issues.length > 0 || !owner.success || !frame.success) return { success: false, issues: reader.issues };
	if (instancePath === null || componentId === undefined || capabilityId === undefined || propertyId === null) {
		return { success: false, issues: reader.issues };
	}
	return {
		success: true,
		value: {
			version: INSPECTION_VERSION,
			ownerReference: owner.value,
			instancePath,
			componentId,
			capabilityId,
			propertyId,
			frame: frame.value
		},
		ignoredOptionalExtensions: owner.ignoredOptionalExtensions
	};
}

function readSourceIdentity(reader: ShapeReader, input: unknown, path: string): ChannelSourceIdentity | null {
	const record = reader.object(input, path, ['domain', 'subject', 'instancePath']);
	if (record === null) return null;
	const domain = reader.opaqueId(record.domain, `${path}.domain`);
	if (domain !== null && !isReferenceDomain(domain)) {
		reader.problem(`${path}.domain`, 'unsupported-domain', `${path}.domain must be an admitted domain qualification`);
		return null;
	}
	const subject = reader.object(record.subject, `${path}.subject`, ['kind', 'id']);
	const kind = subject === null ? null : reader.opaqueId(subject.kind, `${path}.subject.kind`);
	const id = subject === null ? null : reader.opaqueId(subject.id, `${path}.subject.id`);
	const instancePath = reader.opaqueIdArray(record.instancePath, `${path}.instancePath`);
	if (domain === null || kind === null || id === null || instancePath === null) return null;
	return { domain: domain as ChannelSourceIdentity['domain'], subject: { kind, id }, instancePath };
}

/** Validate a typed value against its descriptor: kind, units, range and vocabulary. */
export function validateChannelValue(
	input: unknown,
	descriptor: ChannelDescriptor
): ShapeValidation<ChannelValue> & { rangeViolation?: boolean } {
	const reader = new ShapeReader();
	const kind = reader.object(input, '$', ['kind', 'value']);
	if (kind === null) return { success: false, issues: reader.issues };
	const valueKind = reader.tag(kind.kind, '$.kind', CHANNEL_VALUE_KINDS);
	if (valueKind !== descriptor.valueKind) {
		reader.problem('$.kind', 'value-kind-mismatch', `the value kind must be "${descriptor.valueKind}" as declared`);
	}
	let rangeViolation = false;
	const inRange = (input: unknown, path: string): number | null => {
		const bound = descriptor.range;
		const finite = reader.number(input, path);
		if (finite === null || bound === null) return finite;
		const belowMin = bound.min !== null && (bound.minExclusive ? finite <= bound.min : finite < bound.min);
		const aboveMax = bound.max !== null && (bound.maxExclusive ? finite >= bound.max : finite > bound.max);
		if (belowMin || aboveMax) {
			rangeViolation = true;
			reader.problem(path, 'out-of-range', `${path} is outside the declared range`);
			return null;
		}
		return finite;
	};

	if (valueKind === 'number') {
		const value = inRange(kind.value, '$.value');
		if (value === null || reader.issues.length > 0) return { success: false, issues: reader.issues, rangeViolation };
		return { success: true, value: { kind: 'number', value }, ignoredOptionalExtensions: [], rangeViolation };
	}
	if (valueKind === 'vector3') {
		const vector = reader.vector3(kind.value, '$.value');
		if (vector === null) return { success: false, issues: reader.issues, rangeViolation };
		vector.forEach((component, index) => inRange(component, `$.value[${index}]`));
		if (reader.issues.length > 0) return { success: false, issues: reader.issues, rangeViolation };
		return { success: true, value: { kind: 'vector3', value: vector }, ignoredOptionalExtensions: [], rangeViolation };
	}
	if (valueKind === 'identifier') {
		const value = reader.opaqueId(kind.value, '$.value');
		if (value !== null && descriptor.values !== null && !descriptor.values.includes(value)) {
			reader.problem('$.value', 'undeclared-identifier', `$.value must be one of ${descriptor.values.join(' | ')}`);
		}
		if (reader.issues.length > 0 || value === null) return { success: false, issues: reader.issues, rangeViolation };
		return { success: true, value: { kind: 'identifier', value }, ignoredOptionalExtensions: [], rangeViolation };
	}
	if (valueKind === 'identifier-set') {
		const values = reader.opaqueIdArray(kind.value, '$.value');
		if (values === null || reader.issues.length > 0) return { success: false, issues: reader.issues, rangeViolation };
		const unique = new Set(values);
		if (unique.size !== values.length) reader.problem('$.value', 'duplicate-identifier', '$.value must not repeat an identifier');
		if (reader.issues.length > 0) return { success: false, issues: reader.issues, rangeViolation };
		return { success: true, value: { kind: 'identifier-set', value: values }, ignoredOptionalExtensions: [], rangeViolation };
	}
	if (valueKind === 'source-set') {
		if (!Array.isArray(kind.value)) {
			reader.problem('$.value', 'not-an-array', '$.value must be an array of source identities');
			return { success: false, issues: reader.issues, rangeViolation };
		}
		const identities: ChannelSourceIdentity[] = [];
		const seen = new Set<string>();
		for (const [index, entry] of kind.value.entries()) {
			const identity = readSourceIdentity(reader, entry, `$.value[${index}]`);
			if (identity === null) continue;
			// An unambiguous canonical encoding: JSON string escaping is injective, so two
			// distinct opaque id paths can never share a key (a delimiter join could collide).
			const key = JSON.stringify([identity.domain, identity.subject.kind, identity.subject.id, identity.instancePath]);
			if (seen.has(key)) reader.problem(`$.value[${index}]`, 'duplicate-source', '$.value must not repeat a source identity');
			seen.add(key);
			identities.push(identity);
		}
		if (reader.issues.length > 0) return { success: false, issues: reader.issues, rangeViolation };
		return { success: true, value: { kind: 'source-set', value: identities }, ignoredOptionalExtensions: [], rangeViolation };
	}
	return { success: false, issues: reader.issues, rangeViolation };
}

/**
 * Validate one `ChannelContribution@1`. An unadmitted family whose capability is
 * required is blocking; an unadmitted optional family is reported in
 * `unavailableFamilies` so the caller can ignore it without losing the fact.
 */
export function validateChannelContribution(
	input: unknown,
	options: ChannelValidationOptions = {}
): ChannelContributionValidation {
	const admitted = options.admittedFamilies ?? null;
	const reader = new ShapeReader();
	const record = reader.object(input, '$', CONTRIBUTION_KEYS);
	if (record === null) return { success: false, issues: reader.issues };

	if (record.version !== INSPECTION_VERSION) {
		reader.problem('$.version', 'unsupported-version', `$.version must be ${INSPECTION_VERSION}`);
	}
	const descriptor = validateChannelDescriptor(record.descriptor);
	if (!descriptor.success) for (const issue of descriptor.issues) reader.problem(`$.descriptor${issue.path.slice(1)}`, issue.code, issue.message);
	const address = validateChannelAddress(record.address);
	if (!address.success) for (const issue of address.issues) reader.problem(`$.address${issue.path.slice(1)}`, issue.code, issue.message);
	if (!descriptor.success || !address.success) return { success: false, issues: reader.issues };

	if (address.value.propertyId !== descriptor.value.propertyId) {
		reader.problem('$.address.propertyId', 'property-mismatch', 'the address property must be the descriptor property');
	}
	const value = validateChannelValue(record.value, descriptor.value);
	if (!value.success) for (const issue of value.issues) reader.problem(`$.value${issue.path.slice(1)}`, issue.code, issue.message);

	const scopeId = reader.opaqueId(record.scopeId, '$.scopeId');
	const invocationId = reader.opaqueId(record.invocationId, '$.invocationId');
	const runEpoch = reader.integerAtLeast(record.runEpoch, '$.runEpoch', 0);
	const computed = reader.object(record.computedFrom, '$.computedFrom', ['contentRevision', 'generationId']);
	const contentRevision = computed === null ? undefined : reader.nullableOpaqueId(computed.contentRevision, '$.computedFrom.contentRevision');
	const generationId = computed === null ? undefined : reader.nullableOpaqueId(computed.generationId, '$.computedFrom.generationId');

	const unavailableFamilies: string[] = [];
	if (admitted !== null && !admitted.includes(descriptor.value.family)) {
		if (descriptor.value.capability.required) {
			reader.problem(
				'$.descriptor.family',
				'unsupported-required-family',
				`family "${descriptor.value.family}" is not admitted by this reader`
			);
		} else {
			unavailableFamilies.push(descriptor.value.family);
		}
	}

	if (reader.issues.length > 0 || !value.success) return { success: false, issues: reader.issues };
	if (
		scopeId === null ||
		invocationId === null ||
		runEpoch === null ||
		contentRevision === undefined ||
		generationId === undefined
	) {
		return { success: false, issues: reader.issues };
	}
	return {
		success: true,
		value: {
			version: INSPECTION_VERSION,
			descriptor: descriptor.value,
			address: address.value,
			value: value.value,
			scopeId,
			invocationId,
			runEpoch,
			computedFrom: { contentRevision, generationId }
		},
		unavailableFamilies
	};
}
