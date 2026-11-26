/**
 * The Slice's development diagnostics: failed cap assembly is never silent.
 *
 * Plan §2.2 requires a `CapAssemblyIssue` to reach a developer the moment a Layout
 * group fails to balance, and requires QA to be able to read a counter. A render
 * layer that only hands `issues` to an optional callback satisfies neither: if the
 * Canvas forgets to pass one, an open group draws its edges and says nothing.
 *
 * So the report is a module seam with two outputs, both dev-only:
 *
 * - `console.error` **once per group and geometry revision** — a Sheet drag bumps
 *  the revision constantly and must not flood the console; a real edit is a new
 *  revision and will be heard again.
 * - `globalThis.__STAGE_SLICE_DIAGNOSTICS__` — a counter (and the groups that
 *  reported) QA reads from the console, so "zero issues" is checkable rather than
 *  assumed.
 *
 * Production builds keep the counter's shape but publish nothing: it is a
 * development surface, never a runtime behaviour.
 */
import type { CapAssemblyIssue } from './mesh-plane-section';

/** What QA reads in a dev build. */
export type SliceDiagnosticsCounter = {
	/** Issues seen for the current geometry revision. */
	readonly capIssues: number;
	/** The union groups that failed to balance, in first-report order. */
	readonly groups: readonly string[];
	/** The geometry revision the counts belong to. */
	readonly revision: string | number;
};

type ErrorPort = { error(message: string, ...rest: readonly unknown[]): void };

const GLOBAL_KEY = '__STAGE_SLICE_DIAGNOSTICS__';

/** One revision's already-reported groups; a new revision starts reporting again. */
let revision: string | number | null = null;
let reported = new Set<string>();

/** `console.error` once per group per revision; returns how many lines were written. */
function report(
	issues: readonly CapAssemblyIssue[],
	current: string | number,
	port: ErrorPort,
): number {
	if (revision !== current) {
		revision = current;
		reported = new Set<string>();
	}
	let lines = 0;
	for (const issue of issues) {
		if (reported.has(issue.group)) continue;
		reported.add(issue.group);
		lines += 1;
		port.error(
			`slice: cap group "${issue.group}" did not balance (${issue.identity}, ${issue.unmatchedVertices} unmatched vertices). Its edges are drawn and no cap is filled.`,
			issue,
		);
	}
	return lines;
}

/** Publish the counter where QA reads it. Never throws: diagnostics must not break a frame. */
function publish(
	counter: SliceDiagnosticsCounter,
	sink?: (counter: SliceDiagnosticsCounter) => void,
): void {
	try {
		(globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY] = counter;
	} catch {
		// A frozen or absent global is not a reason to lose the console report.
	}
	sink?.(counter);
}

export type CapIssueReport = SliceDiagnosticsCounter & {
	/** Console lines written by this call (0 when the revision has not changed). */
	readonly logged: number;
};

/**
 * Report one assembly's issues.
 *
 * `error` is injectable so a test asserts the report without spying on a global
 * console; the default is the real one.
 */
export function reportCapIssues(
	issues: readonly CapAssemblyIssue[],
	current: string | number,
	options: {
		readonly error?: ErrorPort['error'];
		readonly sink?: (counter: SliceDiagnosticsCounter) => void;
	} = {},
): CapIssueReport {
	if (!import.meta.env.DEV) {
		return {
			capIssues: issues.length,
			groups: issues.map((issue) => issue.group),
			revision: current,
			logged: 0,
		};
	}
	const error = options.error ?? console.error.bind(console);
	const logged = report(issues, current, { error });
	const counter: SliceDiagnosticsCounter = {
		capIssues: issues.length,
		groups: [...new Set(issues.map((issue) => issue.group))],
		revision: current,
	};
	publish(counter, options.sink);
	return { ...counter, logged };
}

/** The counter as it currently stands, or null before the first assembly (tests, QA). */
export function readCapIssues(): SliceDiagnosticsCounter | null {
	const value = (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY];
	return value === undefined ? null : (value as SliceDiagnosticsCounter);
}

/** Reset the module's dedupe memory. Tests only; no behaviour depends on it. */
export function resetCapIssueReporting(): void {
	revision = null;
	reported = new Set<string>();
}
