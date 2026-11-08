/**
 * The Experience Card's menu, Back and rename-writer wiring.
 *
 * These builders read the controller and return the shared Card's own shapes.
 * They own no selection, source or Camera state; every command stays on the
 * controller, and the route keeps only the one Card selection slot.
 */
import type { ComponentProps } from 'svelte';
import EditorCard from '../stage/shell/EditorCard.svelte';
import type { ExperienceController } from './experience-controller.svelte';
import { NAME_NEEDED } from './experience-controller.svelte';
import type { ExperienceRemovalTarget } from './experience-removal';
import type { ExperienceSubject } from './experience-model';

export type ExperienceCardMenuItem = NonNullable<ComponentProps<typeof EditorCard>['menu']>[number];

/**
 * R217.S26 (E4) — a danger item for one removal. Its consequence block reads the
 * same plan the removal planner installs; an item the plan refuses stays disabled
 * with the reason as its hint. A Default View's removal asks for the new Default
 * in the block (no automatic choice).
 */
export function removalItem(
	controller: ExperienceController,
	id: string,
	label: string,
	target: ExperienceRemovalTarget
): ExperienceCardMenuItem {
	const withChoice = (choice: string | null): ExperienceRemovalTarget =>
		target.kind === 'view' ? { ...target, newDefaultViewId: choice } : target;
	const initial = controller.removalPreview(target);
	return {
		id,
		label,
		danger: true,
		...(controller.busy
			? { disabled: true, reason: 'Wait for the current change' }
			: initial.kind === 'refused'
				? { disabled: true, reason: initial.reason }
				: {}),
		consequence: {
			read: (choice) => {
				const preview = controller.removalPreview(withChoice(choice));
				if (preview.kind === 'refused') return preview;
				return {
					kind: 'ready',
					lines: preview.lines,
					choose: preview.chooseDefault === null ? null : { label: 'New Default View', options: preview.chooseDefault },
					runnable: preview.runnable
				};
			},
			run: (choice) => controller.remove(withChoice(choice))
		}
	};
}

export type ExperienceCardBack = {
	readonly label: string;
	readonly onBack: () => void;
} | null;

/**
 * R217.S26 (E17): the kind line's *‹ Back* when the previous subject is not the
 * kind line's own parent link (a View's Presentation is already its kind link).
 */
export function backOf(
	controller: ExperienceController,
	parent: ExperienceSubject | null,
	openCard: () => void
): ExperienceCardBack {
	const target = controller.backTarget;
	if (target === null) return null;
	if (parent !== null && JSON.stringify(parent) === JSON.stringify(target)) return null;
	// Review round 3: stepping between siblings (Stop ‹ › Stop) is not a drill-in,
	// so the Card names no "back" to the sibling it came from; Alt+← still returns.
	if (controller.subject !== null && controller.subject.kind === target.kind) return null;
	return {
		label: controller.subjectName(target),
		onBack: () => {
			controller.back();
			openCard();
		}
	};
}

/** The Experience rename fields commit on Enter or blur and refuse an empty name (R217.S26). */
export function experienceNameWriter(
	value: () => string,
	commit: (name: string) => Promise<{ readonly kind: string; readonly message?: string }>
): NonNullable<ComponentProps<typeof EditorCard>['nameWriter']> {
	return {
		get value() {
			return value();
		},
		commit,
		commitOnBlur: true,
		emptyMessage: NAME_NEEDED
	};
}
