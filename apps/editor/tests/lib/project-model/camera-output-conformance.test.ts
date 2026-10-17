/**
 * F.3 Camera-output ticket protocol conformance (AM-3) — part of the T1.P01.S01
 * provider for `F3.channels@1`.
 *
 * `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}` through
 * acquire / request / replace / return / cancel, plus the source-lifetime
 * transition (`rebaseCameraOutputSource`). The targeted traces cover the
 * failure orders that matter: a source change across a handoff, two outputs in
 * one host session, nested handoffs, disclosure to a superseded caller, the
 * epoch ceiling and session replacement.
 *
 * The last case is a bounded exhaustive exploration: every action sequence up to
 * a fixed depth over a small alphabet, checked against invariants stated
 * independently of the implementation (one qualified holder, strictly increasing
 * ownership order, no re-entry of a retired ticket, refusals change nothing,
 * foreign tickets change nothing, a rebase leaves nothing from the old source).
 * It proves properties, not expected outputs. No Camera runtime exists here.
 */
import { describe, expect, it } from 'vitest';

import {
	MAX_CAMERA_OUTPUT_RUN_EPOCH,
	acquireCameraOutput,
	cancelCameraOutput,
	createCameraOutputState,
	rebaseCameraOutputSource,
	replaceCameraOutput,
	requestCameraOutput,
	returnCameraOutput,
	validateCameraOutputTicket,
	type CameraOutputDecision,
	type CameraOutputPolicy,
	type CameraOutputState,
	type CameraOutputTicket
} from '@portfolio/project-model';

const R1 = 'sha256-source-1';
const R2 = 'sha256-source-2';

function output(outputId = 'output-1', sourceRevision = R1): CameraOutputState {
	return createCameraOutputState({ outputId, viewportId: 'viewport-1', sessionEpoch: 'session-1', sourceRevision });
}

function ticket(ownerId: string, runEpoch: number, overrides: Partial<CameraOutputTicket> = {}): CameraOutputTicket {
	return { outputId: 'output-1', sourceRevision: R1, sessionEpoch: 'session-1', ownerId, runEpoch, ...overrides };
}

function acquire(
	state: CameraOutputState,
	next: CameraOutputTicket,
	policy: CameraOutputPolicy = 'exclusive',
	returnToken?: string
): CameraOutputDecision {
	return acquireCameraOutput(state, {
		ticket: next,
		role: policy === 'ordered-handoff' ? 'preview' : 'inspection',
		expected: state.claim === null ? { kind: 'unowned' } : { kind: 'held', ticket: state.claim.ticket },
		policy,
		returnToken
	});
}

function held(decision: { kind: string; state: CameraOutputState }): CameraOutputState {
	if (decision.kind !== 'acquired' && decision.kind !== 'returned' && decision.kind !== 'cancelled' && decision.kind !== 'rebased') {
		throw new Error(`the fixture expected a transition, got ${JSON.stringify(decision)}`);
	}
	return decision.state;
}

const refusal = (decision: { kind: string; reason?: string }) => (decision.kind === 'refused' || decision.kind === 'ignored' ? decision.reason : decision.kind);

describe('F.3 Camera output — tickets and exclusive ownership', () => {
	it('validates ticket shapes strictly', () => {
		expect(validateCameraOutputTicket(ticket('a', 0)).valid).toBe(true);
		expect(validateCameraOutputTicket({ ...ticket('a', 0), extra: 1 }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...ticket('a', 0), outputId: '' }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...ticket('a', 0), runEpoch: -1 }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...ticket('a', 0), runEpoch: 0.5 }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...ticket('a', 0), runEpoch: MAX_CAMERA_OUTPUT_RUN_EPOCH + 1 }).valid).toBe(false);
	});

	it('acquires one exclusive owner and refuses a competing, stale or unsupported request', () => {
		const a1 = held(acquire(output(), ticket('a', 1)));
		const competing = acquire(a1, ticket('b', 2));
		expect(competing).toMatchObject({ kind: 'refused', reason: 'competing-exclusive-owner', owners: ['a'], state: a1 });
		const staleObservation = acquireCameraOutput(a1, { ticket: ticket('b', 2), role: 'inspection', expected: { kind: 'unowned' }, policy: 'ordered-replacement' });
		expect(refusal(staleObservation)).toBe('stale-observation');
		expect(refusal(acquire(a1, ticket('b', 1), 'ordered-replacement'))).toBe('stale-run-epoch');
		expect(refusal(acquireCameraOutput(output(), { ticket: ticket('a', 1), role: 'orbit' as never, expected: { kind: 'unowned' }, policy: 'exclusive' }))).toBe(
			'unsupported-role'
		);
		expect(refusal(acquire(a1, ticket('b', 2), 'ordered-handoff'))).toBe('invalid-request');
	});
});

describe('F.3 Camera output — output identity and host session', () => {
	it('isolates two outputs of one host session: a ticket for one never controls the other', () => {
		// Output and viewport are distinct identities; the realising viewport never qualifies a ticket.
		const first = output('output-1');
		const second = createCameraOutputState({ outputId: 'output-2', viewportId: 'output-1', sessionEpoch: 'session-1', sourceRevision: R1 });
		const one = held(acquire(first, ticket('a', 1)));
		const two = held(acquire(second, ticket('b', 1, { outputId: 'output-2' })));
		const forOne = ticket('a', 1);
		// Output-1's holder ticket cannot acquire, request, return to or cancel output-2 — even
		// though output-2 is realised by a viewport whose id equals output-1's id.
		expect(refusal(acquire(output('output-2'), forOne))).toBe('foreign-output');
		expect(refusal(requestCameraOutput(two, forOne))).toBe('foreign-output');
		expect(refusal(returnCameraOutput(two, forOne, 'any'))).toBe('foreign-output');
		const cancel = cancelCameraOutput(two, forOne);
		expect(cancel).toMatchObject({ kind: 'ignored', reason: 'foreign-output', state: two });
		expect(cancelCameraOutput(output('output-2'), forOne).kind).toBe('ignored');
		// Each output's own holder still works.
		expect(requestCameraOutput(one, forOne).kind).toBe('accepted');
		expect(requestCameraOutput(two, ticket('b', 1, { outputId: 'output-2' })).kind).toBe('accepted');
	});

	it('qualifies every ticket against the host session, free or held, and a new session restarts ordering', () => {
		const foreign = ticket('a', 1, { sessionEpoch: 'session-0' });
		expect(refusal(acquire(output(), foreign))).toBe('stale-session-epoch');
		const a1 = held(acquire(output(), ticket('a', 1)));
		expect(refusal(requestCameraOutput(a1, foreign))).toBe('stale-session-epoch');
		expect(refusal(cancelCameraOutput(a1, { ...ticket('a', 1), sessionEpoch: 'session-0' }))).toBe('stale-session-epoch');
		// Session replacement is a new state: ordering starts again, and old tickets stay refused.
		const replacement = createCameraOutputState({ outputId: 'output-1', viewportId: 'viewport-1', sessionEpoch: 'session-2', sourceRevision: R1 });
		expect(refusal(acquire(replacement, ticket('a', 2)))).toBe('stale-session-epoch');
		expect(acquire(replacement, ticket('a', 0, { sessionEpoch: 'session-2' })).kind).toBe('acquired');
	});
});

describe('F.3 Camera output — source lifetime', () => {
	it('R1 → handoff → R2: the source change ends the claim, voids the return and admits only R2 tickets', () => {
		const a1 = held(acquire(output(), ticket('a', 1)));
		const handoff = acquire(a1, ticket('b', 2), 'ordered-handoff', 'back');
		const b2 = held(handoff);
		const rebase = rebaseCameraOutputSource(b2, R2);
		expect(rebase.kind).toBe('rebased');
		if (rebase.kind !== 'rebased') return;
		// The ended claim and its pending return are reported, not dropped silently.
		expect(rebase.ended?.ticket).toEqual(ticket('b', 2));
		expect(rebase.voidedReturn?.issuedTo).toEqual(ticket('a', 1));
		const atR2 = rebase.state;
		expect([atR2.claim, atR2.sourceRevision, atR2.epochFloor]).toEqual([null, R2, 2]);

		// Nothing issued for R1 can return, request, cancel or re-acquire the output.
		expect(refusal(returnCameraOutput(atR2, ticket('b', 2), 'back'))).toBe('stale-source-revision');
		expect(refusal(requestCameraOutput(atR2, ticket('b', 2)))).toBe('stale-source-revision');
		expect(refusal(cancelCameraOutput(atR2, ticket('a', 1)))).toBe('stale-source-revision');
		expect(refusal(acquire(atR2, ticket('a', 9)))).toBe('stale-source-revision');
		// An R2 run acquires the free output, strictly after every epoch ever accepted.
		expect(refusal(acquire(atR2, ticket('c', 2, { sourceRevision: R2 })))).toBe('stale-run-epoch');
		const c3 = held(acquire(atR2, ticket('c', 3, { sourceRevision: R2 })));
		// And an R1 run cannot block it: a stale handoff over the R2 holder is refused.
		expect(refusal(acquire(c3, ticket('a', 4), 'ordered-replacement'))).toBe('stale-source-revision');

		// Rebasing to the source the output already reads (an Undo to identical content) ends nothing.
		expect(rebaseCameraOutputSource(c3, R2)).toEqual({ kind: 'unchanged', state: c3 });
		expect(refusal(rebaseCameraOutputSource(c3, ''))).toBe('invalid-request');
	});
});

describe('F.3 Camera output — handoff, return and cancellation', () => {
	it('hands off in order and returns under a strictly newer epoch, so no spent ticket re-enters', () => {
		const a1 = held(acquire(output(), ticket('a', 1)));
		const handoff = replaceCameraOutput(a1, { ticket: ticket('b', 2), role: 'preview', expected: { kind: 'held', ticket: ticket('a', 1) }, returnToken: 'back' });
		const b2 = held(handoff);
		expect(refusal(returnCameraOutput(b2, ticket('b', 2), 'wrong'))).toBe('invalid-return-token');
		expect(refusal(returnCameraOutput(b2, ticket('a', 1), 'back'))).toBe('not-owner');
		const returned = returnCameraOutput(b2, ticket('b', 2), 'back');
		expect(returned.kind).toBe('returned');
		if (returned.kind !== 'returned') return;
		expect([returned.claim.ticket.ownerId, returned.claim.role, returned.claim.ticket.runEpoch]).toEqual(['a', 'inspection', 3]);
		// The pre-handoff ticket and the returning ticket are both spent.
		expect(requestCameraOutput(returned.state, ticket('a', 1))).toEqual({ kind: 'superseded', state: returned.state, owners: ['a'] });
		expect(requestCameraOutput(returned.state, ticket('b', 2)).kind).toBe('superseded');
		expect(refusal(acquire(returned.state, ticket('a', 1), 'ordered-replacement'))).toBe('stale-run-epoch');
		expect(refusal(cancelCameraOutput(returned.state, ticket('b', 2)))).toBe('stale-run-epoch');
	});

	it('answers a superseded caller with the holder’s owner only, never a reusable ticket', () => {
		const a1 = held(acquire(output(), ticket('a', 1)));
		const b2 = held(acquire(a1, ticket('b', 2), 'ordered-replacement'));
		const superseded = requestCameraOutput(b2, ticket('a', 1));
		expect(superseded).toEqual({ kind: 'superseded', state: b2, owners: ['b'] });
		expect(JSON.stringify(superseded)).not.toContain('"runEpoch":2,');
		// A run that was never accepted is refused, not told it was superseded.
		expect(refusal(requestCameraOutput(b2, ticket('c', 7)))).toBe('not-owner');
		expect(refusal(requestCameraOutput(output(), ticket('a', 1)))).toBe('not-owner');
	});

	it('voids a nested handoff’s displaced return and reports it, then refuses the deeper unwind', () => {
		const a1 = held(acquire(output(), ticket('a', 1)));
		const b2 = held(acquire(a1, ticket('b', 2), 'ordered-handoff', 'to-a'));
		const nested = acquire(b2, ticket('c', 3), 'ordered-handoff', 'to-b');
		expect(nested.kind).toBe('acquired');
		if (nested.kind !== 'acquired') return;
		// C displaced B, whose own pending return to A can no longer be honoured: reported here.
		expect(nested.voidedReturn).toMatchObject({ token: 'to-a', issuedTo: ticket('a', 1) });
		const toB = returnCameraOutput(nested.state, ticket('c', 3), 'to-b');
		if (toB.kind !== 'returned') throw new Error(toB.reason);
		expect([toB.claim.ticket.ownerId, toB.claim.ticket.runEpoch, toB.claim.returnContext]).toEqual(['b', 4, null]);
		expect(refusal(returnCameraOutput(toB.state, toB.claim.ticket, 'to-a'))).toBe('invalid-return-token');
		// Cancelling a handed-off claim also reports the return it voids.
		const cancelled = cancelCameraOutput(b2, ticket('b', 2));
		expect(cancelled.kind === 'cancelled' && cancelled.voidedReturn?.token).toBe('to-a');
	});

	it('makes cancellation epoch-qualified and idempotent, and keeps the cancelled epoch spent', () => {
		const a1 = held(acquire(output(), ticket('a', 1)));
		const b2 = held(acquire(a1, ticket('b', 2), 'ordered-replacement'));
		expect(cancelCameraOutput(b2, ticket('a', 1))).toMatchObject({ kind: 'ignored', reason: 'stale-run-epoch', state: b2 });
		expect(cancelCameraOutput(b2, ticket('c', 2))).toMatchObject({ kind: 'ignored', reason: 'not-owner', state: b2 });
		const free = held(cancelCameraOutput(b2, ticket('b', 2)));
		expect(free.claim).toBeNull();
		expect(cancelCameraOutput(free, ticket('b', 2))).toEqual({ kind: 'cancelled', state: free, voidedReturn: null });
		expect(refusal(acquire(free, ticket('b', 2)))).toBe('stale-run-epoch');
	});

	it('keeps ownership order strictly increasing at the run-epoch ceiling', () => {
		const top = held(acquire(output(), ticket('a', MAX_CAMERA_OUTPUT_RUN_EPOCH - 1)));
		const handedOff = held(acquire(top, ticket('b', MAX_CAMERA_OUTPUT_RUN_EPOCH), 'ordered-handoff', 'back'));
		// A return would need an epoch above the ceiling, so it is refused rather than minting an equal one.
		expect(refusal(returnCameraOutput(handedOff, ticket('b', MAX_CAMERA_OUTPUT_RUN_EPOCH), 'back'))).toBe('stale-run-epoch');
		expect(refusal(acquire(handedOff, ticket('c', MAX_CAMERA_OUTPUT_RUN_EPOCH), 'ordered-replacement'))).toBe('stale-run-epoch');
		// The ceiling holder can still release the output.
		expect(cancelCameraOutput(handedOff, ticket('b', MAX_CAMERA_OUTPUT_RUN_EPOCH)).kind).toBe('cancelled');
	});
});

describe('F.3 Camera output — bounded exhaustive invariants', () => {
	type World = {
		state: CameraOutputState;
		/** Every ticket the output has ever accepted as a holder, in order. */
		history: readonly CameraOutputTicket[];
		/** Holder tickets that have since stopped holding. */
		retired: ReadonlySet<string>;
		sources: readonly string[];
	};
	type Step = { label: string; run: (world: World) => { kind: string; state: CameraOutputState } };

	const key = (value: CameraOutputTicket) =>
		JSON.stringify([value.outputId, value.sourceRevision, value.sessionEpoch, value.ownerId, value.runEpoch]);

	function steps(world: World): Step[] {
		const { state } = world;
		const next = Math.max(state.epochFloor, -1) + 1;
		const current = state.sourceRevision;
		const holder = state.claim?.ticket ?? null;
		const latest = world.history.at(-1) ?? null;
		const earlier = world.history.at(-2) ?? null;
		const list: Step[] = [];
		for (const ownerId of ['a', 'b']) {
			for (const policy of ['exclusive', 'ordered-handoff'] as const) {
				list.push({ label: `acquire ${ownerId}@${next} ${policy}`, run: (w) => acquire(w.state, ticket(ownerId, next, { sourceRevision: current }), policy, 'token') });
			}
		}
		list.push({ label: 'acquire spent epoch', run: (w) => acquire(w.state, ticket('a', Math.max(state.epochFloor, 0), { sourceRevision: current }), 'ordered-replacement') });
		list.push({ label: 'acquire foreign output', run: (w) => acquire(w.state, ticket('a', next, { outputId: 'output-2', sourceRevision: current }), 'ordered-replacement') });
		const old = world.sources.find((source) => source !== current);
		if (old !== undefined) list.push({ label: 'acquire old source', run: (w) => acquire(w.state, ticket('a', next, { sourceRevision: old }), 'ordered-replacement') });
		if (holder !== null) {
			list.push({ label: 'return holder', run: (w) => returnCameraOutput(w.state, holder, 'token') });
			list.push({ label: 'cancel holder', run: (w) => cancelCameraOutput(w.state, holder) });
		}
		for (const past of [latest, earlier]) {
			if (past === null || (holder !== null && key(past) === key(holder))) continue;
			list.push({ label: `request ${key(past)}`, run: (w) => requestCameraOutput(w.state, past) });
			list.push({ label: `return ${key(past)}`, run: (w) => returnCameraOutput(w.state, past, 'token') });
			list.push({ label: `cancel ${key(past)}`, run: (w) => cancelCameraOutput(w.state, past) });
		}
		if (world.sources.length < 3) {
			const source = `sha256-source-${world.sources.length + 1}`;
			list.push({ label: `rebase ${source}`, run: (w) => rebaseCameraOutputSource(w.state, source) });
		}
		return list;
	}

	function check(before: World, step: Step, trace: readonly string[]): World {
		const label = [...trace, step.label].join(' → ');
		const frozen = JSON.stringify(before.state);
		const decision = step.run(before);
		const after = decision.state;
		// Purity: the input state is never mutated.
		expect(JSON.stringify(before.state), label).toBe(frozen);
		const changed = after !== before.state;
		// A refusal or an ignored action changes nothing.
		if (decision.kind === 'refused' || decision.kind === 'ignored' || decision.kind === 'superseded' || decision.kind === 'accepted' || decision.kind === 'unchanged') {
			expect(changed, label).toBe(false);
		}
		// Identity of the output and its session never change; ordering never moves backwards.
		expect([after.outputId, after.viewportId, after.sessionEpoch], label).toEqual([before.state.outputId, before.state.viewportId, before.state.sessionEpoch]);
		expect(after.epochFloor >= before.state.epochFloor, label).toBe(true);
		const claim = after.claim;
		if (claim !== null) {
			// One holder, always qualified for this output, session and current source.
			expect([claim.ticket.outputId, claim.ticket.sessionEpoch, claim.ticket.sourceRevision], label).toEqual([
				after.outputId,
				after.sessionEpoch,
				after.sourceRevision
			]);
			expect(claim.ticket.runEpoch, label).toBe(after.epochFloor);
			if (claim.returnContext !== null) {
				expect([claim.returnContext.issuedTo.sourceRevision, claim.returnContext.sessionEpoch], label).toEqual([after.sourceRevision, after.sessionEpoch]);
			}
		}
		const previous = before.state.claim?.ticket ?? null;
		const now = claim?.ticket ?? null;
		const holderChanged = (previous === null) !== (now === null) || (previous !== null && now !== null && key(previous) !== key(now));
		let history = before.history;
		const retired = new Set(before.retired);
		if (holderChanged) {
			if (previous !== null) retired.add(key(previous));
			if (now !== null) {
				// A new holder is strictly newer than everything accepted before, and never a retired ticket.
				expect(now.runEpoch > before.state.epochFloor, label).toBe(true);
				expect(retired.has(key(now)), label).toBe(false);
				history = [...history, now];
			}
		}
		// A rebase leaves no claim from an older source.
		if (after.sourceRevision !== before.state.sourceRevision) expect(claim, label).toBeNull();
		const sources = before.sources.includes(after.sourceRevision) ? before.sources : [...before.sources, after.sourceRevision];
		return { state: after, history, retired, sources };
	}

	// CPU-bound (an exhaustive walk of every action sequence, >10k of them): 2.3s
	// alone, but the fast lane runs 119 files in parallel, so the default 5s budget
	// measures machine load rather than the invariants this test asserts.
	it('holds every invariant over all action sequences up to depth 5', { timeout: 60_000 }, () => {
		let explored = 0;
		const visit = (world: World, trace: readonly string[], depth: number) => {
			if (depth === 0) return;
			for (const step of steps(world)) {
				explored += 1;
				visit(check(world, step, trace), [...trace, step.label], depth - 1);
			}
		};
		visit({ state: output(), history: [], retired: new Set(), sources: [R1] }, [], 5);
		expect(explored).toBeGreaterThan(10_000);
	});
});
