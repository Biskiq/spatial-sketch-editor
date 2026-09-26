/**
 * P23B.5 §0.6 — the reuse-counter ratchet: one measurement, one recorder.
 *
 * The perf-lane gate (`tests/lib/bench/p23b5-reuse-budget.test.ts`) and the
 * `reuse:record` CLI must measure the SAME thing, or a re-record would quietly
 * bless a different measurement than the one the gate checks. Both therefore use
 * the runner below, and both use the same invariant checker: the gate asserts it
 * is empty, and the recorder REFUSES to write a record that violates it.
 *
 * Mirrors the P23B.0 baseline recorder (`record-baseline.ts` +
 * `record-baseline.cli.ts`):
 *
 * - the default suite never writes the record — only the CLI does, and only
 *   after `--reason` is supplied;
 * - a re-record requires a CLEAN source tree, so `recordedCommit` names the state
 *   that actually produced the counts. That is why the flow is: commit the
 *   behaviour change, run `npm run reuse:record -w @portfolio/editor --
 *   --reason "…"`, then commit the updated record (amend it into that change if
 *   you want them in one commit);
 * - the hand-written policy prose in the record (`identityScope`,
 *   `changePolicy`, `outOfScope`, `method`) is preserved verbatim. The recorder
 *   owns only the measured fields: `cases`, `recordedReason`, `recordedAt`,
 *   `recordedCommit`.
 *
 * These counts are DETERMINISTIC (fixed drag points on committed fixtures), so —
 * unlike the P23B.0 timings — no machine/browser provenance is recorded and no
 * tolerance is applied. The invariants are absolute, and only the counts
 * themselves ratchet.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
	clearWallSamplingObserverForTest,
	createWallFirstArchitectureVerdictScope,
	createWallSamplingDerivation,
	proposeWallFirstArchitectureGeometry,
	setWallSamplingObserverForTest,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallFirstArchitectureVerdictScopeStats,
	type WallSamplingDerivation
} from '@portfolio/layout-core';
import type { LayoutArchitectureEditGesture } from '$lib/editor/layout/layout-interaction';
import {
	architectureEditProposalIntent,
	transientArchitectureEdit,
	type LayoutTransientArchitectureEdit
} from '$lib/editor/layout/layout-transient-edit';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from './p23b-fixtures';

const APPS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REPO_ROOT = resolve(APPS_ROOT, '../..');

/** The committed record the gate reads and the recorder is the only writer of. */
export const REUSE_RATCHET_PATH = resolve(
	REPO_ROOT,
	'docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json'
);

/** The fixed drag every case uses: the first Junction, three pointermoves. */
export const REUSE_RATCHET_MOVES = [0.05, 0.1, 0.15] as const;

/** The shortest `--reason` accepted; a placeholder is not a reason. */
const MIN_REASON_LENGTH = 12;
const PLACEHOLDER_REASONS = new Set(['todo', 'tbd', 'n/a', 'na', 'update', 'updated', 'wip', 're-record']);

export type ReuseRatchetCounters = {
	requests: number;
	derivations: number;
	coldMisses: number;
	refusals: number;
	hits: number;
	entries: number;
	failedDerivations: number;
	cachedUndefined: number;
};

/** One recorded case: what the committed record stores per drag. */
export type ReuseRatchetCase = {
	id: string;
	fixture: string;
	moves: number;
	proposalRequestsPerMove: number[];
	preflightMissesPerMove: number[];
	unscopedPreflightRequests: number;
	counters: ReuseRatchetCounters;
};

export type ReuseRatchetRecord = {
	identityScope: string;
	changePolicy: string;
	outOfScope: string;
	/** Who wrote the record. The initial hand-authored entry predates the CLI, so
	 * it is optional here and always written by a re-record. */
	recordedBy?: string;
	recordedReason: string;
	recordedAt: string;
	recordedCommit: string;
	/** Present only once a re-record has run: the clean-tree precondition it enforced. */
	recordedTree?: 'clean';
	method: { path: string; shape: string; observer: string };
	cases: ReuseRatchetCase[];
};

/**
 * A case plus the evidence an invariant needs but the record does not store: the
 * rendered attempt on both paths (equivalence) and the fresh-call counts the
 * preflight share is derived from.
 */
export type ReuseRatchetMeasurement = ReuseRatchetCase & {
	observedPerMove: number[];
	proposalRequestsPerMove: number[];
	/**
	 * P23B.7 S4 — what the scoped drag's gesture VERDICT set did: the clean
	 * initialization count and the affected-only passes after it. Evidence that
	 * verdict reuse actually ran (a matrix cell is vacuous otherwise); never
	 * recorded, so the committed ratchet stays exactly P23B.5's shape.
	 */
	verdictStats: WallFirstArchitectureVerdictScopeStats | null;
	attempts: { scoped: (LayoutTransientArchitectureEdit | null)[]; unscoped: (LayoutTransientArchitectureEdit | null)[] };
};

type JunctionMoveGesture = Extract<LayoutArchitectureEditGesture, { kind: 'junction-move' }>;

function matrixFixture(id: string): LayoutDocumentWallFirst {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`reuse ratchet: unknown fixture ${id}`);
	return buildP23BMatrixFixture(spec);
}

/** One junction gesture, as the viewport builds it, minus the viewport. */
function junctionGesture(doc: LayoutDocumentWallFirst): JunctionMoveGesture {
	const junctionId = doc.junctions[0]!.id;
	const point = doc.junctions[0]!.point;
	return {
		kind: 'junction-move',
		pointerId: 1,
		junctionId,
		startPointer: [point[0], point[1]] as LayoutVec2,
		baselinePoint: [point[0], point[1]] as LayoutVec2,
		junctionExcludePoints: doc.junctions.map(
			(junction) => [junction.point[0], junction.point[1]] as LayoutVec2
		),
		affectedWallIds: doc.walls
			.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
			.map((wall) => wall.id),
		candidatePoint: [point[0], point[1]] as LayoutVec2,
		valid: false
	};
}

/** Fresh `wallCenterlineSamples` calls made while `work` runs. */
function freshCalls(work: () => void): number {
	let calls = 0;
	setWallSamplingObserverForTest(() => {
		calls += 1;
	});
	try {
		work();
	} finally {
		clearWallSamplingObserverForTest();
	}
	return calls;
}

type DragRun = {
	observedPerMove: number[];
	proposalPerMove: number[];
	attempts: (LayoutTransientArchitectureEdit | null)[];
	verdictStats: WallFirstArchitectureVerdictScopeStats | null;
};

/**
 * P23B.7 S4 — which VERDICT mode a drag runs. `scoped` is the shipped gesture
 * (one clean initialization, then the affected-only pass); `whole-document`
 * retains the pre-S4 pass on every move and exists only so the sample/verdict
 * matrix can hold one axis fixed while the other varies.
 */
export type ReuseRatchetVerdictMode = 'scoped' | 'whole-document';

type DragOptions = {
	/** The bounded sample scope; omitted = the per-call (sampling-disabled) reference. */
	sampling?: WallSamplingDerivation;
	/** The verdict mode; omitted = the shipped scoped one. */
	verdict?: ReuseRatchetVerdictMode;
};

/**
 * Drive one real gesture. With a sample scope, that is the shipped reusing path;
 * without one, it is the per-call reference the scope is measured against. Each
 * drag builds its OWN verdict scope — the viewport's one-gesture lifetime — so a
 * gesture can never inherit another gesture's verdicts (OR-8).
 */
function drag(doc: LayoutDocumentWallFirst, options: DragOptions = {}): DragRun {
	const gesture = junctionGesture(doc);
	const verdictScope =
		options.verdict === 'whole-document' ? null : createWallFirstArchitectureVerdictScope(doc);
	const start = [...gesture.baselinePoint] as LayoutVec2;
	const observedPerMove: number[] = [];
	const proposalPerMove: number[] = [];
	const attempts: (LayoutTransientArchitectureEdit | null)[] = [];
	for (const dx of REUSE_RATCHET_MOVES) {
		gesture.candidatePoint = [start[0] + dx, start[1]];
		const intent = architectureEditProposalIntent(gesture);
		// The proposal is unscoped BY DESIGN (fresh centrelines per intent, whose
		// inputs never repeat), so its share is measured on its own call.
		proposalPerMove.push(freshCalls(() => void proposeWallFirstArchitectureGeometry(doc, intent)));
		let attempt: LayoutTransientArchitectureEdit | null = null;
		observedPerMove.push(
			freshCalls(() => {
				attempt = transientArchitectureEdit({
					gesture,
					baseline: doc,
					moved: true,
					sampling: options.sampling,
					verdictScope
				});
			})
		);
		attempts.push(attempt);
	}
	return { observedPerMove, proposalPerMove, attempts, verdictStats: verdictScope?.stats ?? null };
}

/** The scope's counters, flattened to the recorded shape. */
function countersOf(scope: WallSamplingDerivation): ReuseRatchetCounters {
	const stats = scope.stats;
	return {
		requests: stats.derivations + stats.hits,
		derivations: stats.derivations,
		coldMisses: stats.coldMisses,
		refusals: stats.refusals,
		hits: stats.hits,
		entries: stats.entries,
		failedDerivations: stats.failedDerivations,
		cachedUndefined: stats.cachedUndefined
	};
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

/**
 * Measure one recorded case on the shipped transient path. `options.sampling` is
 * for callers that need to drive the SAME scope across two measurements (the
 * gate's reset check); the recorder and the gate otherwise let the case own its
 * scope, which is the shipped one-gesture lifetime. `options.verdict` holds the
 * VERDICT mode fixed across BOTH drags (S4's sample/verdict matrix varies one
 * axis at a time; the default is the shipped scoped mode, so the recorded
 * ratchet is re-derived through the production path and never a retained
 * pre-S4 one).
 */
export function measureReuseRatchetCase(
	recorded: Pick<ReuseRatchetCase, 'id' | 'fixture'>,
	options: { sampling?: WallSamplingDerivation; verdict?: ReuseRatchetVerdictMode } = {}
): ReuseRatchetMeasurement {
	const doc = matrixFixture(recorded.fixture);
	const scope = options.sampling ?? createWallSamplingDerivation();
	const scoped = drag(doc, { sampling: scope, verdict: options.verdict });
	const unscoped = drag(doc, { verdict: options.verdict });
	return {
		id: recorded.id,
		fixture: recorded.fixture,
		moves: REUSE_RATCHET_MOVES.length,
		observedPerMove: scoped.observedPerMove,
		proposalRequestsPerMove: scoped.proposalPerMove,
		preflightMissesPerMove: scoped.observedPerMove.map(
			(count, index) => count - scoped.proposalPerMove[index]!
		),
		unscopedPreflightRequests: sum(
			unscoped.observedPerMove.map((count, index) => count - unscoped.proposalPerMove[index]!)
		),
		counters: countersOf(scope),
		verdictStats: scoped.verdictStats,
		attempts: { scoped: scoped.attempts, unscoped: unscoped.attempts }
	};
}

/** A measurement reduced to exactly what the record stores. */
export function reuseRatchetCaseOf(measurement: ReuseRatchetMeasurement): ReuseRatchetCase {
	return {
		id: measurement.id,
		fixture: measurement.fixture,
		moves: measurement.moves,
		proposalRequestsPerMove: measurement.proposalRequestsPerMove,
		preflightMissesPerMove: measurement.preflightMissesPerMove,
		unscopedPreflightRequests: measurement.unscopedPreflightRequests,
		counters: measurement.counters
	};
}

/**
 * The ABSOLUTE invariants — never re-recordable, because a violation is a bug
 * rather than a number to update. Shared by the gate (which asserts the list is
 * empty) and the recorder (which refuses to write when it is not).
 */
export function reuseRatchetInvariantViolations(measurements: readonly ReuseRatchetMeasurement[]): string[] {
	const problems: string[] = [];
	for (const measured of measurements) {
		const { id, counters } = measured;
		if (measured.moves !== REUSE_RATCHET_MOVES.length) {
			problems.push(`${id}: ${measured.moves} recorded moves but the drag has ${REUSE_RATCHET_MOVES.length}`);
		}
		if (measured.preflightMissesPerMove.length !== measured.moves || measured.proposalRequestsPerMove.length !== measured.moves) {
			problems.push(`${id}: the per-pointermove series do not cover every move`);
		}
		if (measured.proposalRequestsPerMove.some((count) => !Number.isInteger(count) || count < 0)) {
			problems.push(`${id}: a proposal-stage fresh-call count is not a non-negative integer`);
		}
		if (measured.preflightMissesPerMove.some((count) => !Number.isInteger(count) || count < 0)) {
			problems.push(`${id}: a preflight miss count is not a non-negative integer`);
		}
		if (sum(measured.preflightMissesPerMove) !== counters.derivations) {
			problems.push(
				`${id}: the scope owns exactly the preflight requests and nothing else — ${sum(measured.preflightMissesPerMove)} preflight misses vs ${counters.derivations} scope derivations`
			);
		}
		if (counters.derivations + counters.hits !== measured.unscopedPreflightRequests) {
			problems.push(
				`${id}: the scope does not serve every preflight request — ${counters.derivations} + ${counters.hits} vs ${measured.unscopedPreflightRequests} unscoped`
			);
		}
		if (counters.coldMisses + counters.refusals !== counters.derivations) {
			problems.push(`${id}: a derivation is neither a cold miss nor a changed-input refusal`);
		}
		if (counters.entries !== counters.derivations) {
			problems.push(`${id}: entries ${counters.entries} are not exactly the distinct derived keys ${counters.derivations}`);
		}
		if (counters.failedDerivations !== 0) {
			problems.push(`${id}: ${counters.failedDerivations} failed derives on a valid fixture`);
		}
		if (counters.cachedUndefined !== 0) {
			problems.push(`${id}: ${counters.cachedUndefined} cached undefined served as reuse`);
		}
		if (sum(measured.preflightMissesPerMove) === 0 && counters.requests !== 0) {
			problems.push(`${id}: a case whose preflight samples nothing must not record reuse`);
		}
		if (counters.requests > 0 && counters.coldMisses === 0) {
			problems.push(`${id}: reuse without a cold miss means the scope started warm`);
		}
		if (counters.requests > 0 && counters.hits === 0) {
			problems.push(`${id}: ${counters.requests} requests over ${measured.moves} moves with no hit is not the reusing case`);
		}
		if (!isDeepStrictEqual(measured.attempts.scoped, measured.attempts.unscoped)) {
			problems.push(`${id}: the rendered attempt changed when reuse was enabled`);
		}
	}
	return problems;
}

/** Read the committed record. */
export function readReuseRatchet(path = REUSE_RATCHET_PATH): ReuseRatchetRecord {
	const record = JSON.parse(readFileSync(path, 'utf8')) as ReuseRatchetRecord;
	if (!Array.isArray(record.cases) || record.cases.length === 0) {
		throw new Error(`reuse ratchet ${path} has no cases`);
	}
	return record;
}

/** Stable serialization: 2-space JSON plus a trailing newline, as the baseline uses. */
export function serializeReuseRatchet(record: ReuseRatchetRecord): string {
	return JSON.stringify(record, null, 2) + '\n';
}

export type ReuseRatchetTreeState = { clean: boolean; headSha: string };

/** The real source-tree state: a dirty tree makes `recordedCommit` a lie. */
export function reuseRatchetTreeState(): ReuseRatchetTreeState {
	const git = (args: string[]): string =>
		execFileSync('git', args, { cwd: APPS_ROOT, encoding: 'utf8' }).trim();
	try {
		return { clean: git(['status', '--porcelain']).length === 0, headSha: git(['rev-parse', '--short', 'HEAD']) };
	} catch {
		return { clean: false, headSha: 'local' };
	}
}

export type RecordReuseRatchetOptions = {
	reason: string;
	/** Injected by tests: the tree state and the committed record. */
	treeState?: ReuseRatchetTreeState;
	record?: ReuseRatchetRecord;
	/** Injected by tests: pre-measured cases instead of a real drag. */
	measurements?: readonly ReuseRatchetMeasurement[];
	at?: Date;
};

/** How a reason must read. Exported so the CLI and the tests agree on it. */
export function isUsableRecordReason(reason: string): boolean {
	const trimmed = reason.trim();
	return trimmed.length >= MIN_REASON_LENGTH && !PLACEHOLDER_REASONS.has(trimmed.toLowerCase());
}

/**
 * Produce the next record. Throws — never writes — when the reason is missing or
 * a placeholder, when the source tree is dirty, or when the measurement violates
 * an invariant. The CLI is the only thing that writes the file.
 */
export function recordReuseRatchet(options: RecordReuseRatchetOptions): ReuseRatchetRecord {
	const reason = options.reason?.trim() ?? '';
	if (!isUsableRecordReason(reason)) {
		throw new Error(
			`reuse:record needs a reason of at least ${MIN_REASON_LENGTH} characters describing WHY the counts moved — pass --reason "…"`
		);
	}
	const previous = options.record ?? readReuseRatchet();
	const tree = options.treeState ?? reuseRatchetTreeState();
	if (!tree.clean) {
		throw new Error(
			'reuse:record requires a clean source tree so recordedCommit names the state that produced the counts — commit the behaviour change first, re-record, then commit the updated record'
		);
	}
	// Wrapped, not passed by reference: `Array.map` would hand the index to the
	// `options` parameter.
	const measurements = options.measurements ?? previous.cases.map((entry) => measureReuseRatchetCase(entry));
	if (measurements.length === 0) {
		throw new Error('reuse:record refuses to write a record with no cases');
	}
	const violations = reuseRatchetInvariantViolations(measurements);
	if (violations.length > 0) {
		throw new Error(
			`reuse:record refuses to write an incoherent record — these are bugs, not numbers to update:\n  ${violations.join('\n  ')}`
		);
	}
	return {
		identityScope: previous.identityScope,
		changePolicy: previous.changePolicy,
		outOfScope: previous.outOfScope,
		recordedBy: 'npm run reuse:record',
		recordedReason: reason,
		recordedAt: (options.at ?? new Date()).toISOString().slice(0, 10),
		recordedCommit: tree.headSha,
		recordedTree: 'clean',
		method: previous.method,
		cases: measurements.map(reuseRatchetCaseOf)
	};
}

/**
 * `--reason "…"` parsing, kept out of the CLI so it is testable. Unknown flags are
 * rejected rather than ignored: a typo must not silently record an unstated
 * reason.
 */
export function parseReuseRecordArgs(argv: readonly string[]): { reason: string } {
	let reason: string | undefined;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]!;
		if (arg === '--reason') {
			reason = argv[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith('--reason=')) {
			reason = arg.slice('--reason='.length);
			continue;
		}
		throw new Error(`reuse:record does not take ${arg}`);
	}
	if (reason === undefined) throw new Error('reuse:record requires --reason "…"');
	return { reason };
}
