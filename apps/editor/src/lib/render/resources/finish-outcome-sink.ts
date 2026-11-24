/**
 * Optional session-only outcome sink for Stage Finish view acquisitions (T2.S8 U6).
 *
 * Runtime-safe type and classifier: visitor paths omit the sink and report
 * nothing. Pending, cancelled, generation-mismatch and texture-budget states
 * never classify as `failed`.
 */
import type { FinishViewIssue } from './finish-views';

export type FinishTargetOutcomeState = 'pending' | 'ready' | 'budget' | 'failed';

export type FinishTargetOutcome = {
	readonly targetKey: string;
	readonly finishKey: string;
	readonly state: FinishTargetOutcomeState;
	readonly issues: readonly FinishViewIssue[];
};

export type FinishOutcomeSink = (outcome: FinishTargetOutcome) => void;

export function classifyFinishViewIssues(
	issues: readonly FinishViewIssue[],
	complete: boolean
): FinishTargetOutcomeState {
	if (complete && issues.length === 0) return 'ready';
	if (issues.some((issue) => issue.code === 'image-load-failed')) return 'failed';
	if (issues.some((issue) => issue.code === 'texture-budget')) return 'budget';
	return 'pending';
}
