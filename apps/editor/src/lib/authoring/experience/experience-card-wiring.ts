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
import type { SemanticReference } from '@portfolio/project-model';

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

import {
	experienceCardModel,
	presentationCardModel,
	stopCardModel,
	subjectCardModel,
	transitionCardModel,
	viewCardModel
} from './experience-card-model';
import ExperiencePresentationWriter from './ExperiencePresentationWriter.svelte';
import ExperienceViewWriter from './ExperienceViewWriter.svelte';
import ExperienceStopWriter from './ExperienceStopWriter.svelte';
import ExperienceTransitionWriter from './ExperienceTransitionWriter.svelte';
import ExperienceExperienceWriter from './ExperienceExperienceWriter.svelte';
import ExperienceSubjectWriter from './ExperienceSubjectWriter.svelte';

export type ExperienceShownCard = {
	readonly identity: { sourceId: string; label: string; kind: string; status: string } | null;
	readonly facts: readonly { readonly label: string; readonly value: string; readonly fieldId?: string }[];
	readonly nameWriter: NonNullable<ComponentProps<typeof EditorCard>['nameWriter']> | null;
	readonly writer: unknown | null;
	readonly actions: readonly unknown[];
	readonly functions: readonly string[] | null;
	readonly bringIntoView: (() => void) | null;
	readonly kindLink: { readonly label: string; readonly onOpen: () => void } | null;
	readonly menu: readonly ExperienceCardMenuItem[] | null;
	readonly back: ExperienceCardBack;
};

export const NO_CARD: ExperienceShownCard = {
	identity: null,
	facts: [],
	nameWriter: null,
	writer: null,
	actions: [],
	functions: [],
	bringIntoView: null,
	kindLink: null,
	menu: null,
	back: null
};

export type ExperienceCardHost = {
	readonly controller: ExperienceController;
	readonly services: unknown;
	readonly selection: unknown | null;
	readonly sceneSubject: { readonly entityId: string; readonly label: string } | null;
	readonly cardIdentity: ExperienceShownCard['identity'];
	readonly select: (subject: ExperienceSubject | null) => void;
	readonly changeLens: () => void;
	readonly bring: () => void;
	readonly selectStageReference: (reference: SemanticReference) => void;
	readonly referenceLabel: (reference: SemanticReference) => string | null;
	readonly openCard: () => void;
};

/**
 * R217.S25 (D10) — the one Card the Experience lens shows: the Experience subject
 * when one is selected, otherwise the Stage selection as the subject Card,
 * otherwise none. The latest selection always replaced the other, so there is
 * never a second Card to arbitrate.
 */
export function experienceShownCardFor(input: ExperienceCardHost): ExperienceShownCard {
	const controller = input.controller;
	const services = input.services;
	const writerOf = (summary: string, component: unknown): unknown => ({
		summary,
		adapterId: 'experience',
		fieldIds: [],
		view: { component, services }
	});
	const cardBack = (parent: ExperienceSubject | null) => backOf(controller, parent, input.openCard);
	const subject = controller.subject;
	if (subject?.kind === 'presentation') {
		const presentation = controller.selectedPresentation;
		if (presentation === null) return NO_CARD;
		const reference = presentation.subject;
		const subjectLabel = reference === null ? null : input.referenceLabel(reference);
		const model = presentationCardModel({
			presentationId: presentation.id,
			label: controller.presentationDisplayName(presentation.id),
			hasSubject: reference !== null && subjectLabel !== null,
			viewCount: presentation.views.length,
			stopCount: (controller.stopUsage.get(presentation.id) ?? []).length,
			hasDefaultView: presentation.views.length > 0
		});
		// E5: Add to Guide ▸ — the Guides, the active one first, with *again* where the
		// Presentation already has a Stop, then New Guide…, which asks the name inline (D8).
		const activeGuideId = controller.currentGuide?.id ?? controller.contextGuide?.id ?? null;
		const guidesInOrder = [
			...controller.guides.filter((guide) => guide.id === activeGuideId),
			...controller.guides.filter((guide) => guide.id !== activeGuideId)
		];
		const presentationStops = new Set(controller.stopUsage.get(presentation.id) ?? []);
		const busyReason = controller.busy ? { disabled: true, reason: 'Wait for the current change' } : {};
		const addToGuide: ExperienceCardMenuItem = {
			id: 'add-to-guide',
			label: 'Add to Guide',
			children: [
				...guidesInOrder.map((guide) => ({
					id: `add-to-guide:${guide.id}`,
					label: guide.label,
					...(guide.stopIds.some((stopId) => presentationStops.has(stopId)) ? { hint: 'again' } : {}),
					...busyReason,
					run: () => void controller.addToGuide(presentation.id, guide.id)
				})),
				{
					id: 'new-guide',
					label: 'New Guide…',
					...busyReason,
					run: () => void controller.createGuide(presentation.id)
				}
			]
		};
		return {
			...NO_CARD,
			identity: model.identity,
			facts: model.facts,
			nameWriter: experienceNameWriter(
				() => controller.presentationDisplayName(presentation.id),
				(name: string) => controller.renamePresentation(presentation.id, name)
			),
			menu: [
				addToGuide,
				removalItem(controller, 'remove-presentation', 'Remove Presentation', { kind: 'presentation', presentationId: presentation.id })
			],
			back: cardBack(null),
			writer: writerOf('Presentation', ExperiencePresentationWriter),
			kindLink:
				reference === null || subjectLabel === null
					? null
					: {
							label: subjectLabel,
							onOpen: () => input.selectStageReference(reference)
						}
		};
	}
	if (subject?.kind === 'view') {
		const view = controller.selectedView;
		if (view === null) return NO_CARD;
		const model = viewCardModel({
			viewId: view.id,
			label: view.label,
			presentationLabel: controller.presentationLabel(view.presentationId)
		});
		return {
			...NO_CARD,
			identity: model.identity,
			facts: model.facts,
			nameWriter: experienceNameWriter(
				() => view.label,
				(name: string) => controller.renameView(view.id, name)
			),
			menu: [
				removalItem(controller, 'remove-view', 'Remove View', {
					kind: 'view',
					presentationId: view.presentationId,
					viewId: view.id
				})
			],
			back: cardBack({ kind: 'presentation', presentationId: view.presentationId }),
			writer: writerOf('View', ExperienceViewWriter),
			kindLink: {
				label: controller.presentationLabel(view.presentationId),
				onOpen: () => input.select({ kind: 'presentation', presentationId: view.presentationId })
			}
		};
	}
	if (subject?.kind === 'stop') {
		const stop = controller.selectedStop;
		if (stop === null) return NO_CARD;
		const order = controller.guideStops;
		const at = order.findIndex((entry) => entry.id === stop.id);
		const position = at === -1 ? null : at + 1;
		const model = stopCardModel({
			stopId: stop.id,
			presentationLabel: controller.presentationLabel(stop.presentationId),
			position,
			guideLength: order.length,
			guideLabel: controller.contextGuide?.label ?? ''
		});
		const items: ExperienceCardMenuItem[] = [
			{
				id: 'open-presentation',
				label: 'Open Presentation',
				run: () => input.select({ kind: 'presentation', presentationId: stop.presentationId })
			}
		];
		if (position !== null) {
			const first = position === 1;
			const last = position === order.length;
			const busy = controller.busy;
			const stuck = (atEnd: boolean, reason: string): { disabled: boolean; reason?: string } =>
				busy ? { disabled: true, reason: 'Wait for the current change' } : atEnd ? { disabled: true, reason } : { disabled: false };
			items.push(
				{ id: 'move-earlier', label: 'Move earlier', ...stuck(first, 'Already the first Stop'), run: () => void controller.moveStop(stop.id, -1) },
				{ id: 'move-later', label: 'Move later', ...stuck(last, 'Already the last Stop'), run: () => void controller.moveStop(stop.id, 1) }
			);
			if (order.length > 6) {
				items.push(
					{ id: 'move-start', label: 'Move to the start', ...stuck(first, 'Already the first Stop'), run: () => void controller.moveStopTo(stop.id, 0) },
					{ id: 'move-end', label: 'Move to the end', ...stuck(last, 'Already the last Stop'), run: () => void controller.moveStopTo(stop.id, order.length - 1) }
				);
			}
		}
		items.push(removalItem(controller, 'remove-stop', 'Remove Stop', { kind: 'stop', stopId: stop.id }));
		return {
			...NO_CARD,
			identity: model.identity,
			facts: model.facts,
			writer: writerOf('Stop', ExperienceStopWriter),
			menu: items,
			back: cardBack(null)
		};
	}
	if (subject?.kind === 'transition') {
		const stop = controller.selectedStop;
		if (stop === null) return NO_CARD;
		const at = controller.guideStops.findIndex((entry) => entry.id === stop.id);
		const continuation = controller.resolveContinuation(stop.id);
		if (at === -1 || continuation === null) return NO_CARD;
		const model = transitionCardModel({
			stopId: stop.id,
			fromPosition: at + 1,
			guideLabel: controller.contextGuide?.label ?? '',
			continuation
		});
		return {
			...NO_CARD,
			identity: model.identity,
			facts: model.facts,
			writer: writerOf('Transition', ExperienceTransitionWriter),
			back: cardBack({ kind: 'stop', stopId: stop.id })
		};
	}
	// D-2: with nothing selected the Card is the Experience Card. A Guide is never a
	// Card subject; opening one keeps this Card and shows its strip.
	if (subject?.kind === 'experience' || (subject === null && input.selection === null)) {
		const current = controller.current;
		if (current === null) return NO_CARD;
		const model = experienceCardModel({
			experienceId: current.id,
			label: current.label,
			guideCount: controller.guides.length
		});
		return {
			...NO_CARD,
			identity: model.identity,
			facts: model.facts,
			nameWriter: experienceNameWriter(
				() => current.label,
				(name: string) => controller.renameExperience(name)
			),
			writer: writerOf('Experience', ExperienceExperienceWriter)
		};
	}
	// No Experience subject, but a Stage pick is: the Stage selection is the Card.
	if (input.selection === null) return NO_CARD;
	const scene = input.sceneSubject;
	if (scene !== null) {
		const model = subjectCardModel({ entityId: scene.entityId, label: scene.label });
		return {
			...NO_CARD,
			identity: model.identity,
			facts: model.facts,
			writer: writerOf('Scene object', ExperienceSubjectWriter),
			bringIntoView: input.bring
		};
	}
	// A Layout or other Stage subject: identity only, and the way back to its editing home.
	return {
		...NO_CARD,
		identity: input.cardIdentity,
		bringIntoView: input.bring,
		menu: [{ id: 'open-in-world', label: 'Open in World', run: input.changeLens }]
	};
}
