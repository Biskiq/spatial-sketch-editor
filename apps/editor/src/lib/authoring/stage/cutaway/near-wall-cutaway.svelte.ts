/**
 * X2's one **Near walls: Cut | Whole** state.
 *
 * It is session state, never a document: no authored unit, history entry, Save
 * payload, snapshot or visitor chunk learns that a cutaway exists. The store holds
 * only the switch, the hold, the decision memory and the sticky exemption set;
 * which Walls are near is `near-wall-classify.ts`'s pure answer, and how a cut Wall
 * is drawn is the representation's and the caps layer's.
 *
 * ## What may change while the Camera is still
 *
 * Nothing in the classification. A decision is recomputed only when the eye/target
 * pose changes beyond 1e-6 m or the committed geometry revision changes (D8), and a
 * geometry revision that arrives mid-press is frozen until the press ends. The
 * **masks** may change at rest — the switch, the hold key and the selection
 * exemption — because they are presentation, not classification. That is also why
 * a deselected Wall stays whole (`sticky`) until the next pose change: re-cutting
 * on Escape at rest would read as flicker.
 */
import type { CompiledPhysicalWall, CompiledRoom } from '@portfolio/layout-core/geometry';
import { classifyNearWalls, type NearWallClassification } from './near-wall-classify';

export type NearWallMode = 'cut' | 'whole';

export type NearWallDecision = {
	readonly spaceId: string | null;
	readonly cut: ReadonlySet<string>;
	/** The horizontal stub height for this decision, or null when nothing is inspected. */
	readonly stubTopY: number | null;
	readonly poseKey: string;
	readonly geometryRevision: string;
};

export type NearWallEvaluation = {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly rooms: readonly CompiledRoom[];
	readonly walls: readonly CompiledPhysicalWall[];
	readonly floors: readonly { readonly floorId: string; readonly elevation: number }[];
	readonly renderedReading: '3d' | 'plan' | 'transition';
	readonly geometryRevision: string;
	/** A Layout gesture is claiming geometry; revisions are frozen until release. */
	readonly pressing: boolean;
};

/** A pose key rounded to 1e-6 m, so float noise never re-classifies a still Camera. */
function poseKeyOf(
	eye: readonly [number, number, number],
	target: readonly [number, number, number],
): string {
	const rounded = (value: number): number => Math.round(value * 1e6) / 1e6;
	return `${rounded(eye[0])},${rounded(eye[1])},${rounded(eye[2])}|${rounded(target[0])},${rounded(
		target[1],
	)},${rounded(target[2])}`;
}

const EMPTY: ReadonlySet<string> = new Set();

class NearWallCutawayStore {
	#mode = $state<NearWallMode>('cut');
	#held = $state(false);
	#decision = $state<NearWallDecision | null>(null);
	/** Walls whose exemption ended at rest; kept whole until the next pose change. */
	#sticky = $state<ReadonlySet<string>>(EMPTY);
	/** The selection hosts last seen, so leaving the exemption can be observed. */
	#hosts: ReadonlySet<string> = EMPTY;

	/** The two-way switch. Default Cut; a replaced project resets it. */
	get mode(): NearWallMode {
		return this.#mode;
	}

	/** Whether the hold key is down. */
	get held(): boolean {
		return this.#held;
	}

	/** The live decision, or null (Plan/transition, or not evaluated yet). */
	get decision(): NearWallDecision | null {
		return this.#decision;
	}

	get stubTopY(): number | null {
		return this.#decision?.stubTopY ?? null;
	}

	get spaceId(): string | null {
		return this.#decision?.spaceId ?? null;
	}

	/** The cut set before the presentation masks. Diagnostics and tests read this. */
	get classified(): ReadonlySet<string> {
		return this.#decision?.cut ?? EMPTY;
	}

	get sticky(): ReadonlySet<string> {
		return this.#sticky;
	}

	setMode(mode: NearWallMode): void {
		this.#mode = mode;
	}

	setHeld(held: boolean): void {
		this.#held = held;
	}

	/**
	 * Re-classify when the pose or the committed geometry moved.
	 *
	 * Returns whether the decision changed. A repeated call at a stationary pose
	 * and identical revision is a **no-op**, which is what keeps the Stationary
	 * Camera gate true: no set rebuild, no material swap, no frame request.
	 */
	evaluate(input: NearWallEvaluation): boolean {
		if (input.renderedReading !== '3d') {
			// Plan is not a cut reading: it also releases the hold, so returning to 3D
			// never resurrects a key press that happened in another reading.
			this.#held = false;
			if (this.#decision === null && this.#sticky === EMPTY) return false;
			this.#decision = null;
			this.#sticky = EMPTY;
			return true;
		}
		const poseKey = poseKeyOf(input.eye, input.target);
		const previous = this.#decision;
		// A geometry revision during a press is frozen; the next evaluation after
		// release runs once. Pose changes still re-evaluate, because the Camera can
		// move while a drag is active.
		if (
			input.pressing &&
			previous !== null &&
			input.geometryRevision !== previous.geometryRevision
		) {
			return false;
		}
		if (
			previous !== null &&
			previous.poseKey === poseKey &&
			previous.geometryRevision === input.geometryRevision
		) {
			return false;
		}
		const classification: NearWallClassification = classifyNearWalls({
			eye: input.eye,
			target: input.target,
			rooms: input.rooms,
			walls: input.walls,
			floors: input.floors,
			previousSpaceId: previous?.spaceId ?? null,
			previousCut: previous?.cut ?? EMPTY,
		});
		this.#decision = {
			spaceId: classification.spaceId,
			cut: classification.cut,
			stubTopY: classification.stubTopY,
			poseKey,
			geometryRevision: input.geometryRevision,
		};
		// A pose change is the one moment a sticky exemption is released: the Wall
		// re-enters ordinary classification.
		if (previous === null || previous.poseKey !== poseKey) this.#sticky = EMPTY;
		return true;
	}

	/**
	 * Observe the selection's host Walls (the selected Wall, an Opening's host, a
	 * selected artwork's derived host), and remember a Wall that **left** the
	 * exemption while it was in the cut set.
	 */
	setSelectionHosts(next: ReadonlySet<string>): void {
		const decision = this.#decision;
		if (decision !== null) {
			for (const wallId of this.#hosts) {
				if (next.has(wallId)) continue;
				if (decision.cut.has(wallId) && !this.#sticky.has(wallId)) {
					const sticky = new Set(this.#sticky);
					sticky.add(wallId);
					this.#sticky = sticky;
				}
			}
			for (const wallId of next) {
				if (!this.#sticky.has(wallId)) continue;
				const sticky = new Set(this.#sticky);
				sticky.delete(wallId);
				this.#sticky = sticky;
			}
		}
		this.#hosts = new Set(next);
	}

	/**
	 * The Walls the Canvas cuts: the classified set minus the selection hosts and
	 * the sticky releases, masked to nothing by Whole, the hold key or Plan.
	 */
	effective(selectionHosts: ReadonlySet<string>): ReadonlySet<string> {
		const decision = this.#decision;
		if (decision === null || this.#mode === 'whole' || this.#held) return EMPTY;
		if (decision.cut.size === 0) return EMPTY;
		const cut = new Set<string>();
		for (const wallId of decision.cut) {
			if (selectionHosts.has(wallId) || this.#sticky.has(wallId)) continue;
			cut.add(wallId);
		}
		return cut;
	}

	/** A replaced project, a lens change or a route teardown ends the reading. */
	reset(): void {
		this.#mode = 'cut';
		this.#held = false;
		this.#decision = null;
		this.#sticky = EMPTY;
		this.#hosts = EMPTY;
	}
}

/** The one session singleton, beside `interiorLift` and the Slice reading. */
export const nearWallCutaway = new NearWallCutawayStore();

/** The public surface a route (or a test) needs, without exposing the class. */
export type NearWallCutaway = Pick<
	NearWallCutawayStore,
	| 'mode'
	| 'held'
	| 'decision'
	| 'stubTopY'
	| 'spaceId'
	| 'classified'
	| 'sticky'
	| 'setMode'
	| 'setHeld'
	| 'evaluate'
	| 'setSelectionHosts'
	| 'effective'
	| 'reset'
>;
