/**
 * `AuthoringIntent@1` validation and scope classification (AM-4).
 *
 * A cross-domain intent is a persisted/recorded format, so it is read strictly:
 * unknown keys, non-finite numbers, empty identities, unsupported versions and
 * any value that could not be captured deterministically are refused with a path
 * and a code. Two jobs:
 *
 * 1. **Strict shape** — `validateAuthoringIntent`, the single reader for the
 *    intent grammar (`apps/editor/tests/README.md` rule 7: one parser per
 *    grammar; the F.1 reference reader is reused for each target).
 * 2. **Scope classification** — which domains and typed-resource kinds an intent
 *    addresses, so the coordinator can refuse compound, resource and new-unit
 *    requests *before* any planner runs.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import { ShapeReader, type ShapeIssue, type ShapeValidation } from '../strict-shape';
import { validateAcceptedRevision, validateSemanticReference } from '../references/validate';
import { isResourceDomain, REFERENCE_DOMAINS, type SemanticDomain } from '../references/types';
import {
	F4_VERSION,
	type AuthoringIntent,
	type CapturedIdAllocation,
	type CapturedInput,
	type F4JsonValue
} from './types';

const INTENT_KEYS = [
	'version',
	'kind',
	'operationId',
	'expectedRevision',
	'targets',
	'payload',
	'capturedInputs',
	'allocatedIds'
] as const;

export type IntentValidationOptions = {
	/** Extension ids this reader supports; anything else is unsupported. */
	supportedExtensions?: readonly string[];
};

/** One strict-reader problem, as the shared reader reports it. */
export type DeterminismProblem = ShapeIssue;

/**
 * Validate one `AuthoringIntent@1`.
 *
 * The determinism rule is enforced here rather than documented: a payload or
 * captured input that is not JSON data — a function, a class instance, a
 * renderer handle, a non-finite number — is refused, because planning that
 * depends on one cannot be replayed and a snapshot that contains one cannot be
 * serialized.
 */
export function validateAuthoringIntent(
	input: unknown,
	options: IntentValidationOptions = {}
): ShapeValidation<AuthoringIntent> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', INTENT_KEYS);
	if (record === null) return { success: false, issues: reader.issues };

	if (record.version !== F4_VERSION) {
		reader.problem('$.version', 'unsupported-version', `$.version must be ${F4_VERSION}`);
	}
	const kind = reader.string(record.kind, '$.kind');
	const operationId = reader.opaqueId(record.operationId, '$.operationId');
	const revision = validateAcceptedRevision(record.expectedRevision);
	if (!revision.success) {
		for (const issue of revision.issues) {
			reader.problem(`$.expectedRevision${issue.path.slice(1)}`, issue.code, issue.message);
		}
	}
	const targets = readTargets(reader, record.targets, options);
	const payload = readDeterministicValue(reader, record.payload, '$.payload');
	const capturedInputs = readCapturedInputs(reader, record.capturedInputs);
	const allocatedIds = readAllocatedIds(reader, record.allocatedIds);
	if (reader.issues.length > 0 || !revision.success) return { success: false, issues: reader.issues };

	return {
		success: true,
		value: {
			version: F4_VERSION,
			kind: kind!,
			operationId: operationId!,
			expectedRevision: revision.value,
			targets: targets!,
			payload: payload!,
			capturedInputs: capturedInputs!,
			allocatedIds: allocatedIds!
		},
		ignoredOptionalExtensions: []
	};
}

/**
 * The scope an intent addresses: the semantic domains it names and the declared
 * typed-resource kinds it would touch. Distinct from the *planner's* declared
 * admission (the domain a planner claims): one is what a request touches, the
 * other is what a provider grants.
 */
export type IntentScope = {
	readonly domains: readonly SemanticDomain[];
	readonly resourceKinds: readonly string[];
};

export function intentScope(intent: AuthoringIntent): IntentScope {
	const domains = new Set<SemanticDomain>();
	const resourceKinds = new Set<string>();
	for (const target of intent.targets) {
		if (isResourceDomain(target.domain)) resourceKinds.add(target.domain.slice('resource:'.length));
		else if ((REFERENCE_DOMAINS as readonly string[]).includes(target.domain)) domains.add(target.domain as SemanticDomain);
	}
	return { domains: [...domains].sort(), resourceKinds: [...resourceKinds].sort() };
}

/**
 * Whether a value can be captured deterministically: JSON data only, plain
 * objects and arrays, finite numbers. Exported because the acceptance record
 * pins it directly, and because a planner's refusals reuse the same predicate
 * rather than inventing a second one.
 */
export function deterministicProblem(value: unknown, path: string): DeterminismProblem | null {
	if (value === null) return null;
	switch (typeof value) {
		case 'boolean':
		case 'string':
			return null;
		case 'number':
			return Number.isFinite(value)
				? null
				: { path, code: 'non-finite-number', message: `${path} must be a finite number` };
		case 'object':
			break;
		default:
			return {
				path,
				code: 'not-deterministic',
				message: `${path} must be capturable data, not a ${typeof value}`
			};
	}
	if (Array.isArray(value)) {
		for (const [index, entry] of value.entries()) {
			const problem = deterministicProblem(entry, `${path}[${index}]`);
			if (problem !== null) return problem;
		}
		return null;
	}
	const prototype = Object.getPrototypeOf(value) as unknown;
	if (prototype !== Object.prototype && prototype !== null) {
		return {
			path,
			code: 'not-deterministic',
			message: `${path} must be a plain object, not a class instance, handle or reactive proxy`
		};
	}
	for (const [key, entry] of Object.entries(value)) {
		const problem = deterministicProblem(entry, `${path}.${key}`);
		if (problem !== null) return problem;
	}
	return null;
}

function readDeterministicValue(reader: ShapeReader, input: unknown, path: string): F4JsonValue | null {
	const problem = deterministicProblem(input, path);
	if (problem !== null) {
		reader.problem(problem.path, problem.code, problem.message);
		return null;
	}
	return input as F4JsonValue;
}

function readTargets(
	reader: ShapeReader,
	input: unknown,
	options: IntentValidationOptions
): AuthoringIntent['targets'] | null {
	if (!Array.isArray(input)) {
		reader.problem('$.targets', 'not-an-array', '$.targets must be an array');
		return null;
	}
	const targets: AuthoringIntent['targets'][number][] = [];
	for (const [index, entry] of input.entries()) {
		const validated = validateSemanticReference(entry, options);
		if (!validated.success) {
			for (const issue of validated.issues) {
				reader.problem(`$.targets[${index}]${issue.path.slice(1)}`, issue.code, issue.message);
			}
			continue;
		}
		targets.push(validated.value);
	}
	return targets.length === input.length ? targets : null;
}

function readCapturedInputs(reader: ShapeReader, input: unknown): readonly CapturedInput[] | null {
	if (!Array.isArray(input)) {
		reader.problem('$.capturedInputs', 'not-an-array', '$.capturedInputs must be an array');
		return null;
	}
	const captured: CapturedInput[] = [];
	for (const [index, entry] of input.entries()) {
		const path = `$.capturedInputs[${index}]`;
		const record = reader.object(entry, path, ['name', 'value']);
		if (record === null) continue;
		const name = reader.string(record.name, `${path}.name`);
		const value = readDeterministicValue(reader, record.value, `${path}.value`);
		if (name === null || value === null) continue;
		captured.push({ name, value });
	}
	return captured.length === input.length ? captured : null;
}

function readAllocatedIds(reader: ShapeReader, input: unknown): readonly CapturedIdAllocation[] | null {
	if (!Array.isArray(input)) {
		reader.problem('$.allocatedIds', 'not-an-array', '$.allocatedIds must be an array');
		return null;
	}
	const allocations: CapturedIdAllocation[] = [];
	for (const [index, entry] of input.entries()) {
		const path = `$.allocatedIds[${index}]`;
		const record = reader.object(entry, path, ['kind', 'id']);
		if (record === null) continue;
		const kind = reader.string(record.kind, `${path}.kind`);
		const id = reader.opaqueId(record.id, `${path}.id`);
		if (kind === null || id === null) continue;
		allocations.push({ kind, id });
	}
	return allocations.length === input.length ? allocations : null;
}
