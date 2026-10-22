/**
 * `ExecutionProgram@2` conformance (AM-6).
 *
 * The codec freezes before the interpreter and the first authoring surface
 * exist, so the fixtures here are hand-authored and non-empty: they cover
 * repeated Stops sharing one Presentation, both invocations (Cut and directed
 * Travel), a finite hold with Continue, an explicit non-adjacent continuation,
 * typed state with initialization/reset, a bounded guard, channel policy and the
 * run-scoped lifecycle actions. The refusals cover the failure the interpreter
 * must never have to guess about: a program whose required meaning is missing.
 */
import { describe, expect, it } from 'vitest';

import {
	parseExecutionProgram,
	serializeExecutionProgram,
	unsupportedRequiredCapabilities,
	validateExecutionProgram,
	type ExecutionProgram
} from '@portfolio/project-model/program';

function program(overrides: Partial<ExecutionProgram> = {}): ExecutionProgram {
	return {
		kind: 'execution-program',
		formatVersion: 2,
		capabilities: [
			{ id: 'profile.reduced-motion', required: true },
			{ id: 'panel.info', required: false }
		],
		experienceId: 'experience-a',
		entryStopId: 'stop-1',
		presentations: [
			{
				id: 'presentation-1',
				label: 'Piano',
				viewIds: ['view-1'],
				defaultViewId: 'view-1',
				content: [{ id: 'content-1', kind: 'text', text: 'A restored piano.' }]
			},
			{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], defaultViewId: 'view-2', content: [] }
		],
		stops: [
			{
				id: 'stop-1',
				presentationId: 'presentation-1',
				viewId: 'view-1',
				invocation: { kind: 'cut', viewId: 'view-1' },
				holdSeconds: 2,
				continuation: { kind: 'sequence-next' }
			},
			{
				id: 'stop-2',
				presentationId: 'presentation-2',
				viewId: 'view-2',
				invocation: { kind: 'travel', connectionId: 'connection-1' },
				holdSeconds: null,
				continuation: { kind: 'stop', stopId: 'stop-1' }
			},
			// A second visit to one Presentation, sharing no Stop identity with stop-1.
			{
				id: 'stop-3',
				presentationId: 'presentation-1',
				viewId: 'view-1',
				invocation: { kind: 'cut', viewId: 'view-1' },
				holdSeconds: 0,
				continuation: { kind: 'end' }
			}
		],
		state: [
			{ id: 'state-seen', type: 'boolean', values: [], initial: false, reset: false },
			{ id: 'state-room', type: 'choice', values: ['piano', 'gallery'], initial: 'piano', reset: 'piano' }
		],
		localTime: [{ stopId: 'stop-1', holdSeconds: 2 }],
		channels: [{ id: 'channel-1', family: 'camera.session-inspection', policy: 'exclusive' }],
		lifecycle: [
			{ event: 'enter', action: { kind: 'show-content', contentId: 'content-1' }, guard: null },
			{
				event: 'arrival',
				action: { kind: 'set-state', stateId: 'state-room', value: 'gallery' },
				guard: { kind: 'equals', stateId: 'state-room', value: 'piano' }
			},
			{
				event: 'complete',
				action: { kind: 'navigate-to', stopId: 'stop-3' },
				guard: {
					kind: 'conjunction',
					guards: [{ kind: 'state', stateId: 'state-seen' }, { kind: 'literal', value: true }]
				}
			}
		],
		profile: { reducedMotion: 'required', semanticDomNavigation: 'required' },
		...overrides
	};
}

function codes(input: unknown): string[] {
	const result = validateExecutionProgram(input);
	expect(result.success).toBe(false);
	return result.success ? [] : result.issues.map((issue) => issue.code);
}

describe('the program round trips', () => {
	it('accepts an empty program with explicit empties and a null entry', () => {
		const empty = program({
			capabilities: [],
			entryStopId: null,
			presentations: [],
			stops: [],
			state: [],
			localTime: [],
			channels: [],
			lifecycle: []
		});
		const result = validateExecutionProgram(empty);
		expect(result.success).toBe(true);
		expect(parseExecutionProgram(serializeExecutionProgram(empty)).success).toBe(true);
	});

	it('round trips a non-empty program through its canonical writer', () => {
		const written = serializeExecutionProgram(program());
		const parsed = parseExecutionProgram(written);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.value).toEqual(program());
		expect(JSON.parse(written)).toEqual(program());
	});

	it('reports invalid JSON as an issue rather than throwing', () => {
		const parsed = parseExecutionProgram('{ not json');
		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(parsed.issues[0]!.code).toBe('invalid_json');
	});

	it('refuses to write an invalid program', () => {
		expect(() => serializeExecutionProgram({ kind: 'execution-program' })).toThrow();
	});
});

describe('required kind, version and capability negotiation', () => {
	it('refuses an unknown kind, an unsupported version and an unknown key', () => {
		expect(codes({ ...program(), kind: 'visitor-program' })).toContain('unknown-tag');
		expect(codes({ ...program(), formatVersion: 3 })).toContain('unsupported_format_version');
		expect(codes({ ...program(), extra: true })).toContain('unknown-key');
	});

	it('names the required capabilities a consumer does not support and ignores optional ones', () => {
		const result = validateExecutionProgram(program());
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.ignoredOptionalExtensions).toEqual(['panel.info']);
		expect(unsupportedRequiredCapabilities(result.value, ['panel.info'])).toEqual(['profile.reduced-motion']);
		expect(unsupportedRequiredCapabilities(result.value, ['profile.reduced-motion'])).toEqual([]);
	});

	it('requires both bounded profile capabilities', () => {
		expect(codes({ ...program(), profile: { reducedMotion: 'optional', semanticDomNavigation: 'required' } })).toContain(
			'unknown-tag'
		);
		expect(codes({ ...program(), profile: undefined })).toContain('not-an-object');
	});
});

describe('the strict invocation, timing and continuation rules', () => {
	it('refuses a cut that carries a connection and a travel that carries a view', () => {
		const stops = program().stops.map((stop) =>
			stop.id === 'stop-1' ? { ...stop, invocation: { kind: 'cut', viewId: 'view-1', connectionId: 'c-1' } } : stop
		);
		expect(codes({ ...program(), stops })).toContain('unknown-key');

		const travelling = program().stops.map((stop) =>
			stop.id === 'stop-2' ? { ...stop, invocation: { kind: 'travel', connectionId: 'c-1', viewId: 'view-1' } } : stop
		);
		expect(codes({ ...program(), stops: travelling })).toContain('unknown-key');
	});

	it('refuses a negative, non-finite or missing hold and an unknown continuation kind', () => {
		const negative = program().stops.map((stop) => (stop.id === 'stop-1' ? { ...stop, holdSeconds: -1 } : stop));
		expect(codes({ ...program(), stops: negative })).toContain('out-of-range');

		const nonFinite = program().stops.map((stop) => (stop.id === 'stop-1' ? { ...stop, holdSeconds: Infinity } : stop));
		expect(codes({ ...program(), stops: nonFinite })).toContain('non-finite-number');

		const noHold = program().stops.map((stop) => {
			const { holdSeconds, ...rest } = stop;
			return rest;
		});
		expect(codes({ ...program(), stops: noHold })).toContain('non-finite-number');

		const badContinuation = program().stops.map((stop) =>
			stop.id === 'stop-1' ? { ...stop, continuation: { kind: 'loop' } } : stop
		);
		expect(codes({ ...program(), stops: badContinuation })).toContain('unknown-tag');
	});

	it('refuses an entry that names no stop and a non-null entry with no stops', () => {
		expect(codes({ ...program(), entryStopId: 'stop-absent' })).toContain('missing-stop');
		expect(codes({ ...program(), stops: [], entryStopId: 'stop-1', localTime: [] })).toContain('missing-stop');
	});

	it('refuses a continuation to a stop the program does not carry', () => {
		const stops = program().stops.map((stop) =>
			stop.id === 'stop-2' ? { ...stop, continuation: { kind: 'stop', stopId: 'stop-absent' } } : stop
		);
		expect(codes({ ...program(), stops })).toContain('missing-stop');
	});

	it('refuses a stop whose presentation is absent, and duplicated identities', () => {
		const stops = program().stops.map((stop) =>
			stop.id === 'stop-3' ? { ...stop, presentationId: 'presentation-absent' } : stop
		);
		expect(codes({ ...program(), stops })).toContain('missing-presentation');
		expect(validateExecutionProgram(program()).success).toBe(true);
		expect(
			codes({ ...program(), presentations: [...program().presentations, program().presentations[0]!] })
		).toContain('duplicate-identity');
	});

	it('refuses a local-time mapping outside the stops and above the finite range', () => {
		expect(codes({ ...program(), localTime: [{ stopId: 'stop-absent', holdSeconds: 1 }] })).toContain('missing-stop');
		expect(codes({ ...program(), localTime: [{ stopId: 'stop-1', holdSeconds: -2 }] })).toContain('out-of-range');
	});
});

describe('typed scoped state and bounded guards', () => {
	it('refuses a boolean state with values and a choice whose initial value is outside its scope', () => {
		expect(
			codes({
				...program(),
				state: [{ id: 'state-seen', type: 'boolean', values: ['on'], initial: false, reset: false }]
			})
		).toContain('out-of-range');
		expect(
			codes({
				...program(),
				state: [{ id: 'state-room', type: 'choice', values: ['piano'], initial: 'gallery', reset: 'piano' }]
			})
		).toContain('out-of-range');
		expect(
			codes({ ...program(), state: [{ id: 'state-room', type: 'choice', values: [], initial: 'piano', reset: 'piano' }] })
		).toContain('out-of-range');
	});

	it('refuses a guard that reads undeclared state and an empty conjunction', () => {
		expect(
			codes({
				...program(),
				lifecycle: [
					{ event: 'enter', action: { kind: 'continue' }, guard: { kind: 'state', stateId: 'state-undeclared' } }
				]
			})
		).toContain('missing-state');
		expect(
			codes({
				...program(),
				lifecycle: [{ event: 'enter', action: { kind: 'continue' }, guard: { kind: 'conjunction', guards: [] } }]
			})
		).toContain('empty-conjunction');
	});

	it('refuses an action outside its declared scope and an unknown event or policy', () => {
		expect(
			codes({
				...program(),
				lifecycle: [{ event: 'enter', action: { kind: 'navigate-to', stopId: 'stop-absent' }, guard: null }]
			})
		).toContain('missing-stop');
		expect(
			codes({
				...program(),
				lifecycle: [{ event: 'wander', action: { kind: 'continue' }, guard: null }]
			})
		).toContain('unknown-tag');
		expect(
			codes({ ...program(), channels: [{ id: 'channel-1', family: 'camera', policy: 'shared-write' }] })
		).toContain('unknown-tag');
	});
});


describe('independent AM-6 admission regressions', () => {
	it('refuses fields belonging to another guard/action variant instead of dropping them', () => {
		expect(codes({ ...program(), lifecycle: [{ event: 'enter', action: { kind: 'continue', url: 'https://example.com' }, guard: null }] })).toContain('unknown-key');
		expect(codes({ ...program(), lifecycle: [{ event: 'enter', action: { kind: 'continue' }, guard: { kind: 'literal', value: true, stateId: 'state-seen' } }] })).toContain('unknown-key');
	});

	it('type-checks assignments, equality values and boolean state reads against declarations', () => {
		for (const action of [
			{ kind: 'set-state', stateId: 'state-room', value: 'absent' },
			{ kind: 'set-state', stateId: 'state-seen', value: 'true' }
		]) expect(codes({ ...program(), lifecycle: [{ event: 'enter', action, guard: null }] })).toContain('out-of-range');
		for (const guard of [
			{ kind: 'state', stateId: 'state-room' },
			{ kind: 'equals', stateId: 'state-room', value: true },
			{ kind: 'equals', stateId: 'state-room', value: 'absent' }
		]) expect(codes({ ...program(), lifecycle: [{ event: 'enter', action: { kind: 'continue' }, guard }] })).toContain('out-of-range');
	});

	it('refuses ambiguous global content identities and inconsistent Cut/hold meanings', () => {
		const duplicate = program().presentations.map((presentation) => ({ ...presentation, content: [{ id: 'same', kind: 'text', text: 'Text' }] }));
		expect(codes({ ...program(), presentations: duplicate })).toContain('duplicate-identity');
		expect(codes({ ...program(), stops: program().stops.map((stop) => stop.id === 'stop-1'
			? { ...stop, invocation: { kind: 'cut', viewId: 'view-2' } } : stop) })).toContain('view-mismatch');
		expect(codes({ ...program(), localTime: [{ stopId: 'stop-1', holdSeconds: 3 }] })).toContain('hold-mismatch');
	});

	it('admits absolute HTTP(S) activation URLs and refuses executable or relative URLs', () => {
		for (const url of ['https://example.com/info', 'http://example.com/info']) expect(validateExecutionProgram({ ...program(),
			lifecycle: [{ event: 'enter', action: { kind: 'open-url', url }, guard: null }] }).success).toBe(true);
		for (const url of ['javascript:alert(1)', 'data:text/html,content', '/relative', 'invalid']) expect(codes({ ...program(),
			lifecycle: [{ event: 'enter', action: { kind: 'open-url', url }, guard: null }] })).toContain('invalid-url');
	});

	it('bounds recursive guards and preserves the actual lifecycle diagnostic path', () => {
		let guard: unknown = { kind: 'literal', value: true };
		for (let index = 0; index < 100; index++) guard = { kind: 'conjunction', guards: [guard] };
		expect(codes({ ...program(), lifecycle: [{ event: 'enter', action: { kind: 'continue' }, guard }] })).toContain('guard-too-deep');
		const result = validateExecutionProgram({ ...program(), lifecycle: [
			{ event: 'enter', action: { kind: 'continue' }, guard: null },
			{ event: 'arrival', action: { kind: 'continue' }, guard: { kind: 'state', stateId: 'absent' } }
		] });
		expect(!result.success && result.issues[0]!.path).toBe('$.lifecycle[1].guard.stateId');
	});
});
