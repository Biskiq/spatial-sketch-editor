/**
 * **Paint**, a host tool for whole-object Finish assignment (T2.S4a).
 *
 * Paint asks every binding that declares host tool `paint` for one winner, the
 * same spatial arbitration the Eraser uses: a Wall, an overhead entity, an
 * Artwork or a Light in front of a Scene object keeps the click, so Paint never
 * reaches through it. The winning domain answers whether that subject is
 * paintable; Paint writes nothing on a refusal and never skips to an object
 * behind it. A lifted overhead no longer wins, so interior objects become
 * reachable without a second picking path.
 *
 * Paint commits **one object per click** and never edits a Finish, so it never
 * opens the shared-Finish Ask. The Finish service owns the active Finish, the
 * dropper flag and the recent list; this controller only translates a press.
 */
import type { StageFacade, StageSourceHit } from './stage-facade';
import type { GestureAcquisition } from './stage-session';

export const STAGE_PAINT_TASK = 'host-paint';

export type StagePaintCandidate = {
	readonly adapterId: string;
	readonly hit: StageSourceHit;
	readonly entityId: string | null;
	/** The domain's refusal in its own words; `null` when this can be painted. */
	readonly refusal: string | null;
};

export type StagePaintNotice = {
	readonly kind: 'accepted' | 'refused' | 'already' | 'none';
	readonly message: string;
	readonly css: readonly [number, number];
};

type PointerInput = {
	readonly css: readonly [number, number];
	readonly evaluationId: string;
	readonly coarse?: boolean;
};

export type StagePaintOptions = {
	/** The service's live active Finish; `false` means Paint has nothing to apply. */
	readonly hasActive: () => boolean;
	readonly isAlready: (entityId: string) => boolean;
	readonly assign: (entityId: string) => Promise<boolean>;
	readonly dropperArmed: () => boolean;
	readonly copy: (hit: StageSourceHit) => Promise<boolean>;
	readonly activeLabel: () => string;
};

export type StagePaintController = {
	hover(input: PointerInput | null): void;
	down(input: PointerInput): boolean;
	move(input: PointerInput): void;
	up(input: PointerInput): Promise<void>;
	cancel(): void;
	candidate(): StagePaintCandidate | null;
	notice(): StagePaintNotice | null;
	clear(): boolean;
	pressing(): boolean;
};

function sameSubject(a: StagePaintCandidate | null, b: StagePaintCandidate | null): boolean {
	return (
		a !== null &&
		b !== null &&
		a.adapterId === b.adapterId &&
		a.hit.sourceId === b.hit.sourceId &&
		a.hit.sourceKind === b.hit.sourceKind
	);
}

export function createStagePainter(
	facade: StageFacade,
	options: StagePaintOptions,
	onChange: () => void = () => {}
): StagePaintController {
	let current: StagePaintCandidate | null = null;
	let notice: StagePaintNotice | null = null;
	let press: {
		readonly lease: GestureAcquisition;
		readonly target: StagePaintCandidate;
		cancelled: boolean;
	} | null = null;
	let source = facade.snapshot();
	let inFlight = false;
	let uiGeneration = 0;

	function syncSource(): void {
		const next = facade.snapshot();
		if (next === source) return;
		source = next;
		endPress();
		current = null;
		notice = null;
		uiGeneration += 1;
	}

	function candidateAt(input: PointerInput): StagePaintCandidate | null {
		syncSource();
		const target = facade.hostToolTarget({ ...input, tool: 'paint' });
		if (target.kind !== 'hit') return null;
		const answer = facade.paintAnswer(target.adapterId, target.hit);
		if (answer === null) {
			return {
				adapterId: target.adapterId,
				hit: target.hit,
				entityId: null,
				refusal: 'That cannot be painted.'
			};
		}
		if (answer.kind === 'refused') {
			return {
				adapterId: target.adapterId,
				hit: target.hit,
				entityId: null,
				refusal: answer.message
			};
		}
		return {
			adapterId: target.adapterId,
			hit: target.hit,
			entityId: answer.entityId,
			refusal: target.refusal
		};
	}

	function endPress(): void {
		const ending = press;
		press = null;
		if (ending?.lease.kind === 'granted' && ending.lease.lease.active) ending.lease.lease.release();
	}

	async function commit(target: StagePaintCandidate, css: readonly [number, number]): Promise<void> {
		if (target.entityId === null || target.refusal !== null) {
			notice = {
				kind: 'refused',
				message: target.refusal ?? 'That cannot be painted.',
				css
			};
			return;
		}
		if (options.dropperArmed()) {
			const copied = await options.copy(target.hit);
			notice = copied
				? { kind: 'accepted', message: `Finish copied · ${options.activeLabel()}`, css }
				: { kind: 'refused', message: 'That has no Finish colour.', css };
			onChange();
			return;
		}
		if (!options.hasActive()) {
			notice = { kind: 'refused', message: 'Choose a Finish first.', css };
			return;
		}
		if (options.isAlready(target.entityId)) {
			notice = { kind: 'already', message: `Already ${options.activeLabel()}`, css };
			return;
		}
		const generation = uiGeneration;
		inFlight = true;
		try {
			const accepted = await options.assign(target.entityId);
			syncSource();
			if (generation !== uiGeneration) return;
			notice = accepted
				? { kind: 'accepted', message: `Painted ${options.activeLabel()}`, css }
				: null;
		} catch {
			if (generation === uiGeneration) {
				notice = { kind: 'refused', message: 'The paint could not finish. Try again.', css };
			}
		} finally {
			inFlight = false;
			onChange();
		}
	}

	return {
		hover(input) {
			if (press !== null || inFlight) return;
			const next = input === null || input.coarse === true ? null : candidateAt(input);
			if (!sameSubject(next, current) || (next === null) !== (current === null)) current = next;
		},
		down(input) {
			if (inFlight || press !== null) return false;
			if (!options.hasActive() && !options.dropperArmed()) {
				notice = {
					kind: 'refused',
					message: 'Choose a Finish in Library › Finishes, or in the object’s Card.',
					css: input.css
				};
				return false;
			}
			const target = candidateAt(input);
			if (target === null) {
				// Empty Stage and the datum name no subject: keep the press navigation.
				notice = { kind: 'none', message: 'Nothing to paint there.', css: input.css };
				return false;
			}
			const lease = facade.acquireGesture({
				owner: STAGE_PAINT_TASK,
				evaluationId: input.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind !== 'granted') return false;
			press = { lease, target, cancelled: false };
			current = target;
			return true;
		},
		move(input) {
			if (press === null) return;
			const under = candidateAt(input);
			if (press === null) return;
			if (!sameSubject(under, press.target)) press.cancelled = true;
			current = press.cancelled ? null : press.target;
		},
		async up(input) {
			syncSource();
			const ending = press;
			if (ending === null) return;
			const under = candidateAt(input);
			const stillOn =
				!ending.cancelled && sameSubject(under, ending.target) && sameSubject(current, ending.target);
			endPress();
			if (input.coarse === true) current = null;
			if (!stillOn) return;
			await commit(ending.target, input.css);
		},
		cancel() {
			endPress();
			current = null;
			notice = null;
			uiGeneration += 1;
		},
		candidate() {
			syncSource();
			return current;
		},
		notice() {
			syncSource();
			return notice;
		},
		clear() {
			uiGeneration += 1;
			const had = notice !== null || press !== null || current !== null;
			endPress();
			notice = null;
			current = null;
			return had;
		},
		pressing() {
			return press !== null;
		}
	};
}
