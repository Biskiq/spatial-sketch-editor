import { formatPathSeconds } from './experience-paths';
import type { experienceHomes } from './experience-homes';

type GuideController = NonNullable<ReturnType<ReturnType<typeof experienceHomes>['controller']>>;
type GuideStop = {
	readonly id: string;
	readonly presentationId: string;
	readonly entryViewId: string | null;
	readonly invitation: unknown;
};

/** Stop cards and connectors, read from the accepted Guide and playback map. */
export function guideCards(
	controller: GuideController | null,
	stops: readonly GuideStop[],
	pacing: string
): readonly GuideCardFacts[] {
	if (controller === null) return [];
	const transitionWord = (transition: 'cut' | 'travel'): string => (transition === 'travel' ? 'Travel' : 'Cut');
	return stops.map((stop, index) => {
		const number = index + 1;
		const presentation = controller.current?.presentations.find((entry) => entry.id === stop.presentationId);
		const viewId = stop.entryViewId ?? presentation?.views[0]?.viewId ?? null;
		// Sheet §33 A: a Presentation visited more than once names its entry View on
		// every visit (Pleyel piano · From the window), so the visits stay distinct.
		const repeated = stops.filter((other) => other.presentationId === stop.presentationId).length > 1;
		const viewName = viewId === null ? null : (controller.viewsOf?.get(stop.presentationId)?.find((view) => view.id === viewId)?.label ?? null);
		const label = repeated && viewName !== null
			? `${controller.presentationLabel(stop.presentationId)} · ${viewName}`
			: controller.presentationLabel(stop.presentationId);
		const more = Math.max(0, (presentation?.views.length ?? 1) - 1);
		const invites = stop.invitation !== null;
		const resolved = controller.resolveContinuation(stop.id);
		const gaps = controller.travelGapsByStop.get(stop.id) ?? [];
		let connector: GuideConnector | null = null;
		if (resolved !== null && resolved.kind === 'end') {
			connector = { shape: 'end', text: 'End', name: `Stop ${number} ends the Guide`, transition: null, gap: false };
		} else if (resolved !== null) {
			const gap = resolved.transition === 'travel' && gaps.length > 0;
			const target =
				resolved.kind === 'adjacent' || resolved.position !== null
					? `Stop ${resolved.position}`
					: 'a Stop outside this Guide';
			const path = resolved.transition === 'travel' ? controller.pathFor?.({ kind: 'transition', stopId: stop.id }) ?? null : null;
			const seconds = path?.state === 'ready' ? formatPathSeconds(path.seconds) : null;
			const nameSeconds = seconds === null ? '' : ` · ${seconds}`;
			const attention = gap ? '. Travel has no Camera connection yet' : '';
			connector = {
				shape: resolved.kind,
				// The gutter is 38 px: an adjacent link is drawn as its glyph, a jump
				// names its Stop, and a Travel's seconds live in the accessible name.
				text:
					resolved.kind === 'adjacent'
						? resolved.transition === 'travel'
							? `↗ ${seconds ?? ''}`.trim()
							: resolved.transition
						: resolved.position === null
							? '→'
							: `→ ${resolved.position}`,
				name: `Stop ${number} continues to ${target} by ${transitionWord(resolved.transition)}${resolved.transition === 'travel' ? nameSeconds : ''}${attention}`,
				transition: resolved.transition,
				gap
			};
		}
		const spoken = [`Stop ${number}`, label];
		if (invites) spoken.push('invites exploring');
		if (more > 0) spoken.push(`${more} more ${more === 1 ? 'view' : 'views'} to explore`);
		if (pacing === 'manual') spoken.push('waits for Next');
		return { stopId: stop.id, viewId, number, label, more, invites, name: spoken.join(', '), connector };
	});
}

/** A Stop's connector to the next Stop, as the Guide draws it. */
export type GuideConnector = {
	readonly shape: 'adjacent' | 'jump' | 'end';
	readonly text: string;
	readonly name: string;
	readonly transition: 'cut' | 'travel' | null;
	readonly gap: boolean;
};

/** The reading of one Stop card and the connector after it. */
export type GuideCardFacts = {
	readonly stopId: string;
	readonly viewId: string | null;
	readonly number: number;
	readonly label: string;
	/** Views to explore beyond the entry (+N on the card). */
	readonly more: number;
	/** The Stop invites exploring. */
	readonly invites: boolean;
	readonly name: string;
	readonly connector: GuideConnector | null;
};
