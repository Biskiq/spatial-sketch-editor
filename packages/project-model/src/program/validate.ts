/**
 * Strict validation for `ExecutionProgram@1` (AM-6).
 *
 * The program is a delivery format, so the reader refuses anything a consumer
 * could misread: unknown keys, non-finite or negative holds, an unregistered
 * event, a `cut` invocation carrying a connection, a state value outside its
 * declared set, a stop that continues to a stop the program does not carry, and
 * an optional capability masquerading as a required one.
 *
 * The reader never throws and never coerces. It is also the only import of this
 * entry besides `./types` and the shared strict-shape primitive — the delivery
 * closure AM-6 requires.
 */

import { ShapeReader, type ShapeValidation } from '../strict-shape';
import {
	EXECUTION_PROGRAM_FORMAT_VERSION,
	EXECUTION_PROGRAM_KIND,
	PROGRAM_EVENTS,
	type ExecutionProgram,
	type ProgramAction,
	type ProgramCapability,
	type ProgramChannelPolicy,
	type ProgramContinuation,
	type ProgramContentRecord,
	type ProgramGuard,
	type ProgramInvocation,
	type ProgramLifecycleAction,
	type ProgramLocalTime,
	type ProgramPresentation,
	type ProgramStateDeclaration,
	type ProgramStop
} from './types';

const PROGRAM_KEYS = [
	'kind',
	'formatVersion',
	'capabilities',
	'experienceId',
	'entryStopId',
	'presentations',
	'stops',
	'state',
	'localTime',
	'channels',
	'lifecycle',
	'profile'
] as const;
const CAPABILITY_KEYS = ['id', 'required'] as const;
const PRESENTATION_KEYS = ['id', 'label', 'viewId', 'content'] as const;
const CONTENT_KEYS = ['id', 'kind', 'text'] as const;
const STOP_KEYS = ['id', 'presentationId', 'invocation', 'holdSeconds', 'continuation'] as const;
const INVOCATION_KEYS = ['kind', 'viewId', 'connectionId'] as const;
const CONTINUATION_KEYS = ['kind', 'stopId'] as const;
const STATE_KEYS = ['id', 'type', 'values', 'initial', 'reset'] as const;
const GUARD_KEYS = ['kind', 'value', 'stateId', 'guards'] as const;
const LOCALTIME_KEYS = ['stopId', 'holdSeconds'] as const;
const CHANNEL_KEYS = ['id', 'family', 'policy'] as const;
const LIFECYCLE_KEYS = ['event', 'action', 'guard'] as const;
const ACTION_KEYS = ['kind', 'contentId', 'stopId', 'url', 'stateId', 'value'] as const;
const PROFILE_KEYS = ['reducedMotion', 'semanticDomNavigation'] as const;

function failed<T>(reader: ShapeReader): ShapeValidation<T> {
	return { success: false, issues: reader.issues };
}

function readArray<T>(
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

function uniqueIds(reader: ShapeReader, ids: readonly string[], path: string, describe: string): boolean {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) {
			reader.problem(path, 'duplicate-identity', `${describe} "${id}" is declared twice`);
			return false;
		}
		seen.add(id);
	}
	return true;
}

function readCapability(reader: ShapeReader, input: unknown, path: string): ProgramCapability | null {
	const record = reader.object(input, path, CAPABILITY_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const required = reader.boolean(record.required, `${path}.required`);
	if (id === null || required === null) return null;
	return { id, required };
}

function readContent(reader: ShapeReader, input: unknown, path: string): ProgramContentRecord | null {
	const record = reader.object(input, path, CONTENT_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const kind = reader.tag(record.kind, `${path}.kind`, ['text']);
	const text = reader.string(record.text, `${path}.text`);
	if (id === null || kind === null || text === null) return null;
	return { id, kind: 'text', text };
}

function readPresentation(reader: ShapeReader, input: unknown, path: string): ProgramPresentation | null {
	const record = reader.object(input, path, PRESENTATION_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const label = reader.string(record.label, `${path}.label`);
	const viewId = reader.opaqueId(record.viewId, `${path}.viewId`);
	const content = readArray(reader, record.content, `${path}.content`, (entry, entryPath) =>
		readContent(reader, entry, entryPath)
	);
	if (id === null || label === null || viewId === null || content === null) return null;
	if (!uniqueIds(reader, content.map((entry) => entry.id), `${path}.content`, 'content record')) return null;
	return { id, label, viewId, content };
}

function readInvocation(reader: ShapeReader, input: unknown, path: string): ProgramInvocation | null {
	const record = reader.object(input, path, INVOCATION_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['cut', 'travel']);
	if (kind === null) return null;
	if (kind === 'cut') {
		if (record.connectionId !== undefined) {
			reader.problem(`${path}.connectionId`, 'unknown-key', `${path}.connectionId is not part of a cut invocation`);
			return null;
		}
		const viewId = reader.opaqueId(record.viewId, `${path}.viewId`);
		if (viewId === null) return null;
		return { kind: 'cut', viewId };
	}
	if (record.viewId !== undefined) {
		reader.problem(`${path}.viewId`, 'unknown-key', `${path}.viewId is not part of a travel invocation`);
		return null;
	}
	const connectionId = reader.opaqueId(record.connectionId, `${path}.connectionId`);
	if (connectionId === null) return null;
	return { kind: 'travel', connectionId };
}

function readContinuation(reader: ShapeReader, input: unknown, path: string): ProgramContinuation | null {
	const record = reader.object(input, path, CONTINUATION_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['sequence-next', 'stop', 'end']);
	if (kind === null) return null;
	if (kind !== 'stop') {
		if (record.stopId !== undefined) {
			reader.problem(`${path}.stopId`, 'unknown-key', `${path}.stopId is not part of the ${kind} continuation`);
			return null;
		}
		return { kind: kind as 'sequence-next' | 'end' };
	}
	const stopId = reader.opaqueId(record.stopId, `${path}.stopId`);
	if (stopId === null) return null;
	return { kind: 'stop', stopId };
}

function readGuard(reader: ShapeReader, input: unknown, path: string, depth = 0): ProgramGuard | null {
	if (depth >= 32) {
		reader.problem(path, 'guard-too-deep', 'a bounded guard may nest at most 32 expressions');
		return null;
	}
	const record = reader.object(input, path, GUARD_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['literal', 'state', 'equals', 'conjunction']);
	if (kind === null) return null;
	const keys = { literal: ['kind', 'value'], state: ['kind', 'stateId'], equals: ['kind', 'stateId', 'value'], conjunction: ['kind', 'guards'] };
	reader.object(record, path, keys[kind as keyof typeof keys]);
	if (kind === 'literal') {
		const value = reader.boolean(record.value, `${path}.value`);
		if (value === null) return null;
		return { kind: 'literal', value };
	}
	if (kind === 'state') {
		const stateId = reader.opaqueId(record.stateId, `${path}.stateId`);
		if (stateId === null) return null;
		return { kind: 'state', stateId };
	}
	if (kind === 'equals') {
		const stateId = reader.opaqueId(record.stateId, `${path}.stateId`);
		const value =
			typeof record.value === 'boolean'
				? record.value
				: reader.opaqueId(record.value, `${path}.value`);
		if (stateId === null || value === null) return null;
		return { kind: 'equals', stateId, value };
	}
	const guards = readArray(reader, record.guards, `${path}.guards`, (entry, entryPath) => readGuard(reader, entry, entryPath, depth + 1));
	if (guards === null) return null;
	if (guards.length === 0) {
		reader.problem(`${path}.guards`, 'empty-conjunction', `${path}.guards must contain at least one guard`);
		return null;
	}
	return { kind: 'conjunction', guards };
}

function readAction(reader: ShapeReader, input: unknown, path: string): ProgramAction | null {
	const record = reader.object(input, path, ACTION_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['show-content', 'navigate-to', 'open-url', 'continue', 'set-state']);
	if (kind === null) return null;
	const keys = { 'show-content': ['kind', 'contentId'], 'navigate-to': ['kind', 'stopId'], 'open-url': ['kind', 'url'], continue: ['kind'], 'set-state': ['kind', 'stateId', 'value'] };
	reader.object(record, path, keys[kind as keyof typeof keys]);
	switch (kind) {
		case 'show-content': {
			const contentId = reader.opaqueId(record.contentId, `${path}.contentId`);
			if (contentId === null) return null;
			return { kind: 'show-content', contentId };
		}
		case 'navigate-to': {
			const stopId = reader.opaqueId(record.stopId, `${path}.stopId`);
			if (stopId === null) return null;
			return { kind: 'navigate-to', stopId };
		}
		case 'open-url': {
			const url = reader.string(record.url, `${path}.url`);
			if (url === null) return null;
			try {
				if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('unsupported protocol');
			} catch {
				reader.problem(`${path}.url`, 'invalid-url', 'OpenUrl requires an absolute HTTP(S) URL');
				return null;
			}
			return { kind: 'open-url', url };
		}
		case 'continue':
			return { kind: 'continue' };
		default: {
			const stateId = reader.opaqueId(record.stateId, `${path}.stateId`);
			const value =
				typeof record.value === 'boolean' ? record.value : reader.opaqueId(record.value, `${path}.value`);
			if (stateId === null || value === null) return null;
			return { kind: 'set-state', stateId, value };
		}
	}
}

/**
 * Read one `ExecutionProgram@1`.
 *
 * Cross-field rules are validated here rather than left to the interpreter:
 * an entry stop must be one of the program's stops (or explicitly `null` with no
 * stops at all), every presentation/stop/state/local-time reference must exist,
 * and every state's initial/reset value must be inside its own declared scope.
 */
export function validateExecutionProgram(input: unknown): ShapeValidation<ExecutionProgram> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', PROGRAM_KEYS);
	if (record === null) return failed(reader);
	const kind = reader.tag(record.kind, '$.kind', [EXECUTION_PROGRAM_KIND]);
	if (kind === null) return failed(reader);
	if (record.formatVersion !== EXECUTION_PROGRAM_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${EXECUTION_PROGRAM_FORMAT_VERSION}`);
		return failed(reader);
	}
	const capabilities = readArray(reader, record.capabilities, '$.capabilities', (entry, entryPath) =>
		readCapability(reader, entry, entryPath)
	);
	const experienceId = reader.opaqueId(record.experienceId, '$.experienceId');
	const presentations = readArray(reader, record.presentations, '$.presentations', (entry, entryPath) =>
		readPresentation(reader, entry, entryPath)
	);
	const stops = readArray(reader, record.stops, '$.stops', (entry, entryPath) => readStop(reader, entry, entryPath));
	const state = readArray(reader, record.state, '$.state', (entry, entryPath) => readState(reader, entry, entryPath));
	const localTime = readArray(reader, record.localTime, '$.localTime', (entry, entryPath) =>
		readLocalTime(reader, entry, entryPath)
	);
	const channels = readArray(reader, record.channels, '$.channels', (entry, entryPath) =>
		readChannel(reader, entry, entryPath)
	);
	const lifecycle = readArray(reader, record.lifecycle, '$.lifecycle', (entry, entryPath) =>
		readLifecycle(reader, entry, entryPath)
	);
	const profileRecord = reader.object(record.profile, '$.profile', PROFILE_KEYS);
	let profile: ExecutionProgram['profile'] | null = null;
	if (profileRecord !== null) {
		const reducedMotion = reader.tag(profileRecord.reducedMotion, '$.profile.reducedMotion', ['required']);
		const semanticDomNavigation = reader.tag(profileRecord.semanticDomNavigation, '$.profile.semanticDomNavigation', ['required']);
		if (reducedMotion !== null && semanticDomNavigation !== null) {
			profile = { reducedMotion: 'required', semanticDomNavigation: 'required' };
		}
	}
	const entryStopId =
		record.entryStopId === null ? null : reader.opaqueId(record.entryStopId, '$.entryStopId');
	if (
		capabilities === null ||
		experienceId === null ||
		entryStopId === undefined ||
		presentations === null ||
		stops === null ||
		state === null ||
		localTime === null ||
		channels === null ||
		lifecycle === null ||
		profile === null
	) {
		return failed(reader);
	}
	if (reader.issues.length > 0) return failed(reader);

	if (!uniqueIds(reader, capabilities.map((entry) => entry.id), '$.capabilities', 'capability')) return failed(reader);
	if (!uniqueIds(reader, presentations.map((entry) => entry.id), '$.presentations', 'presentation')) return failed(reader);
	if (!uniqueIds(reader, stops.map((entry) => entry.id), '$.stops', 'stop')) return failed(reader);
	if (!uniqueIds(reader, state.map((entry) => entry.id), '$.state', 'state declaration')) return failed(reader);
	if (!uniqueIds(reader, localTime.map((entry) => entry.stopId), '$.localTime', 'local-time mapping')) return failed(reader);
	if (!uniqueIds(reader, channels.map((entry) => entry.id), '$.channels', 'channel policy')) return failed(reader);

	const presentationIds = new Set(presentations.map((entry) => entry.id));
	const stopIds = new Set(stops.map((entry) => entry.id));
	const stateIds = new Set(state.map((entry) => entry.id));
	const allContentIds = presentations.flatMap((entry) => entry.content.map((record) => record.id));
	if (!uniqueIds(reader, allContentIds, '$.presentations', 'content record')) return failed(reader);
	const contentIds = new Set(allContentIds);
	const stateById = new Map(state.map((entry) => [entry.id, entry]));

	for (const [index, stop] of stops.entries()) {
		const path = `$.stops[${index}]`;
		if (!presentationIds.has(stop.presentationId)) {
			reader.problem(`${path}.presentationId`, 'missing-presentation', `${path}.presentationId names no presentation`);
		}
		const presentation = presentations.find((entry) => entry.id === stop.presentationId);
		if (stop.invocation.kind === 'cut' && presentation !== undefined && stop.invocation.viewId !== presentation.viewId) {
			reader.problem(`${path}.invocation.viewId`, 'view-mismatch', 'a Cut must realize its Presentation view');
		}
		if (stop.continuation.kind === 'stop' && !stopIds.has(stop.continuation.stopId)) {
			reader.problem(`${path}.continuation.stopId`, 'missing-stop', `${path}.continuation.stopId names no stop`);
		}
	}
	if (stops.length === 0) {
		if (entryStopId !== null) {
			reader.problem('$.entryStopId', 'missing-stop', '$.entryStopId must be null when the program carries no stops');
		}
	} else if (entryStopId === null || !stopIds.has(entryStopId)) {
		reader.problem('$.entryStopId', 'missing-stop', '$.entryStopId must name one of the program stops');
	}
	for (const [index, mapping] of localTime.entries()) {
		const stop = stops.find((entry) => entry.id === mapping.stopId);
		if (stop !== undefined && stop.holdSeconds !== mapping.holdSeconds) {
			reader.problem(`$.localTime[${index}].holdSeconds`, 'hold-mismatch', 'the local-time mapping must agree with its Stop hold');
		}
		if (!stopIds.has(mapping.stopId)) {
			reader.problem(`$.localTime[${index}].stopId`, 'missing-stop', `$.localTime[${index}].stopId names no stop`);
		}
	}
	for (const [index, entry] of lifecycle.entries()) {
		const path = `$.lifecycle[${index}]`;
		checkAction(reader, entry.action, `${path}.action`, { stopIds, stateIds, contentIds });
		if (entry.action.kind === 'set-state') {
			checkStateValue(reader, stateById.get(entry.action.stateId), entry.action.value, `${path}.action.value`);
		}
		if (entry.guard !== null) checkGuard(reader, entry.guard, `${path}.guard`, stateById);
	}
	if (reader.issues.length > 0) return failed(reader);

	return {
		success: true,
		value: {
			kind: EXECUTION_PROGRAM_KIND,
			formatVersion: EXECUTION_PROGRAM_FORMAT_VERSION,
			capabilities,
			experienceId,
			entryStopId,
			presentations,
			stops,
			state,
			localTime,
			channels,
			lifecycle,
			profile
		},
		ignoredOptionalExtensions: capabilities.filter((entry) => !entry.required).map((entry) => entry.id)
	};
}

function readStop(reader: ShapeReader, input: unknown, path: string): ProgramStop | null {
	const record = reader.object(input, path, STOP_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const presentationId = reader.opaqueId(record.presentationId, `${path}.presentationId`);
	const invocation = readInvocation(reader, record.invocation, `${path}.invocation`);
	const holdSeconds =
		record.holdSeconds === null ? null : reader.numberAtLeast(record.holdSeconds, `${path}.holdSeconds`, 0, false);
	const continuation = readContinuation(reader, record.continuation, `${path}.continuation`);
	if (id === null || presentationId === null || invocation === null || continuation === null) return null;
	if (record.holdSeconds !== null && holdSeconds === null) return null;
	return { id, presentationId, invocation, holdSeconds, continuation };
}

function readState(reader: ShapeReader, input: unknown, path: string): ProgramStateDeclaration | null {
	const record = reader.object(input, path, STATE_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const type = reader.tag(record.type, `${path}.type`, ['boolean', 'choice']);
	const values = reader.opaqueIdArray(record.values, `${path}.values`);
	if (id === null || type === null || values === null) return null;
	if (values.length !== new Set(values).size) {
		reader.problem(`${path}.values`, 'duplicate-identity', `${path}.values repeats a declared value`);
		return null;
	}
	if (type === 'boolean') {
		if (values.length > 0) {
			reader.problem(`${path}.values`, 'out-of-range', `${path}.values must be empty for a boolean state`);
			return null;
		}
		const initial = reader.boolean(record.initial, `${path}.initial`);
		const reset = reader.boolean(record.reset, `${path}.reset`);
		if (initial === null || reset === null) return null;
		return { id, type: 'boolean', values, initial, reset };
	}
	if (values.length === 0) {
		reader.problem(`${path}.values`, 'out-of-range', `${path}.values must declare at least one value for a choice state`);
		return null;
	}
	const initial = reader.opaqueId(record.initial, `${path}.initial`);
	const reset = reader.opaqueId(record.reset, `${path}.reset`);
	if (initial === null || reset === null) return null;
	if (!values.includes(initial) || !values.includes(reset)) {
		reader.problem(`${path}.initial`, 'out-of-range', `${path}.initial and ${path}.reset must be declared values`);
		return null;
	}
	return { id, type: 'choice', values, initial, reset };
}

function readLocalTime(reader: ShapeReader, input: unknown, path: string): ProgramLocalTime | null {
	const record = reader.object(input, path, LOCALTIME_KEYS);
	if (record === null) return null;
	const stopId = reader.opaqueId(record.stopId, `${path}.stopId`);
	const holdSeconds = reader.numberAtLeast(record.holdSeconds, `${path}.holdSeconds`, 0, false);
	if (stopId === null || holdSeconds === null) return null;
	return { stopId, holdSeconds };
}

function readChannel(reader: ShapeReader, input: unknown, path: string): ProgramChannelPolicy | null {
	const record = reader.object(input, path, CHANNEL_KEYS);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const family = reader.string(record.family, `${path}.family`);
	const policy = reader.tag(record.policy, `${path}.policy`, ['exclusive', 'shared-inspection']);
	if (id === null || family === null || policy === null) return null;
	return { id, family, policy: policy as ProgramChannelPolicy['policy'] };
}

function readLifecycle(reader: ShapeReader, input: unknown, path: string): ProgramLifecycleAction | null {
	const record = reader.object(input, path, LIFECYCLE_KEYS);
	if (record === null) return null;
	const event = reader.tag(record.event, `${path}.event`, PROGRAM_EVENTS);
	const action = readAction(reader, record.action, `${path}.action`);
	const guard = record.guard === null ? null : readGuard(reader, record.guard, `${path}.guard`);
	if (event === null || action === null || (record.guard !== null && guard === null)) return null;
	return { event: event as ProgramLifecycleAction['event'], action, guard };
}

function checkAction(
	reader: ShapeReader,
	action: ProgramAction,
	path: string,
	scope: { stopIds: ReadonlySet<string>; stateIds: ReadonlySet<string>; contentIds: ReadonlySet<string> }
): void {
	if (action.kind === 'navigate-to' && !scope.stopIds.has(action.stopId)) {
		reader.problem(`${path}.stopId`, 'missing-stop', `${path}.stopId names no stop`);
	}
	if (action.kind === 'show-content' && !scope.contentIds.has(action.contentId)) {
		reader.problem(`${path}.contentId`, 'missing-content', `${path}.contentId names no content record`);
	}
	if (action.kind === 'set-state' && !scope.stateIds.has(action.stateId)) {
		reader.problem(`${path}.stateId`, 'missing-state', `${path}.stateId names no state declaration`);
	}
}

function checkStateValue(reader: ShapeReader, state: ProgramStateDeclaration | undefined, value: string | boolean, path: string): void {
	if (state === undefined) return; // the reference check reports the missing declaration
	if (state.type === 'boolean' ? typeof value !== 'boolean' : typeof value !== 'string' || !state.values.includes(value)) {
		reader.problem(path, 'out-of-range', 'the value is outside the referenced state declaration');
	}
}

function checkGuard(reader: ShapeReader, guard: ProgramGuard, path: string, stateById: ReadonlyMap<string, ProgramStateDeclaration>): void {
	if (guard.kind === 'conjunction') {
		guard.guards.forEach((child, index) => checkGuard(reader, child, `${path}.guards[${index}]`, stateById));
	} else if (guard.kind === 'state' || guard.kind === 'equals') {
		const state = stateById.get(guard.stateId);
		if (state === undefined) reader.problem(`${path}.stateId`, 'missing-state', `the guard reads undeclared state "${guard.stateId}"`);
		else if (guard.kind === 'state' && state.type !== 'boolean') reader.problem(`${path}.stateId`, 'out-of-range', 'a state-read guard requires boolean state');
		else if (guard.kind === 'equals') checkStateValue(reader, state, guard.value, `${path}.value`);
	}
}

/** Parse `ExecutionProgram@1` JSON. Invalid JSON is a reported issue, never a throw. */
export function parseExecutionProgram(json: string): ShapeValidation<ExecutionProgram> {
	let input: unknown;
	try {
		input = JSON.parse(json) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
		return { success: false, issues: [{ path: '$', code: 'invalid_json', message }] };
	}
	return validateExecutionProgram(input);
}

/** Canonical writer: validate first, then serialize. Nothing invalid is written. */
export function serializeExecutionProgram(program: unknown): string {
	const result = validateExecutionProgram(program);
	if (!result.success) {
		const first = result.issues[0]!;
		throw new Error(`${first.path} (${first.code}): ${first.message}`);
	}
	return JSON.stringify(result.value, null, 2) + '\n';
}

/** True when a capability the program requires is not in `supported`. */
export function unsupportedRequiredCapabilities(
	program: ExecutionProgram,
	supported: readonly string[]
): string[] {
	const admitted = new Set(supported);
	return program.capabilities.filter((entry) => entry.required && !admitted.has(entry.id)).map((entry) => entry.id);
}
