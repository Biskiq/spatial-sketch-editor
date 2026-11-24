import { untrack } from 'svelte';
import type { AppearanceIssue } from '../appearance-issues.svelte';
import { contribution, type RegionProps } from '../../workspace/region-ownership';
import type { RepairProps } from '../appearance-view';
import type { FinishAuthoring } from '../finish-authoring.svelte';

/**
 * The Appearance issues drawer: its one open state, its reset lifetime and the
 * Head keys that toggle it. Every ending goes through `close`.
 */
export function createRepairSession(input: {
	readonly projectId: string;
	readonly finishes: () => FinishAuthoring;
}) {
	let open = $state(false);

	/** Today's project-reset creation point (Appendix A row 17, Appearance half). */
	function attachAuthoring(): void {
		$effect(() => {
			void input.projectId;
			untrack(() => {
				input.finishes().issues.reset();
				open = false;
			});
		});
	}

	function reset(): void {
		input.finishes().issues.reset();
	}

	function close(): void {
		open = false;
	}

	function dismiss(): boolean {
		if (!open) return false;
		open = false;
		return true;
	}

	function openCard(issue: AppearanceIssue): void {
		input.finishes().focusIssueTarget(issue);
		open = false;
	}

	const head = contribution<'appearance', 'head'>()({
		get repairIssueCount() { return input.finishes().issues.count; },
		get repairOpen() { return open; },
		onToggleRepair: () => { open = !open; }
	});

	/** Appearance's Repair canvas keys; the entry composes the one contribution. */
	const canvasKeys = {
		onFinishOutcome: (outcome: Parameters<NonNullable<RegionProps['canvas']['onFinishOutcome']>>[0]) =>
			input.finishes().issues.recordOutcome(outcome),
		get repairAffectedTargets() { return input.finishes().issues.hatchedTargets; }
	};

	const props = $derived.by((): RepairProps | null => ({
		open,
		issues: input.finishes().issues.open,
		repaired: input.finishes().issues.repaired,
		onOpenCard: openCard,
		onClose: close
	}));

	attachAuthoring();
	return {
		reset,
		close,
		dismiss,
		head,
		canvasKeys,
		get open() { return open; },
		get props() { return props; }
	};
}
