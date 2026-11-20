/**
 * Material diagnostics: one stable, ordered shape for every reader.
 *
 * A diagnostic names what is wrong (`code`), where the authored value is
 * (`path`), which map role and target are affected, and the corrective
 * operation (`action`). It never carries a free-form message: the code and
 * action are the contract a UI or agent can act on.
 *
 * Ordering is part of the contract. Issues sort by `path`, then `role`, then
 * `target`; `code` is the final tie-break so a result is deterministic even when
 * two rules name the same location. An absent role/target sorts before a
 * present one.
 */
import type { MapRole } from './types';

export const MATERIAL_ISSUE_CODES = [
	'unknown-profile',
	'unknown-key',
	'missing-field',
	'invalid-type',
	'invalid-value',
	'out-of-range',
	'invalid-colour',
	'invalid-hash',
	'invalid-local-image',
	'wrong-role-selector',
	'missing-image',
	'missing-pin',
	'missing-palette-slot',
	'unknown-catalogue-base',
	'target-pending',
	'stale-target-facts',
	'missing-uv',
	'missing-normal-frame',
	'mapping-requires-metric-basis',
	'empty-override',
	'duplicate-image'
] as const;

export type MaterialIssueCode = (typeof MATERIAL_ISSUE_CODES)[number];

export type MaterialIssue = {
	readonly code: MaterialIssueCode;
	readonly path: string;
	readonly role?: MapRole;
	readonly target?: string;
	readonly action?: string;
};

function compareOptional(left: string | undefined, right: string | undefined): number {
	if (left === right) return 0;
	if (left === undefined) return -1;
	if (right === undefined) return 1;
	return left < right ? -1 : 1;
}

/** The one ordering every public material reader applies. */
export function compareMaterialIssues(left: MaterialIssue, right: MaterialIssue): number {
	if (left.path !== right.path) return left.path < right.path ? -1 : 1;
	const byRole = compareOptional(left.role, right.role);
	if (byRole !== 0) return byRole;
	const byTarget = compareOptional(left.target, right.target);
	if (byTarget !== 0) return byTarget;
	return left.code < right.code ? -1 : left.code > right.code ? 1 : 0;
}

export function sortMaterialIssues(issues: readonly MaterialIssue[]): MaterialIssue[] {
	return [...issues].sort(compareMaterialIssues);
}

/** Remove exact duplicates while preserving the canonical order. */
export function dedupeMaterialIssues(issues: readonly MaterialIssue[]): MaterialIssue[] {
	const seen = new Set<string>();
	const unique: MaterialIssue[] = [];
	for (const issue of sortMaterialIssues(issues)) {
		const key = `${issue.path}\0${issue.role ?? ''}\0${issue.target ?? ''}\0${issue.code}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(issue);
	}
	return unique;
}
