/**
 * `F3.channels@1:camera-handoff-v1` — the additive Experience handoff discipline
 * over the landed Camera-output ticket protocol (T3.P01.S03).
 *
 * The suite proves the rules this module adds, not the landed protocol it
 * delegates to: only a handoff role may receive the output, a same-role takeover
 * is not a handoff, handoff cleanup never ends an inspection/navigation claim,
 * and a return restores the displaced run under a strictly newer epoch.
 */
import { describe, expect, it } from 'vitest';

import {
	acquireCameraOutput,
	beginExperienceNavigation,
	cancelCameraHandoff,
	cleanupCameraHandoff,
	createCameraOutputState,
	endExperienceNavigation,
	handoffCameraOutput,
	pendingCameraHandoff,
	returnCameraHandoff,
	requestCameraOutput,
	type CameraOutputState,
	type CameraOutputTicket
} from '@portfolio/project-model';

const OUTPUT = 'output:session-1:0';
const SOURCE = 'source-1';
const SESSION = 'session-1';

function state(): CameraOutputState {
	return createCameraOutputState({ outputId: OUTPUT, viewportId: 'stage', sessionEpoch: SESSION, sourceRevision: SOURCE });
}

function ticket(ownerId: string, runEpoch: number): CameraOutputTicket {
	return { outputId: OUTPUT, sourceRevision: SOURCE, sessionEpoch: SESSION, ownerId, runEpoch };
}

function inspection(state: CameraOutputState, runEpoch = 1): CameraOutputState {
	const decision = acquireCameraOutput(state, {
		ticket: ticket('inspection-run', runEpoch),
		role: 'inspection',
		expected: { kind: 'unowned' },
		policy: 'exclusive'
	});
	if (decision.kind !== 'acquired') throw new Error(`inspection acquisition failed: ${decision.reason}`);
	return decision.state;
}

describe('camera handoff — acquisition', () => {
	it('hands the output to a Follow run and records the displaced run obligation', () => {
		const held = inspection(state());
		const decision = handoffCameraOutput(held, {
			ticket: ticket('follow-run', 2),
			role: 'follow',
			expected: { kind: 'held', ticket: ticket('inspection-run', 1) },
			returnToken: 'return-inspection'
		});
		expect(decision.kind).toBe('acquired');
		if (decision.kind !== 'acquired') return;
		expect(decision.claim.role).toBe('follow');
		expect(decision.replaced?.role).toBe('inspection');
		expect(pendingCameraHandoff(decision.state)).toEqual({
			role: 'inspection',
			ownerId: 'inspection-run',
			runEpoch: 1,
			returnToken: 'return-inspection'
		});
	});

	it('refuses a handoff to a role that is not an Experience handoff role', () => {
		const held = inspection(state());
		const decision = handoffCameraOutput(held, {
			ticket: ticket('free-run', 2),
			role: 'free-navigation' as never,
			expected: { kind: 'held', ticket: ticket('inspection-run', 1) },
			returnToken: 'return-inspection'
		});
		expect(decision).toMatchObject({ kind: 'refused', reason: 'unsupported-role' });
		expect(held.claim?.role).toBe('inspection');
	});

	it('refuses a same-role takeover as a handoff', () => {
		const held = inspection(state());
		const first = handoffCameraOutput(held, {
			ticket: ticket('follow-run', 2),
			role: 'follow',
			expected: { kind: 'held', ticket: ticket('inspection-run', 1) },
			returnToken: 'return-inspection'
		});
		if (first.kind !== 'acquired') throw new Error('handoff must be acquired');
		const second = handoffCameraOutput(first.state, {
			ticket: ticket('follow-run-2', 3),
			role: 'follow',
			expected: { kind: 'held', ticket: ticket('follow-run', 2) },
			returnToken: 'return-follow'
		});
		expect(second).toMatchObject({ kind: 'refused', reason: 'invalid-request' });
		expect(pendingCameraHandoff(first.state)?.role).toBe('inspection');
	});
});

describe('camera handoff — guided and free ownership', () => {
	it('moves guided ownership to free as an ordered replacement', () => {
		const guided = beginExperienceNavigation(state(), {
			ticket: ticket('guided-run', 1),
			mode: 'guided-navigation',
			expected: { kind: 'unowned' }
		});
		if (guided.kind !== 'acquired') throw new Error('guided acquisition failed');
		const free = beginExperienceNavigation(guided.state, {
			ticket: ticket('free-run', 2),
			mode: 'free-navigation',
			expected: { kind: 'held', ticket: ticket('guided-run', 1) }
		});
		expect(free.kind).toBe('acquired');
		if (free.kind !== 'acquired') return;
		expect(free.claim.role).toBe('free-navigation');
		expect(free.replaced?.role).toBe('guided-navigation');
		expect(pendingCameraHandoff(free.state)).toBeNull();
		// The displaced guided run cannot reclaim or continue.
		expect(requestCameraOutput(free.state, ticket('guided-run', 1))).toMatchObject({ kind: 'superseded' });
	});

	it('refuses to preempt a Follow run from navigation', () => {
		const held = inspection(state());
		const follow = handoffCameraOutput(held, {
			ticket: ticket('follow-run', 2),
			role: 'follow',
			expected: { kind: 'held', ticket: ticket('inspection-run', 1) },
			returnToken: 'return-inspection'
		});
		if (follow.kind !== 'acquired') throw new Error('handoff must be acquired');
		const navigation = beginExperienceNavigation(follow.state, {
			ticket: ticket('guided-run', 3),
			mode: 'guided-navigation',
			expected: { kind: 'held', ticket: ticket('follow-run', 2) }
		});
		expect(navigation).toMatchObject({ kind: 'refused', reason: 'invalid-request' });
		expect(follow.state.claim?.role).toBe('follow');
		expect(pendingCameraHandoff(follow.state)?.role).toBe('inspection');
	});

	it('ends navigation without ending a handoff claim', () => {
		const guided = beginExperienceNavigation(state(), {
			ticket: ticket('guided-run', 1),
			mode: 'guided-navigation',
			expected: { kind: 'unowned' }
		});
		if (guided.kind !== 'acquired') throw new Error('guided acquisition failed');
		expect(endExperienceNavigation(guided.state, ticket('guided-run', 1))).toMatchObject({ kind: 'cancelled' });

		const held = inspection(state());
		expect(endExperienceNavigation(held, ticket('inspection-run', 1))).toMatchObject({
			kind: 'ignored',
			reason: 'unsupported-role'
		});
	});

	it('ignores stale-run cleanup and never clears the newer output', () => {
		const first = beginExperienceNavigation(state(), {
			ticket: ticket('guided-run', 1),
			mode: 'guided-navigation',
			expected: { kind: 'unowned' }
		});
		if (first.kind !== 'acquired') throw new Error('guided acquisition failed');
		const free = beginExperienceNavigation(first.state, {
			ticket: ticket('free-run', 2),
			mode: 'free-navigation',
			expected: { kind: 'held', ticket: ticket('guided-run', 1) }
		});
		if (free.kind !== 'acquired') throw new Error('free acquisition failed');
		const stale = cleanupCameraHandoff(free.state, ticket('guided-run', 1));
		expect(stale).toMatchObject({ kind: 'ignored', reason: 'stale-run-epoch' });
		expect(stale.state.claim?.ticket.ownerId).toBe('free-run');
	});
});

describe('camera handoff — return and cleanup', () => {
	it('restores the displaced run under a strictly newer epoch and spends the returning ticket', () => {
		const held = inspection(state());
		const handoff = handoffCameraOutput(held, {
			ticket: ticket('follow-run', 2),
			role: 'follow',
			expected: { kind: 'held', ticket: ticket('inspection-run', 1) },
			returnToken: 'return-inspection'
		});
		if (handoff.kind !== 'acquired') throw new Error('handoff must be acquired');

		const returned = returnCameraHandoff(handoff.state, ticket('follow-run', 2), 'return-inspection');
		expect(returned.kind).toBe('returned');
		if (returned.kind !== 'returned') return;
		expect(returned.claim.role).toBe('inspection');
		expect(returned.claim.ticket.ownerId).toBe('inspection-run');
		expect(returned.claim.ticket.runEpoch).toBe(3);
		expect(pendingCameraHandoff(returned.state)).toBeNull();
		// The returning run's ticket is spent: it can no longer continue the output.
		expect(requestCameraOutput(returned.state, ticket('follow-run', 2))).toMatchObject({ kind: 'superseded' });
	});

	it('refuses a return from a run that did not receive a handoff', () => {
		const held = inspection(state());
		expect(returnCameraHandoff(held, ticket('inspection-run', 1), 'return-inspection')).toMatchObject({
			kind: 'refused',
			reason: 'unsupported-role'
		});
	});

	it('ends a handoff run and voids the return obligation it still held', () => {
		const held = inspection(state());
		const handoff = handoffCameraOutput(held, {
			ticket: ticket('look-through-run', 2),
			role: 'look-through',
			expected: { kind: 'held', ticket: ticket('inspection-run', 1) },
			returnToken: 'return-inspection'
		});
		if (handoff.kind !== 'acquired') throw new Error('handoff must be acquired');
		// A second handoff replaces the first and voids its pending return.
		const preview = handoffCameraOutput(handoff.state, {
			ticket: ticket('preview-run', 3),
			role: 'preview',
			expected: { kind: 'held', ticket: ticket('look-through-run', 2) },
			returnToken: 'return-look-through'
		});
		if (preview.kind !== 'acquired') throw new Error('second handoff must be acquired');
		expect(preview.voidedReturn?.token).toBe('return-inspection');

		const cancelled = cancelCameraHandoff(preview.state, ticket('preview-run', 3));
		expect(cancelled.kind).toBe('cancelled');
		if (cancelled.kind !== 'cancelled') return;
		expect(cancelled.state.claim).toBeNull();
		expect(pendingCameraHandoff(cancelled.state)).toBeNull();
	});

	it('treats return and cleanup of a free output as an idempotent no-op', () => {
		// No claim: there is no displaced run to return to and no handoff to end, so
		// cleanup is idempotent rather than an error, and nothing is fabricated.
		const free = state();
		expect(pendingCameraHandoff(free)).toBeNull();

		const returned = returnCameraHandoff(free, ticket('any-run', 2), 'return-any');
		expect(returned).toMatchObject({ kind: 'refused', reason: 'not-owner' });
		if (returned.kind === 'refused') expect(returned.state.claim).toBeNull();

		const cancelled = cancelCameraHandoff(free, ticket('any-run', 2));
		expect(cancelled).toMatchObject({ kind: 'cancelled', voidedReturn: null });
		expect(cancelled.state.claim).toBeNull();
	});

	it('does not end an inspection claim through handoff cleanup', () => {
		const held = inspection(state());
		const cancelled = cancelCameraHandoff(held, ticket('inspection-run', 1));
		expect(cancelled).toMatchObject({ kind: 'ignored', reason: 'unsupported-role' });
		expect(held.claim?.role).toBe('inspection');
	});
});
