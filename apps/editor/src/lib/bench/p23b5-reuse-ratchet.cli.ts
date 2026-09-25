import { writeFileSync } from 'node:fs';

import {
	REUSE_RATCHET_PATH,
	measureReuseRatchetCase,
	parseReuseRecordArgs,
	readReuseRatchet,
	recordReuseRatchet,
	serializeReuseRatchet,
	reuseRatchetTreeState
} from './p23b5-reuse-ratchet';

/**
 * CLI entry for `npm run reuse:record`. Re-measures the P23B.5 reuse counters on
 * the shipped transient path and rewrites the committed ratchet
 * (`reuse-counter-ratchet.json`). Kept separate from the measurement/recorder
 * module so importing that module never has a write side effect, and so the
 * default suite can never rewrite the record — the same split the P23B.0
 * baseline uses.
 *
 * A reason is required. The recorder refuses to write without one, refuses a
 * dirty source tree, and refuses a measurement that violates an absolute
 * invariant, so this command can never bless an incoherent counter set.
 */
try {
	const { reason } = parseReuseRecordArgs(process.argv.slice(2));
	const previous = readReuseRatchet();
	const next = recordReuseRatchet({
		reason,
		record: previous,
		measurements: previous.cases.map((entry) => measureReuseRatchetCase(entry))
	});
	writeFileSync(REUSE_RATCHET_PATH, serializeReuseRatchet(next));
	console.log(`[reuse:record] wrote ${REUSE_RATCHET_PATH}`);
	console.log(`[reuse:record] commit ${next.recordedCommit} (clean tree) | ${next.recordedAt}`);
	console.log(`[reuse:record] reason: ${next.recordedReason}`);
	for (const recorded of next.cases) {
		const { counters } = recorded;
		console.log(
			`[reuse:record] ${recorded.id}: requests=${counters.requests} derivations=${counters.derivations} (cold=${counters.coldMisses} + refusals=${counters.refusals}) hits=${counters.hits} entries=${counters.entries}`
		);
	}
	const tree = reuseRatchetTreeState();
	console.log(
		`[reuse:record] the record is now uncommitted${tree.clean ? '' : ' along with other work'}; commit it so the next re-record starts from a clean tree`
	);
} catch (error) {
	console.error(`[reuse:record] ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
