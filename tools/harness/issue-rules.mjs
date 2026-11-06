/**
 * Blocking-bug rules, dependency-free.
 *
 * The issue response helper runs from the default branch on `issues` events,
 * where no `npm ci` has run. It must not import the TypeScript scanner, so the
 * event rules live here with no dependencies beyond each other.
 */

export const OWNER_LABEL = 'owner-approved-guard-change';

export function issueLabels(issue) {
	return Array.isArray(issue?.labels)
		? issue.labels.map((label) => (typeof label === 'string' ? label : label?.name))
		: [];
}

/**
 * Actual fixing evidence count for the current closure, or null when the
 * closure read was unreadable. A mention is never evidence.
 */
export function hasFixEvidence(linkedFixes) {
	if (Array.isArray(linkedFixes)) return linkedFixes.length;
	if (linkedFixes && typeof linkedFixes === 'object') {
		if (linkedFixes.unreadable === true) return null;
		const pulls = Array.isArray(linkedFixes.pullRequests) ? linkedFixes.pullRequests.length : 0;
		const commits = Array.isArray(linkedFixes.commits) ? linkedFixes.commits.length : 0;
		return pulls + commits;
	}
	return null;
}

/**
 * One GitHub `issues` event against the issue state it describes. Returns
 * violations rather than throwing, so the workflow fails with the reason and a
 * missing readback is visible.
 *
 * @param {{event: any, linkedFixes?: any}} input
 */
export function evaluateIssueEvent({ event, linkedFixes = null }) {
	const violations = [];
	const issue = event?.issue ?? {};
	const labels = issueLabels(issue);
	const approved = labels.includes(OWNER_LABEL);
	const action = event?.action;
	const removed = event?.label?.name;

	if (
		action === 'unlabeled' &&
		removed === 'blocks-core' &&
		!labels.includes('blocks-core') &&
		!approved
	) {
		violations.push({
			reason: `issue #${issue.number} dropped blocks-core without owner approval`,
			detail: 'add the owner-approved-guard-change label to the issue before removing blocks-core'
		});
	}
	if (
		action === 'unlabeled' &&
		removed === 'bug' &&
		!labels.includes('bug') &&
		labels.includes('blocks-core') &&
		!approved
	) {
		violations.push({
			reason: `issue #${issue.number} dropped bug while it still claims blocks-core`,
			detail: 'relabelling must not erase a confirmed blocking bug; the owner-approved-guard-change label is required'
		});
	}
	if (action === 'closed' && issue.state === 'closed' && labels.includes('blocks-core') && !approved) {
		const evidence = hasFixEvidence(linkedFixes);
		if (evidence === null) {
			violations.push({
				reason: `issue #${issue.number} closed with blocks-core but fix linkage could not be read`,
				detail: 'the closure readback failed; refusing to treat an unreadable close as fixed'
			});
		} else if (evidence === 0) {
			violations.push({
				reason: `issue #${issue.number} closed with blocks-core and no linked fixing change`,
				detail: 'a mention or an earlier fix is not this closure; link a merged fixing pull request or a fixing commit, or add the owner-approved-guard-change label'
			});
		}
	}
	return violations;
}
