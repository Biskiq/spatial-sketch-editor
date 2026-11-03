/**
 * R217.S26 (E4) — the words of a removal.
 *
 * The removal plans live in `@portfolio/project-model/units` (`experience-structure.ts`)
 * and are the same ones the removal planners install. This module only turns a plan's
 * named consequences into the lines the Card's consequence block shows before Remove,
 * so what the creator reads is exactly what the operation does. Pure: no state, no DOM.
 */
import type { ExperienceRemovalConsequence } from '@portfolio/project-model/units';

/** What a removal is aimed at. A Default View names its successor once the creator chose it. */
export type ExperienceRemovalTarget =
	| { readonly kind: 'stop'; readonly stopId: string }
	| { readonly kind: 'guide'; readonly guideId: string }
	| { readonly kind: 'presentation'; readonly presentationId: string }
	| {
			readonly kind: 'view';
			readonly presentationId: string;
			readonly viewId: string;
			readonly newDefaultViewId?: string | null;
	  };

/** The Card's reading of a removal before it runs. */
export type ExperienceRemovalPreview =
	| { readonly kind: 'refused'; readonly reason: string }
	| {
			readonly kind: 'ready';
			/** The effect lines, the removed subject first. */
			readonly lines: readonly string[];
			/** The Default View is being removed: the creator chooses the new one here (no automatic pick). */
			readonly chooseDefault: readonly { readonly id: string; readonly label: string }[] | null;
			/** Remove can run: false only while a new Default is still to be chosen. */
			readonly runnable: boolean;
	  };

/** How a consequence names the subjects it mentions. */
export type RemovalNames = {
	stop(stopId: string): string;
	presentation(presentationId: string): string;
	view(viewId: string): string;
	guide(guideId: string): string;
};

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** The effect lines of one planned removal, in a stable reading order. */
export function removalLines(
	target: ExperienceRemovalTarget,
	consequences: readonly ExperienceRemovalConsequence[],
	names: RemovalNames
): string[] {
	const lines: string[] = [];
	const removedStops = consequences.filter((entry) => entry.kind === 'stop-removed');
	const deletedViews = consequences.filter((entry) => entry.kind === 'view-deleted');
	const deletedPaths = consequences.filter((entry) => entry.kind === 'connection-deleted');
	const removedGates = consequences.filter((entry) => entry.kind === 'gate-removed');
	if (target.kind === 'stop') {
		lines.push(`Removes ${names.stop(target.stopId)}. ${names.presentation(removedStops[0]?.presentationId ?? '')} stays.`);
	} else if (target.kind === 'guide') {
		lines.push(
			removedStops.length === 0
				? `Removes ${names.guide(target.guideId)}. Its Stops stay in the other Guides.`
				: `Removes ${names.guide(target.guideId)} and its ${plural(removedStops.length, 'Stop', 'Stops')}. Presentations stay.`
		);
	} else if (target.kind === 'presentation') {
		const extras = [
			removedStops.length > 0 ? `its ${plural(removedStops.length, 'Stop', 'Stops')}` : null,
			deletedViews.length > 0 ? plural(deletedViews.length, 'Camera View', 'Camera Views') : null,
			deletedPaths.length > 0 ? plural(deletedPaths.length, 'Camera path', 'Camera paths') : null,
			removedGates.length > 0 ? plural(removedGates.length, 'Gate', 'Gates') : null
		].filter((entry): entry is string => entry !== null);
		lines.push(
			extras.length === 0
				? `Removes ${names.presentation(target.presentationId)}.`
				: `Removes ${names.presentation(target.presentationId)} and ${extras.join(', ')}.`
		);
	} else {
		const camera =
			deletedViews.length === 0
				? ''
				: deletedPaths.length === 0
					? ' and deletes its Camera View'
					: ` and deletes its Camera View and ${plural(deletedPaths.length, 'Camera path', 'Camera paths')}`;
		lines.push(`Removes ${names.view(target.viewId)} from ${names.presentation(target.presentationId)}${camera}.`);
	}
	for (const consequence of consequences) {
		switch (consequence.kind) {
			case 'default-changed':
				lines.push(`${names.view(consequence.toViewId)} becomes the Default View.`);
				break;
			case 'view-kept':
				lines.push(
					`${names.view(consequence.viewId)} stays: still used by ${consequence.usedByPresentationIds.map((id) => names.presentation(id)).join(', ')}.`
				);
				break;
			case 'stop-view-removed':
				lines.push(`${names.stop(consequence.stopId)} leaves out ${names.view(consequence.viewId)}.`);
				break;
			case 'stop-entry-fallback':
				lines.push(`${names.stop(consequence.stopId)} enters at the Default View instead.`);
				break;
			case 'continuation-fallback':
				lines.push(`${names.stop(consequence.stopId)} no longer continues to ${names.stop(consequence.removedStopId)}; it follows the Guide order.`);
				break;
			case 'guide-start-moved':
				lines.push(`${names.guide(consequence.guideId)} now starts at ${names.stop(consequence.toStopId)}.`);
				break;
			case 'opening-guide-moved':
				lines.push(
					consequence.toGuideId === null
						? 'No Guide is left: the Experience opens on no tour.'
						: `${names.guide(consequence.toGuideId)} becomes the Opening Guide.`
				);
				break;
			default:
				break;
		}
	}
	return lines;
}
