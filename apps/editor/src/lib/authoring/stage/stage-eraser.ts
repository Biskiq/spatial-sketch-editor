/**
 * R217.S10 — the **Eraser**, a host tool.
 *
 * The Eraser removes one subject per click by calling the **winning domain's own**
 * delete: the Stage asks every binding that declares host tool `erase` for one
 * winner, arbitrates spatially, then asks that binding — and only that binding —
 * for its `eraseAction`. Layout answers with its Card's Wall or Opening delete,
 * Scene with `delete-one`; each is one F4 entry, and Undo restores the same ids.
 *
 * Eligibility and words are the domain's. A refused winner (a Room floor, the
 * plinth) is reported with its refusal, and the Eraser never skips to an eligible
 * subject behind it. When the domain asks for its disclosure to be read first (a
 * Wall whose removal changes Rooms), the first click shows that disclosure at the
 * pointer and a second click on the same subject runs it.
 *
 * A fine pointer previews the winner on hover; a coarse pointer shows it on press,
 * erases on release and erases nothing when the finger slides off the subject.
 * The press is an authoring lease (its release writes), so Undo explains it while
 * the finger is down.
 */
import type { StageFacade, StageSourceHit } from './stage-facade';
import type { GestureAcquisition } from './stage-session';

/** The host task kind an armed Eraser opens; it owns no adapter instrument. */
export const STAGE_ERASER_TASK = 'host-erase';

/** The PLATE erase treatment: red dashes, never gold. */
export const STAGE_ERASE_INK = '#d0412d';

/** The winner under the pointer, as the Stage draws it. */
export type StageEraseCandidate = {
	readonly adapterId: string;
	readonly hit: StageSourceHit;
	/** The domain's refusal for this subject; `null` when it can be erased. */
	readonly refusal: string | null;
};

/** What the last click did, in words the Stage shows beside the pointer. */
export type StageEraseNotice = {
	readonly kind: 'accepted' | 'refused' | 'disclose' | 'none';
	readonly message: string;
	readonly css: readonly [number, number];
};

type PointerInput = { readonly css: readonly [number, number]; readonly evaluationId: string; readonly coarse?: boolean };

export type StageEraserController = {
	/** A fine-pointer hover; `null` clears it. */
	hover(input: PointerInput | null): void;
	down(input: PointerInput): boolean;
	move(input: PointerInput): void;
	up(input: PointerInput): Promise<void>;
	cancel(): void;
	candidate(): StageEraseCandidate | null;
	notice(): StageEraseNotice | null;
	/** Escape and disarm: `true` when a disclosure or notice was dismissed. */
	clear(): boolean;
	pressing(): boolean;
};

function sameSubject(a: StageEraseCandidate | null, b: StageEraseCandidate | null): boolean {
	return a !== null && b !== null && a.adapterId === b.adapterId && a.hit.sourceId === b.hit.sourceId && a.hit.sourceKind === b.hit.sourceKind;
}

export function createStageEraser(facade: StageFacade, onChange: () => void = () => {}): StageEraserController {
	let current: StageEraseCandidate | null = null;
	let notice: StageEraseNotice | null = null;
	/** The subject whose disclosure the creator has read; a second click runs it. */
	let disclosed: StageEraseCandidate | null = null;
	let press: { readonly lease: GestureAcquisition; readonly target: StageEraseCandidate } | null = null;

	function candidateAt(input: PointerInput): StageEraseCandidate | null {
		const target = facade.hostToolTarget({ ...input, tool: 'erase' });
		return target.kind === 'hit' ? { adapterId: target.adapterId, hit: target.hit, refusal: target.refusal } : null;
	}

	function endPress(): void {
		const ending = press;
		press = null;
		if (ending?.lease.kind === 'granted' && ending.lease.lease.active) ending.lease.lease.release();
	}

	async function erase(target: StageEraseCandidate, css: readonly [number, number]): Promise<void> {
		if (target.refusal !== null) {
			notice = { kind: 'refused', message: target.refusal, css };
			disclosed = null;
			return;
		}
		const answer = facade.eraseAnswer(target.adapterId, target.hit);
		if (answer === null) {
			notice = { kind: 'refused', message: 'That cannot be erased.', css };
			disclosed = null;
			return;
		}
		if (answer.kind === 'refused') {
			notice = { kind: 'refused', message: answer.message, css };
			disclosed = null;
			return;
		}
		if (answer.confirm && !sameSubject(disclosed, target)) {
			disclosed = target;
			notice = {
				kind: 'disclose',
				message: `${answer.action.detail ?? answer.action.label} Click again to erase.`,
				css
			};
			return;
		}
		disclosed = null;
		notice = null;
		// The subject is about to go: nothing it named stays drawn.
		current = null;
		const outcome = await answer.action.run();
		notice =
			outcome.kind === 'accepted'
				? null
				: { kind: outcome.kind === 'refused' ? 'refused' : 'none', message: outcome.message ?? 'Nothing was erased.', css };
		onChange();
	}

	return {
		hover(input) {
			if (press !== null) return;
			const next = input === null || input.coarse === true ? null : candidateAt(input);
			if (!sameSubject(next, current) || (next === null) !== (current === null)) current = next;
		},
		down(input) {
			const target = candidateAt(input);
			if (target === null) {
				// The datum and empty Stage name no subject; the press stays navigation.
				notice = { kind: 'none', message: 'Nothing to erase there.', css: input.css };
				disclosed = null;
				return false;
			}
			const lease = facade.acquireGesture({
				owner: STAGE_ERASER_TASK,
				evaluationId: input.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind !== 'granted') return false;
			press = { lease, target };
			current = target;
			return true;
		},
		move(input) {
			if (press === null) return;
			// Sliding off the pressed subject cancels: the release will erase nothing.
			const under = candidateAt(input);
			current = sameSubject(under, press.target) ? press.target : null;
		},
		async up(input) {
			const ending = press;
			if (ending === null) return;
			const under = candidateAt(input);
			const stillOn = sameSubject(under, ending.target) && sameSubject(current, ending.target);
			endPress();
			if (input.coarse === true) current = null;
			if (!stillOn) return;
			await erase(ending.target, input.css);
		},
		cancel() {
			endPress();
			current = null;
		},
		candidate() {
			return current;
		},
		notice() {
			return notice;
		},
		clear() {
			const had = notice !== null || disclosed !== null || press !== null;
			endPress();
			notice = null;
			disclosed = null;
			current = null;
			return had;
		},
		pressing() {
			return press !== null;
		}
	};
}
