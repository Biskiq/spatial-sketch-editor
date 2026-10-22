/**
 * Probes 4/5 (interpreter + Camera-output half). Deterministic traces against the landed shared
 * lowering, interpreter, companion and Camera-output ticket protocol. Explicit integer clock only.
 */
import { describe, expect, it } from 'vitest';
import {
	acquireCameraOutput,
	cancelCameraOutput,
	createCameraOutputState,
	createEmptyWallFirstLayoutDocument,
	rebaseCameraOutputSource,
	type CameraOutputTicket
} from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	buildExperienceCompanion,
	computeEnvelopeSourceContentId,
	createExperienceRun,
	createProjectEnvelope,
	lowerExperienceProgram,
	reduceExperience,
	type ExecutionProgram,
	type ExperienceRunState
} from '@portfolio/project-model/units';

async function envelope() {
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Specimen',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: 'unit-scene', data: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [] } },
		camera: {
			unitId: 'unit-camera',
			data: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [
					{ id: 'view-1', label: 'Whole', eye: [0, 1.5, 3], target: [0, 1, 0], fov: 50, connectedViewIds: [] },
					{ id: 'view-2', label: 'Lid', eye: [0, 2, 1], target: [0, 1, 0], fov: 35, connectedViewIds: [] }
				],
				connections: []
			}
		},
		experience: {
			unitId: 'unit-experience',
			data: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [
					{
						id: 'standalone', label: 'Object in itself', entryGuideId: null,
						presentations: [{ id: 'p-object', label: 'The specimen', viewId: 'view-1' }],
						stops: [], guides: [], gates: [], detours: []
					},
					{
						id: 'guided', label: 'Guide', entryGuideId: 'g1',
						presentations: [
							{ id: 'p-whole', label: 'Whole', viewId: 'view-1' },
							{ id: 'p-lid', label: 'Lid', viewId: 'view-2' }
						],
						stops: [
							{ id: 's1', presentationId: 'p-whole', holdSeconds: 2 },
							{ id: 's2', presentationId: 'p-lid', continuation: { kind: 'end' } }
						],
						guides: [{ id: 'g1', label: 'Tour', stopIds: ['s1', 's2'], entryStopId: 's1' }],
						gates: [], detours: []
					}
				]
			}
		},
		resources: { unitId: 'unit-resources', data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] } }
	});
}

describe('Guide-free Presentation over the landed program path', () => {
	it('lowers, but the interpreter cannot show a Presentation that no Stop occurs', async () => {
		const env = await envelope();
		const sourceContentId = await computeEnvelopeSourceContentId(env);
		const lowered = lowerExperienceProgram(env, {
			experienceId: 'standalone', sourceContentId, sessionEpoch: 's1',
			content: [{ presentationId: 'p-object', records: [{ id: 't1', text: 'The lid is hinged at the back.' }] }]
		});
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		const program = lowered.program;
		console.log('STANDALONE PROGRAM', JSON.stringify({ entry: program.entryStopId, stops: program.stops.length, presentations: program.presentations }));
		const run = createExperienceRun(program, { runId: 'r1', runEpoch: 1, sourceContentId });
		const entered = reduceExperience(program, run, { kind: 'enter', runId: 'r1', runEpoch: 1 }, { runId: 'r1', runEpoch: 1, sourceContentId });
		const companion = buildExperienceCompanion(program, entered.state);
		console.log('STANDALONE ENTER', entered.state.phase, JSON.stringify(entered.effects), 'panel', JSON.stringify(entered.state.panel));
		console.log('STANDALONE COMPANION presentations', JSON.stringify(companion.presentations), 'current', JSON.stringify(companion.current));
		expect(program.entryStopId).toBeNull();
		expect(entered.state.phase).toBe('completed');
		expect(entered.state.panel).toBeNull();
		expect(entered.effects).toEqual([{ kind: 'completed' }]);
		// The companion lists the Presentation as a destination, but no event reaches it:
		// ExperienceEvent has no "present" / "activate presentation" kind and navigate needs a Stop.
		expect(companion.presentations.map((p) => p.presentationId)).toEqual(['p-object']);
		expect(companion.presentations[0]!.stopIds).toEqual([]);
	});
});

describe('Stop-bearing runs: stale, cancel, reset, re-entry and source rebase', () => {
	it('enforces run ownership, idempotent terminal cancel and same-run reset', async () => {
		const env = await envelope();
		const sourceContentId = await computeEnvelopeSourceContentId(env);
		const lowered = lowerExperienceProgram(env, {
			experienceId: 'guided', sourceContentId, sessionEpoch: 's1',
			bindings: [{ stopId: 's2', invocation: { kind: 'cut', viewId: 'view-2' } }]
		});
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		const program: ExecutionProgram = lowered.program;
		const optsA = { runId: 'run-a', runEpoch: 1, sourceContentId, transitions: lowered.transitions };
		const optsB = { runId: 'run-b', runEpoch: 2, sourceContentId, transitions: lowered.transitions };
		const trace: string[] = [];
		const step = (label: string, state: ExperienceRunState, event: Parameters<typeof reduceExperience>[2], opts: typeof optsA) => {
			const r = reduceExperience(program, state, event, opts);
			trace.push(`${label}: ${r.outcome} phase=${r.state.phase} run=${r.state.runId}@${r.state.runEpoch} stop=${r.state.stopId} occ=${r.state.occurrenceId} effects=${r.effects.map((e) => e.kind).join(',') || '-'}`);
			return r.state;
		};
		let a = createExperienceRun(program, optsA);
		a = step('A enter', a, { kind: 'enter', runId: 'run-a', runEpoch: 1 }, optsA);
		a = step('A tick 1000 (half hold)', a, { kind: 'tick', runId: 'run-a', runEpoch: 1, milliseconds: 1000 }, optsA);
		a = step('A cancel', a, { kind: 'cancel', runId: 'run-a', runEpoch: 1 }, optsA);
		a = step('A cancel again', a, { kind: 'cancel', runId: 'run-a', runEpoch: 1 }, optsA);
		let b = createExperienceRun(program, optsB);
		b = step('B enter (re-entry = new run)', b, { kind: 'enter', runId: 'run-b', runEpoch: 2 }, optsB);
		b = step('A late complete -> B', b, { kind: 'complete', runId: 'run-a', runEpoch: 1 }, optsB);
		b = step('A late continue -> B', b, { kind: 'continue', runId: 'run-a', runEpoch: 1 }, optsB);
		a = step('A late complete -> A', a, { kind: 'complete', runId: 'run-a', runEpoch: 1 }, optsA);
		b = step('B tick 2000', b, { kind: 'tick', runId: 'run-b', runEpoch: 2, milliseconds: 2000 }, optsB);
		b = step('B continue', b, { kind: 'continue', runId: 'run-b', runEpoch: 2 }, optsB);
		b = step('B reset (same run)', b, { kind: 'reset', runId: 'run-b', runEpoch: 2 }, optsB);
		const rebased = { ...optsB, sourceContentId: 'sha256-edited-source' };
		b = step('B event after source edit', b, { kind: 'continue', runId: 'run-b', runEpoch: 2 }, rebased);
		// A completion that was in flight BEFORE the same-run reset carries the same runId/epoch
		// and is indistinguishable from a post-reset event: it is accepted and ends the rewound run.
		b = step('pre-reset late complete -> B after reset', b, { kind: 'complete', runId: 'run-b', runEpoch: 2 }, optsB);
		console.log('INTERPRETER TRACE\n' + trace.join('\n'));
		expect(trace[3]).toMatch(/^A cancel again: ignored/);
		expect(trace[5]).toMatch(/^A late complete -> B: stale/);
		expect(trace[6]).toMatch(/^A late continue -> B: stale/);
		expect(trace[10]).toMatch(/run=run-b@2 stop=s1 occ=run-b:s1:1/);
		expect(trace[11]).toMatch(/^B event after source edit: stale/);
		expect(trace[12]).toMatch(/^pre-reset late complete -> B after reset: accepted phase=completed/);
	});

	it('Camera output tickets: replacement, stale cancel, idempotent cancel, rebase', () => {
		const ticket = (ownerId: string, runEpoch: number): CameraOutputTicket => ({ outputId: 'out-1', sourceRevision: 'rev-1', sessionEpoch: 's1', ownerId, runEpoch });
		let state = createCameraOutputState({ outputId: 'out-1', viewportId: 'vp-1', sessionEpoch: 's1', sourceRevision: 'rev-1' });
		const trace: string[] = [];
		const a = acquireCameraOutput(state, { ticket: ticket('run-a', 1), role: 'preview', expected: { kind: 'unowned' }, policy: 'exclusive' });
		state = a.state; trace.push(`acquire A: ${a.kind}`);
		const b = acquireCameraOutput(state, { ticket: ticket('run-b', 2), role: 'preview', expected: { kind: 'held', ticket: ticket('run-a', 1) }, policy: 'ordered-replacement' });
		state = b.state; trace.push(`replace by B: ${b.kind}`);
		const staleA = cancelCameraOutput(state, ticket('run-a', 1));
		state = staleA.state; trace.push(`cancel with A: ${staleA.kind}${staleA.kind === 'ignored' ? `:${staleA.reason}` : ''}`);
		const cb = cancelCameraOutput(state, ticket('run-b', 2));
		state = cb.state; trace.push(`cancel B: ${cb.kind}`);
		const cb2 = cancelCameraOutput(state, ticket('run-b', 2));
		state = cb2.state; trace.push(`cancel B again: ${cb2.kind}`);
		const reacquireA = acquireCameraOutput(state, { ticket: ticket('run-a', 1), role: 'preview', expected: { kind: 'unowned' }, policy: 'exclusive' });
		trace.push(`old A re-acquire: ${reacquireA.kind}${reacquireA.kind === 'refused' ? `:${reacquireA.reason}` : ''}`);
		const c = acquireCameraOutput(state, { ticket: ticket('run-c', 3), role: 'preview', expected: { kind: 'unowned' }, policy: 'exclusive' });
		state = c.state;
		const rebase = rebaseCameraOutputSource(state, 'rev-2');
		trace.push(`rebase with C held: ${rebase.kind}${rebase.kind === 'rebased' ? ` ended=${rebase.ended?.ticket.ownerId}` : ''}`);
		console.log('CAMERA TICKET TRACE\n' + trace.join('\n'));
		expect(staleA.kind).toBe('ignored');
		expect(reacquireA.kind).toBe('refused');
		expect(rebase.kind).toBe('rebased');
	});
});
