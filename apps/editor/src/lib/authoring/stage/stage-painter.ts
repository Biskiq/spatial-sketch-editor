/**
 * **Paint**, a host tool that applies the armed pick to what the creator
 * touches (T2.S4a, T2.S8 U2).
 *
 * Paint asks every binding that declares host tool `paint` for one winner, the
 * same spatial arbitration the Eraser uses: a Wall, an overhead entity, an
 * Artwork or a Light in front of a Scene object keeps the press, so Paint never
 * reaches through it. The winning domain answers whether that subject is
 * paintable; Paint writes nothing on a refusal and never skips to an object
 * behind it. A lifted overhead no longer wins, so interior objects become
 * reachable without a second picking path.
 *
 * **A stroke is one gesture and one write.** A press on a paintable subject
 * begins a stroke; moving across further subjects adds them; release commits
 * every one in a single acceptance, so one Undo reverses the whole stroke. A
 * stroke paints one kind (Scene objects, or Layout surfaces): a subject of the
 * other kind, or one the domain refuses, is skipped without ending the stroke.
 * Escape, a pointer cancel, a Stage reading change or a source install cancel
 * the stroke and write nothing. A press that slides off its only subject and
 * releases there is also a cancel, which is how a single click is abandoned.
 *
 * A colour pick (U3) coats instead of replacing: the line names the relief it
 * keeps, and a subject that takes no coat (a model's own materials) refuses in
 * place and is skipped by the stroke.
 *
 * Paint never edits a Finish, so it never opens the shared-Finish Ask. The
 * Finish service owns the active pick, the dropper flag and the recents; this
 * controller only translates a press.
 */
import type { StageFacade, StageSourceHit } from './stage-facade';
import { surfaceKey, type LayoutSurfaceRef, type SpaceSurfaceExclusion } from '@portfolio/layout-core/plan';
import type { StagePaintSpaceScope } from './stage-facade';
import type { GestureAcquisition } from './stage-session';
import type { PaintRadius } from '../look/paint-pick';
import type { CoatReading } from '../look/colour-coat-port';

type PaintableSurface = LayoutSurfaceRef;

export const STAGE_PAINT_TASK = 'host-paint';

/** The words a Paint answer uses for one surface identity. */
function surfaceNoun(surface: LayoutSurfaceRef): string {
	switch (surface.kind) {
		case 'wall-side': return 'Wall face';
		case 'room-floor': return 'floor';
		case 'room-lid': return 'lid';
		case 'region-face': return `Region ${surface.face}`;
	}
}

/** A Space scope never hides what it skips: a straddling Region is named. */
function excludedWords(excluded: readonly SpaceSurfaceExclusion[]): string {
	const spansSpaces = excluded.filter((entry) => entry.reason === 'spans-spaces').length;
	if (spansSpaces === 0) return '';
	return ` · ${spansSpaces} Region${spansSpaces === 1 ? '' : 's'} ${spansSpaces === 1 ? 'spans' : 'span'} two Spaces, skipped`;
}

export type StagePaintCandidate = {
	readonly adapterId: string;
	readonly hit: StageSourceHit;
	readonly entityId: string | null;
	readonly surface: PaintableSurface | null;
	readonly space: StagePaintSpaceScope | null;
	/** The immutable gesture-time expansion a Surface/Space Paint will assign. */
	readonly assignmentSurfaces: readonly PaintableSurface[];
	readonly consequence: string | null;
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
	/** Shift paints the whole Space for this gesture only. */
	readonly shift?: boolean;
	/** Alt samples the pointed Finish for this gesture only, without arming the dropper. */
	readonly alt?: boolean;
};

export type StagePaintOptions = {
	/** The service's live active pick; `false` means Paint has nothing to apply. */
	readonly hasActive: () => boolean;
	/** Whether every one of these objects already wears the active pick. */
	readonly isAlready: (entityIds: readonly string[]) => boolean;
	/** One acceptance for every object of the stroke. */
	readonly assign: (entityIds: readonly string[]) => Promise<boolean>;
	readonly isSurfaceAlready: (surfaces: readonly PaintableSurface[]) => boolean;
	readonly assignSurface: (surfaces: readonly PaintableSurface[]) => Promise<boolean>;
	readonly dropperArmed: () => boolean;
	readonly copy: (hit: StageSourceHit) => Promise<boolean>;
	readonly copySurface: (surface: PaintableSurface) => Promise<boolean>;
	readonly surfaceScope?: () => PaintRadius;
	readonly setSurfaceScope?: (scope: PaintRadius) => void;
	readonly activeLabel: () => string;
	/**
	 * A sample that does not change the pick (the Material editor's draft retarget)
	 * names what it did instead of `Sampled · <pick>`; `null` keeps the default.
	 */
	readonly sampleMessage?: () => string | null;
	/** What the pointed surface or object wears now, for the consequence line; `null` when it has no named Finish. */
	/** Clock for long-press sampling; tests inject one. */
	readonly now?: () => number;
	readonly wornLabel?: (target: { readonly surface: PaintableSurface } | { readonly entityId: string }) => string | null;
	/**
	 * What the active **colour** pick does to a target (U3): refuse in place, or
	 * coat it keeping the named relief. `null` when the pick is a material.
	 */
	readonly coatReading?: (target: { readonly surface: PaintableSurface } | { readonly entityId: string }) => CoatReading | null;
	/**
	 * A click that painted exactly one subject (U4): the host selects it and opens
	 * its Finish on the Card. Paint stays armed. A drag across several subjects or
	 * a Space paint never calls this — the selection stays where it was.
	 */
	readonly onPaintedOne?: (target: StagePaintCandidate) => void;
};

export type StagePaintStroke = {
	readonly kind: 'object' | 'surface';
	/** Subjects the stroke will write: objects, or surfaces after Space expansion. */
	readonly count: number;
};

export type StagePaintController = {
	hover(input: PointerInput | null): void;
	down(input: PointerInput): boolean;
	move(input: PointerInput): void;
	up(input: PointerInput): Promise<void>;
	cancel(): void;
	candidate(): StagePaintCandidate | null;
	notice(): StagePaintNotice | null;
	/** The live stroke, once it has at least one paintable subject. */
	stroke(): StagePaintStroke | null;
	clear(): boolean;
	pressing(): boolean;
	surfaceScope(): PaintRadius;
	setSurfaceScope(scope: PaintRadius): void;
};

function subjectKey(candidate: StagePaintCandidate): string {
	return candidate.surface !== null
		? `surface:${surfaceKey(candidate.surface)}`
		: `${candidate.adapterId}:${candidate.hit.sourceKind}:${candidate.hit.sourceId}`;
}

function sameSubject(a: StagePaintCandidate | null, b: StagePaintCandidate | null): boolean {
	return (
		a !== null &&
		b !== null &&
		a.adapterId === b.adapterId &&
		a.hit.sourceId === b.hit.sourceId &&
		a.hit.sourceKind === b.hit.sourceKind &&
		(a.surface === null ? null : surfaceKey(a.surface)) === (b.surface === null ? null : surfaceKey(b.surface)) &&
		(a.assignmentSurfaces[0] === undefined ? null : surfaceKey(a.assignmentSurfaces[0])) ===
			(b.assignmentSurfaces[0] === undefined ? null : surfaceKey(b.assignmentSurfaces[0]))
	);
}

type Press = {
	readonly lease: GestureAcquisition;
	/** The subject under the press, painted or not. */
	readonly first: StagePaintCandidate;
	readonly scope: PaintRadius;
	/** Alt at press: sample this Finish instead of painting. */
	readonly sample: boolean;
	/** A touch press: held still on one subject for LONG_PRESS_MS, it samples instead of painting. */
	readonly coarse: boolean;
	readonly startedAt: number;
	/** The paintable subjects the stroke has crossed, in order. */
	readonly targets: StagePaintCandidate[];
	readonly keys: Set<string>;
	kind: 'object' | 'surface' | null;
	cancelled: boolean;
};

/** The approved design's coarse-pointer dropper: a press held this long on one subject samples it. */
export const LONG_PRESS_MS = 500;

export function createStagePainter(
	facade: StageFacade,
	options: StagePaintOptions,
	onChange: () => void = () => {}
): StagePaintController {
	let current: StagePaintCandidate | null = null;
	let notice: StagePaintNotice | null = null;
	let press: Press | null = null;
	let source = facade.snapshot();
	let inFlight = false;
	/**
	 * Bumped only by the creator's own interruptions (cancel, clear, a reach
	 * change). A stroke's own write changes the source, so it must not count as
	 * one: the stroke still reports its result and opens what it painted.
	 */
	let strokeGeneration = 0;
	let scope: PaintRadius = options.surfaceScope?.() ?? 'surface';

	function syncSource(): void {
		const next = facade.snapshot();
		if (next === source) return;
		source = next;
		endPress();
		current = null;
		notice = null;
	}

	/**
	 * The consequence line of the approved design: `<pick> replaces <current> on
	 * <target>`. Without a pick it stays the plain verb; without a named current
	 * Finish it names only the pick and the target.
	 */
	function pickWords(): string {
		return options.hasActive() ? `${options.activeLabel()} on` : 'Paint';
	}
	function replaceWords(worn: string | null, target: string): string {
		if (!options.hasActive()) return `Paint ${target}`;
		const pick = options.activeLabel();
		return worn !== null && worn !== pick ? `${pick} replaces ${worn} on ${target}` : `${pick} on ${target}`;
	}

	/** A colour keeps the target's relief and sheen: `Sage on this wall · keeps Oak relief and sheen`. */
	function coatWords(reading: CoatReading & { kind: 'coat' }, target: string): string {
		const keeps = reading.keeps === null ? '' : ` · keeps ${reading.keeps} relief and sheen`;
		return `${options.activeLabel()} on ${target}${keeps}`;
	}

	function candidateAt(input: PointerInput, reach: PaintRadius): StagePaintCandidate | null {
		syncSource();
		const target = facade.hostToolTarget({ ...input, tool: 'paint' });
		if (target.kind !== 'hit') return null;
		const reading = facade.evaluation()?.renderedReading === 'plan' ? 'plan' : '3d';
		const answer = facade.paintAnswer(target.adapterId, target.hit, reading);
		if (answer === null) {
			return {
				adapterId: target.adapterId,
				hit: target.hit,
				entityId: null,
				surface: null,
				space: null,
				assignmentSurfaces: [],
				consequence: null,
				refusal: 'That cannot be painted.'
			};
		}
		if (answer.kind === 'refused') {
			return {
				adapterId: target.adapterId,
				hit: target.hit,
				entityId: null,
				surface: null,
				space: null,
				assignmentSurfaces: [],
				consequence: null,
				refusal: answer.message
			};
		}
		if (answer.kind === 'paintable-surface') {
			const surface = answer.surface;
			const space = answer.space;
			const assignmentSurfaces = reach === 'surface'
				? [surface]
				: space.kind === 'unique' ? space.surfaces : [];
			const refusal = reach === 'space'
				? space.kind === 'none'
					? 'That surface isn’t inside a space.'
					: space.kind === 'ambiguous'
						? surface.kind === 'wall-side'
							? 'This wall side belongs to two rooms.'
							: 'That surface belongs to more than one space.'
						: assignmentSurfaces.length === 0 ? 'That space has no paintable surfaces.' : null
				: null;
			const hit: StageSourceHit = surface.kind === 'wall-side' && target.hit.reference === undefined
				? { ...target.hit, subRef: { kind: 'component', componentId: `side:${surface.side}` } }
				: target.hit;
			const coat = options.coatReading?.({ surface }) ?? null;
			const consequence = reach === 'space' && space.kind === 'unique'
				? `${pickWords()} ${assignmentSurfaces.length} surface${assignmentSurfaces.length === 1 ? '' : 's'} in this Space${excludedWords(space.excluded)}`
				: coat?.kind === 'coat'
					? coatWords(coat, `this ${surfaceNoun(surface)}`)
					: replaceWords(options.wornLabel?.({ surface }) ?? null, `this ${surfaceNoun(surface)}`);
			return {
				adapterId: target.adapterId,
				hit,
				entityId: null,
				surface,
				space,
				assignmentSurfaces,
				consequence,
				refusal: target.refusal ?? refusal ?? (reach === 'surface' && coat?.kind === 'refused' ? coat.message : null)
			};
		}
		const coat = options.coatReading?.({ entityId: answer.entityId }) ?? null;
		return {
			adapterId: target.adapterId,
			hit: target.hit,
			entityId: answer.entityId,
			surface: null,
			space: null,
			assignmentSurfaces: [],
			consequence: coat?.kind === 'coat'
				? coatWords(coat, 'this object')
				: replaceWords(options.wornLabel?.({ entityId: answer.entityId }) ?? null, 'this object'),
			refusal: target.refusal ?? (coat?.kind === 'refused' ? coat.message : null)
		};
	}

	function reachFor(input: PointerInput): PaintRadius {
		return input.shift === true ? 'space' : scope;
	}

	function endPress(): void {
		const ending = press;
		press = null;
		if (ending?.lease.kind === 'granted' && ending.lease.lease.active) ending.lease.lease.release();
	}

	function addToStroke(stroke: Press, candidate: StagePaintCandidate): void {
		if (candidate.refusal !== null) return;
		const kind = candidate.surface !== null ? 'surface' : candidate.entityId !== null ? 'object' : null;
		if (kind === null) return;
		if (stroke.kind !== null && stroke.kind !== kind) return;
		const key = subjectKey(candidate);
		if (stroke.keys.has(key)) return;
		stroke.kind = kind;
		stroke.keys.add(key);
		stroke.targets.push(candidate);
	}

	function strokeSurfaces(targets: readonly StagePaintCandidate[]): PaintableSurface[] {
		const seen = new Set<string>();
		const surfaces: PaintableSurface[] = [];
		for (const target of targets) {
			for (const surface of target.assignmentSurfaces) {
				const key = surfaceKey(surface);
				if (seen.has(key)) continue;
				seen.add(key);
				surfaces.push(surface);
			}
		}
		return surfaces;
	}

	async function sampleFrom(target: StagePaintCandidate, css: readonly [number, number]): Promise<void> {
		if (target.refusal !== null || (target.entityId === null && target.surface === null)) {
			notice = { kind: 'refused', message: target.refusal ?? 'That cannot be painted.', css };
			return;
		}
		const copied = target.surface === null
			? await options.copy(target.hit)
			: await options.copySurface(target.surface);
		notice = copied
			? { kind: 'accepted', message: options.sampleMessage?.() ?? `Sampled · ${options.activeLabel()}`, css }
			: { kind: 'refused', message: 'That has no Finish colour.', css };
		onChange();
	}

	async function commit(ending: Press, css: readonly [number, number]): Promise<void> {
		if (ending.targets.length === 0) {
			const target = ending.first;
			notice = {
				kind: 'refused',
				message: target.refusal ?? 'That cannot be painted.',
				css
			};
			return;
		}
		if (!options.hasActive()) {
			notice = { kind: 'refused', message: 'Choose a Finish first.', css };
			return;
		}
		const surfaceStroke = ending.kind === 'surface';
		const assignedSurfaces = surfaceStroke ? strokeSurfaces(ending.targets) : [];
		const entityIds = surfaceStroke ? [] : ending.targets.map((target) => target.entityId!);
		if (surfaceStroke ? options.isSurfaceAlready(assignedSurfaces) : options.isAlready(entityIds)) {
			notice = { kind: 'already', message: `Already ${options.activeLabel()}`, css };
			return;
		}
		const generation = strokeGeneration;
		inFlight = true;
		try {
			const accepted = surfaceStroke
				? await options.assignSurface(assignedSurfaces)
				: await options.assign(entityIds);
			syncSource();
			if (generation !== strokeGeneration) return;
			const count = surfaceStroke ? assignedSurfaces.length : entityIds.length;
			if (accepted && ending.targets.length === 1 && ending.scope !== 'space' && (!surfaceStroke || assignedSurfaces.length === 1)) {
				options.onPaintedOne?.(ending.targets[0]!);
			}
			notice = accepted
				? {
						kind: 'accepted',
						message: `Painted ${options.activeLabel()}${count > 1 || surfaceStroke ? ` · ${count} ${surfaceStroke ? 'surface' : 'object'}${count === 1 ? '' : 's'}` : ''}`,
						css
					}
				: null;
		} catch {
			if (generation === strokeGeneration) {
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
			const next = input === null || input.coarse === true ? null : candidateAt(input, reachFor(input));
			// The same subject is re-read when its line changes (a new pick while hovering).
			if (!sameSubject(next, current) || (next === null) !== (current === null) || next?.consequence !== current?.consequence) current = next;
		},
		down(input) {
			if (inFlight || press !== null) return false;
			const sampling = input.alt === true || options.dropperArmed();
			const coarse = input.coarse === true;
			// A touch press may become a long-press sample, so it is held even with nothing picked.
			if (!options.hasActive() && !sampling && !coarse) {
				notice = {
					kind: 'refused',
					message: 'Choose a Finish in Library › Finishes, or in the object’s Card.',
					css: input.css
				};
				return false;
			}
			const reach = reachFor(input);
			const target = candidateAt(input, reach);
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
			const stroke: Press = {
				lease,
				first: target,
				scope: reach,
				sample: sampling,
				coarse,
				startedAt: (options.now ?? defaultNow)(),
				targets: [],
				keys: new Set(),
				kind: null,
				cancelled: false
			};
			if (!sampling) addToStroke(stroke, target);
			press = stroke;
			current = target;
			notice = null;
			return true;
		},
		move(input) {
			if (press === null) return;
			const stroke = press;
			const under = candidateAt(input, stroke.scope);
			if (press !== stroke) return;
			if (stroke.sample) {
				// A sample is one subject: leaving it before release abandons it.
				if (!sameSubject(under, stroke.first)) stroke.cancelled = true;
				current = stroke.cancelled ? null : stroke.first;
				return;
			}
			if (under !== null) addToStroke(stroke, under);
			current = under !== null && under.refusal === null ? under : stroke.targets[stroke.targets.length - 1] ?? null;
		},
		async up(input) {
			syncSource();
			const ending = press;
			if (ending === null) return;
			const under = candidateAt(input, ending.scope);
			endPress();
			if (input.coarse === true) current = null;
			if (ending.cancelled) return;
			if (ending.sample) {
				if (sameSubject(under, ending.first)) await sampleFrom(ending.first, input.css);
				return;
			}
			if (
				ending.coarse &&
				ending.targets.length <= 1 &&
				sameSubject(under, ending.first) &&
				(options.now ?? defaultNow)() - ending.startedAt >= LONG_PRESS_MS
			) {
				await sampleFrom(ending.first, input.css);
				return;
			}
			if (ending.targets.length === 0) {
				// A press on something that cannot be painted answers in place.
				if (sameSubject(under, ending.first)) await commit(ending, input.css);
				return;
			}
			// One subject: releasing off it abandons the click. A stroke that crossed
			// several commits wherever it ends.
			if (ending.targets.length === 1 && !sameSubject(under, ending.targets[0]!)) return;
			await commit(ending, input.css);
		},
		cancel() {
			endPress();
			current = null;
			notice = null;
			strokeGeneration += 1;
		},
		candidate() {
			syncSource();
			return current;
		},
		notice() {
			syncSource();
			return notice;
		},
		stroke() {
			if (press === null || press.kind === null) return null;
			return {
				kind: press.kind,
				count: press.kind === 'surface' ? strokeSurfaces(press.targets).length : press.targets.length
			};
		},
		clear() {
			strokeGeneration += 1;
			const had = notice !== null || press !== null || current !== null;
			endPress();
			notice = null;
			current = null;
			return had;
		},
		pressing() {
			return press !== null;
		},
		surfaceScope() {
			return options.surfaceScope?.() ?? scope;
		},
		setSurfaceScope(next) {
			if (scope === next) return;
			scope = next;
			options.setSurfaceScope?.(next);
			current = null;
			notice = null;
			strokeGeneration += 1;
			onChange();
		}
	};
}

function defaultNow(): number {
	return typeof performance === 'undefined' ? Date.now() : performance.now();
}
