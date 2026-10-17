/**
 * The public editor host facade — the consumer boundary of
 * `T1.viewport-projection@1`.
 *
 * Everything a T2/T3 adapter may use is here, and nothing else. A domain adapter
 * registers through `registerStageAdapter`, projects and picks through the **same**
 * evaluation the meshes were drawn with, and reaches no private Stage state. The
 * facade owns:
 *
 * - the one current `ViewportEvaluation` and the id that names it, so projection,
 *   rays, overlays and the renderer cannot disagree about which matrices are live;
 * - the Layout-owned ordinary Plan evaluation and its **eligible** fragment
 *   projection, so hidden or excluded targets cannot intercept input;
 * - one canonical selection, one task home and the gesture lease, delegated to the
 *   session host (never a second selection or history);
 * - the one accepted-source slot and its **content change** transition: the same
 *   project with new content keeps the view exactly where it is — same pose, and
 *   its own inspection claim re-acquired against the new source revision — while a
 *   new project identity is a replacement the host mounts with a fresh view;
 * - editor-only adapter registration with **explicit capability refusal**: an
 *   adapter that requires a capability this host does not provide refuses to mount
 *   rather than mounting degraded.
 *
 * No writable store crosses the boundary: an adapter receives read access and
 * deliberate selection/intent requests, not the host's state.
 */
import {
	projectWorld,
	pointerRay,
	intersectWorkingPlane,
	type PointerRay,
	type PointerRayResult,
	type ProjectWorldResult,
	type InspectionPose,
	type ViewingIntent,
	type ViewingIntentResult,
	type ViewportCameraState,
	type ViewportEvaluation,
	type ViewportEvaluationToken,
	type WorkingPlane,
	type WorkingPlaneHit
} from '@portfolio/camera-core';
import type { Vec3 } from '@portfolio/camera-core';
import {
	evaluateLayoutPlan,
	eligiblePlanFragments,
	pointInPolygon,
	type LayoutVec2,
	type PlanEvaluationResult,
	type PlanFragment,
	type PlanSourceKind,
	type PlanSubRef,
	type PlanStream
} from '@portfolio/layout-core';
import { requestCameraOutput } from '@portfolio/project-model';
import type {
	CameraOutputClaim,
	CameraOutputDecision,
	CameraOutputPolicy,
	CameraOutputRefusal,
	CameraOutputTicket
} from '@portfolio/project-model';

import { planParameters, type PlanParameterOverrides } from './plan-parameters';
import { createCameraSession, evaluationIdOf, type CameraSession } from './camera-session';
import type { StageReadSnapshot } from './source-admission';
import type {
	GestureAcquisition,
	StageSelection,
	StageSession,
	StageTask
} from './stage-session';

/** The capabilities this host actually provides. Anything else refuses mounting. */
export const HOST_STAGE_CAPABILITIES: readonly string[] = [
	'viewport-projection-v1',
	'layout-plan-representation-v1',
	'stage-selection-v1',
	'stage-instrument-v1'
];

/** Screen-space tolerance for a Plan hit, in CSS pixels. */
export const PLAN_HIT_TOLERANCE_CSS_PX = 8;

const PLAN_KIND_ORDER: Readonly<Record<PlanSourceKind, number>> = {
	wall: 0,
	opening: 1,
	object: 2,
	'room-floor': 3
};

export type StageHitCandidate = {
	readonly evaluationId: string;
	readonly css: readonly [number, number];
};

export type StageSourceHit = {
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	readonly generationId: string;
	readonly stream: PlanStream;
	readonly subRef: PlanSubRef | null;
	readonly worldPoint: Vec3;
};

export type ResolvedStageHit =
	| { readonly kind: 'resolved'; readonly hit: StageSourceHit }
	/**
	 * Nothing selectable is under the candidate.
	 *
	 * A source the Plan excluded places **no fragment at all** (the evaluator emits a
	 * placement only for an eligible candidate), so an excluded target cannot
	 * intercept input by construction — there is no filter at the hit test that a
	 * defect could mis-set. The reason is therefore always "no fragment here", and a
	 * caller that needs to explain an exclusion reads membership, which is the
	 * surface that owns exclusions and their Reveal.
	 */
	| { readonly kind: 'none'; readonly reason: 'no-fragment' }
	| {
			readonly kind: 'failed';
			readonly code: 'stale-evaluation' | 'invalid-css-point' | 'invalid-viewport' | 'degenerate-ray' | 'parallel' | 'behind' | 'outside-supported-domain' | 'invalid-frame';
	  };

export type StageOverlayContribution = {
	readonly id: string;
	readonly css: readonly [number, number];
	readonly label: string;
};

export type StageWorldGraphic = {
	readonly id: string;
	readonly kind: string;
	readonly world: Vec3;
};

export type StageAdapterContext = {
	readonly snapshot: StageReadSnapshot;
	readonly evaluation: ViewportEvaluation;
	readonly evaluationId: string;
	project(point: Vec3): readonly [number, number] | null;
	ray(css: readonly [number, number]): PointerRay | null;
	intersect(ray: PointerRay, plane: WorkingPlane): WorkingPlaneHit;
	selection(): StageSelection | null;
	select(selection: StageSelection | null): void;
	requestIntent(intent: ViewingIntent, clockSeconds: number): StageIntentResult;
};

export type StageAdapter = {
	readonly id: string;
	/** Capabilities this adapter requires the host to provide. Unknown ones refuse mounting. */
	readonly requiredCapabilities?: readonly string[];
	readonly overlay?: (context: StageAdapterContext) => readonly StageOverlayContribution[];
	readonly graphics?: (context: StageAdapterContext) => readonly StageWorldGraphic[];
	/**
	 * Claim a hit for this candidate, or `null` to leave it to the next claimant.
	 *
	 * Consulted in registration order **before** the built-in Layout Plan
	 * resolution, with the same live evaluation the meshes were drawn from, so a
	 * domain adapter can pick its own 3D subjects (a Scene object on a Wall). The
	 * host arbitrates eligible candidates, never one global priority among domains.
	 */
	readonly hitProvider?: (candidate: StageHitCandidate, context: StageAdapterContext) => StageSourceHit | null;
	readonly selectionEcho?: (selection: StageSelection | null) => void;
};

export type StageAdapterRegistration =
	| { readonly kind: 'registered'; readonly id: string; dispose(): void }
	| {
			readonly kind: 'refused';
			readonly code: 'unknown-required-capability' | 'duplicate-adapter';
			readonly missing: readonly string[];
			readonly message: string;
	  };

/**
 * The intent result is the seam's vocabulary: `accepted`, `rejected` and
 * `superseded`. `superseded` is the ownership answer — the run presenting the
 * ticket no longer holds the inspection output — and is deliberately distinct from
 * a domain rejection.
 */
export type StageIntentResult =
	| ViewingIntentResult
	| {
			readonly kind: 'superseded';
			readonly state: ViewportCameraState;
			readonly message: string;
			/** The protocol's own refusal, when it was a refusal rather than a spent claim. */
			readonly reason?: CameraOutputRefusal;
	  };

/**
 * The outcome of installing changed content for the already-mounted project.
 *
 * `installed` is the whole post-edit transition: the accepted slot swapped, every
 * adapter registration ended (a domain adapter binds to the source it was built
 * from), the live claim rebased onto the new source revision, and a fresh
 * inspection claim acquired at the **same** pose. `unchanged` is the identical
 * content case: nothing is rebased and the live claim stays in place. `refused`
 * means the caller is looking at a different project identity (a replacement) or
 * has nothing mounted yet, and the host must mount it instead.
 */
export type StageContentInstall =
	| {
			readonly kind: 'installed';
			readonly previousSourceContentId: string;
			readonly sourceContentId: string;
			/** The pose the view continues at; identical to the pose it had before. */
			readonly pose: InspectionPose;
			/** The claim the source rebase ended, when one was live. */
			readonly endedClaim: CameraOutputClaim | null;
			/** The fresh claim re-acquired for the new source revision. */
			readonly claim: CameraOutputClaim | null;
			readonly endedAdapters: readonly string[];
			readonly clearedSelection: boolean;
			readonly closedTask: boolean;
			readonly releasedGestures: number;
	  }
	| { readonly kind: 'unchanged'; readonly sourceContentId: string; readonly claim: CameraOutputClaim | null }
	| {
			readonly kind: 'refused';
			readonly code: 'disposed' | 'no-current-source' | 'different-project' | 'stale-session';
			readonly message: string;
	  };

export type StageFacade = {
	/** The one current accepted source; it changes only through a content change. */
	snapshot(): StageReadSnapshot;
	readonly session: StageSession;
	readonly camera: CameraSession;
	evaluation(): ViewportEvaluation | null;
	evaluationId(): string | null;
	projectWorld(point: unknown, evaluationId: string): ProjectWorldResult;
	pointerRay(cssPoint: unknown, evaluationId: string): PointerRayResult;
	intersectWorkingPlane(ray: PointerRay, plane: WorkingPlane, evaluationId: string): WorkingPlaneHit;
	/** Submit a viewing intent; the run must present the current inspection ticket. */
	requestViewingIntent(intent: ViewingIntent, ticket: CameraOutputTicket | null, clockSeconds: number): StageIntentResult;
	/** Acquire the host's own inspection claim on the current output at the current pose. */
	acquireInspection(policy?: CameraOutputPolicy): CameraOutputDecision;
	/** The live inspection claim, or `null` while the output is free. */
	inspectionClaim(): CameraOutputClaim | null;
	/** The live inspection ticket a run must present for a viewing intent. */
	inspectionTicket(): CameraOutputTicket | null;
	/** A same-project content change: the view stays, the output is re-acquired. */
	installAccepted(next: StageReadSnapshot): StageContentInstall;
	plan(overrides?: PlanParameterOverrides): PlanEvaluationResult;
	/**
	 * The host's current Plan parameters. Reveal is creator intent that must widen
	 * **hit** eligibility as well as display, so it is host state the hit path reads
	 * too — never a per-call argument that could disagree with the render.
	 */
	setPlanParameters(overrides: PlanParameterOverrides): void;
	eligibleFragments(): readonly PlanFragment[];
	resolveSourceHit(candidate: StageHitCandidate): ResolvedStageHit;
	selection(): StageSelection | null;
	select(selection: StageSelection | null): void;
	openTask(task: StageTask): boolean;
	closeTask(): boolean;
	registerStageAdapter(adapter: StageAdapter): StageAdapterRegistration;
	adapters(): readonly StageAdapter[];
	overlays(): readonly StageOverlayContribution[];
	graphics(): readonly StageWorldGraphic[];
	acquireGesture(request: {
		owner: string;
		evaluationId: string;
		policy: 'continue-after-revalidation' | 'suspend-proposal' | 'cancel-on-reading-change';
	}): GestureAcquisition;
	dispose(): void;
};

function tokenOf(evaluation: ViewportEvaluation): ViewportEvaluationToken {
	return evaluation.token;
}

/** The closest point on one CSS segment to a CSS point, as a `[distance, amount]` pair. */
function closestOnCssSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): { readonly distance: number; readonly amount: number } {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const squared = dx * dx + dy * dy;
	if (squared === 0) {
		return { distance: Math.hypot(point[0] - start[0], point[1] - start[1]), amount: 0 };
	}
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return {
		distance: Math.hypot(point[0] - (start[0] + dx * amount), point[1] - (start[1] + dy * amount)),
		amount
	};
}

/**
 * The distance, in **CSS pixels**, from a pointer position to one fragment's drawn
 * geometry — the surface the creator is actually pointing at.
 *
 * This replaces a datum-plane-only pick, which measured plan metres from a point
 * that the ray reached at floor level: in the 3D reading that point sits metres
 * behind the surface under the pointer, so a visible Wall could not be selected at
 * all. Proximity is a screen question and the drawing is where the creator looks, so
 * the test is made where both agree, through the one live evaluation.
 */
function cssDistanceToFragment(
	css: readonly [number, number],
	fragment: PlanFragment,
	datumMeters: number,
	project: (point: Vec3) => readonly [number, number] | null
): number | null {
	const elevation = fragment.elevationMeters;
	const projectAt = (point: LayoutVec2, height: number): readonly [number, number] | null =>
		project([point[0], height, point[1]]);

	const geometry = fragment.geometry;
	const segments: (readonly [LayoutVec2, LayoutVec2])[] = [];
	if (geometry.kind === 'span') {
		segments.push([geometry.start, geometry.end]);
	} else if (geometry.kind === 'polyline') {
		for (let index = 1; index < geometry.polyline.length; index += 1) {
			segments.push([geometry.polyline[index - 1]!, geometry.polyline[index]!]);
		}
	} else {
		for (let index = 0; index < geometry.polygon.length; index += 1) {
			segments.push([geometry.polygon[index]!, geometry.polygon[(index + 1) % geometry.polygon.length]!]);
		}
	}

	let best: number | null = null;
	const consider = (distance: number): void => {
		best = best === null ? distance : Math.min(best, distance);
	};
	const considerSegment = (
		start: readonly [number, number] | null,
		end: readonly [number, number] | null
	): void => {
		// A segment with an endpoint behind the camera is not something the pointer
		// can be over; skipping it also keeps a mirrored projection out of the test.
		if (start === null || end === null) return;
		consider(closestOnCssSegment(css, start, end).distance);
	};

	for (const [startPlan, endPlan] of segments) {
		considerSegment(projectAt(startPlan, elevation), projectAt(endPlan, elevation));
		if (geometry.kind === 'polygon' || elevation === datumMeters) continue;
		// A Wall is drawn as a **face**, not a line: the band between its footprint
		// and its top edge. Testing only the top line made a click on the middle of a
		// visible Wall fall through, because the ray had already passed the face by the
		// time it reached the floor. The quad is made of the fragment's own two
		// heights through the same projection — no second geometry authority.
		const startBase = projectAt(startPlan, datumMeters);
		const endBase = projectAt(endPlan, datumMeters);
		considerSegment(startBase, endBase);
		considerSegment(startBase, projectAt(startPlan, elevation));
		considerSegment(endBase, projectAt(endPlan, elevation));
		const face: [number, number][] = [];
		for (const corner of [startBase, endBase, projectAt(endPlan, elevation), projectAt(startPlan, elevation)]) {
			if (corner !== null) face.push([corner[0], corner[1]]);
		}
		if (face.length === 4 && pointInPolygon([css[0], css[1]], face)) return 0;
	}

	if (geometry.kind === 'polygon') {
		// Inside the drawn footprint the pointer is on the surface itself.
		const projected: [number, number][] = [];
		for (const point of geometry.polygon) {
			const cssPoint = projectAt(point, elevation);
			if (cssPoint !== null) projected.push([cssPoint[0], cssPoint[1]]);
		}
		if (projected.length === geometry.polygon.length && pointInPolygon([css[0], css[1]], projected)) return 0;
	}
	return best;
}

function compareFragments(left: PlanFragment, right: PlanFragment): number {
	const kindDelta = PLAN_KIND_ORDER[left.ref.sourceKind] - PLAN_KIND_ORDER[right.ref.sourceKind];
	if (kindDelta !== 0) return kindDelta;
	if (left.ref.sourceId !== right.ref.sourceId) return left.ref.sourceId < right.ref.sourceId ? -1 : 1;
	const leftStart = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.start : 0;
	const rightStart = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.start : 0;
	return leftStart - rightStart;
}

/**
 * The world point a resolved hit reports: the pointer's ray on the plane at the
 * fragment's own height.
 *
 * A datum-only point would name the floor under a Wall rather than the surface the
 * creator pointed at. When the ray cannot reach that plane (a nearly horizontal
 * view), the fragment's first drawn point is the honest fallback rather than an
 * invented position.
 */
function worldPointOnFragment(
	css: readonly [number, number],
	fragment: PlanFragment,
	evaluation: ViewportEvaluation,
	token: ViewportEvaluationToken
): Vec3 {
	const elevation = fragment.elevationMeters;
	const ray = pointerRay(css, evaluation, token);
	if (ray.kind === 'ray') {
		const hit = intersectWorkingPlane(
			ray.ray,
			{
				originMeters: [0, elevation, 0],
				normal: [0, 1, 0],
				yawRadians: 0,
				datumMeters: elevation,
				supportedLocalExtent: null
			},
			evaluation,
			token
		);
		if (hit.kind === 'intersected') return hit.worldPoint;
	}
	const geometry = fragment.geometry;
	const first: LayoutVec2 =
		geometry.kind === 'span'
			? geometry.start
			: geometry.kind === 'polyline'
				? (geometry.polyline[0] ?? [0, 0])
				: (geometry.polygon[0] ?? [0, 0]);
	return [first[0], elevation, first[1]];
}

/** The working plane the Plan hit path intersects: the level datum, unbounded. */
export function datumWorkingPlane(datumMeters: number): WorkingPlane {
	return {
		originMeters: [0, datumMeters, 0],
		normal: [0, 1, 0],
		yawRadians: 0,
		datumMeters,
		supportedLocalExtent: null
	};
}

export function createStageFacade(input: {
	readonly snapshot: StageReadSnapshot;
	readonly session: StageSession;
	readonly viewportId?: string;
	readonly outputId?: string;
}): StageFacade {
	const { session } = input;
	let currentSnapshot = input.snapshot;
	const camera = createCameraSession({
		snapshot: currentSnapshot,
		viewportId: input.viewportId ?? 'stage',
		// The output identity is unique per *replacement lifetime*, not per epoch string:
		// a host that re-admitted under the same session epoch still gets a fresh output,
		// so a retained ticket from the previous project cannot qualify against it.
		outputId: input.outputId ?? `output:${currentSnapshot.sessionEpoch}:${session.token().epoch}`
	});
	/** Registration id → adapter and the disposer that ends it. */
	const adapters = new Map<string, { adapter: StageAdapter; dispose: () => void }>();
	/** The host's own inspection run order, minted strictly newer than every accepted epoch. */
	let inspectionRun = 0;
	let disposed = false;

	/**
	 * The next host inspection run epoch. It is monotonic over this output's whole
	 * session, including across a source rebase (which keeps the epoch floor), so a
	 * re-acquisition can never re-enter with a spent epoch.
	 */
	function nextInspectionRun(): number {
		inspectionRun = Math.max(inspectionRun + 1, camera.output().epochFloor + 1);
		return inspectionRun;
	}

	function currentToken(): ViewportEvaluationToken | null {
		const evaluation = camera.evaluation();
		return evaluation === null ? null : tokenOf(evaluation);
	}

	/** The host's live Plan parameters: calibration defaults plus what the host set. */
	let planOverrides: PlanParameterOverrides = {};

	function planFor(overrides?: PlanParameterOverrides): PlanEvaluationResult {
		return evaluateLayoutPlan(currentSnapshot.domain.geometry, planParameters(overrides ?? planOverrides), {
			generationId: currentSnapshot.compileGeneration,
			target: [camera.state().pose.target[0], camera.state().pose.target[2]],
			datumMeters: currentSnapshot.domain.datumMeters
		});
	}

	function adapterContext(): StageAdapterContext | null {
		const evaluation = camera.evaluation();
		if (evaluation === null) return null;
		const token = tokenOf(evaluation);
		const id = evaluationIdOf(evaluation);
		return {
			snapshot: currentSnapshot,
			evaluation,
			evaluationId: id,
			project(point) {
				const result = projectWorld(point, evaluation, token);
				return result.kind === 'projected' ? result.css : null;
			},
			ray(css) {
				const result = pointerRay(css, evaluation, token);
				return result.kind === 'ray' ? result.ray : null;
			},
			intersect(ray, plane) {
				return intersectWorkingPlane(ray, plane, evaluation, token);
			},
			selection: () => session.selection(),
			select: (selection) => select(selection),					// The adapter names the clock: an adapter-initiated transition starts at
					// the caller's own time, never at a fabricated zero that would make every
					// transition begin in the past and land instantly.
					requestIntent: (intent, clockSeconds) =>
						facade.requestViewingIntent(intent, camera.inspectionTicket(), clockSeconds)
		};
	}

	function select(selection: StageSelection | null): void {
		session.select(selection);
		for (const entry of adapters.values()) entry.adapter.selectionEcho?.(selection);
	}

	/** End every adapter registration: a domain adapter binds to the source it was built from. */
	function endAdapters(): readonly string[] {
		const ids = [...adapters.keys()];
		for (const entry of [...adapters.values()]) entry.dispose();
		adapters.clear();
		return ids;
	}

	const facade: StageFacade = {
		snapshot: () => currentSnapshot,
		session,
		camera,
		evaluation: () => camera.evaluation(),
		evaluationId: () => camera.evaluationId(),
		projectWorld(point, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return projectWorld(point, evaluation, tokenOf(evaluation));
		},
		pointerRay(cssPoint, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return pointerRay(cssPoint, evaluation, tokenOf(evaluation));
		},
		intersectWorkingPlane(ray, plane, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return intersectWorkingPlane(ray, plane, evaluation, tokenOf(evaluation));
		},
		requestViewingIntent(intent, ticket, clockSeconds) {
			// Ownership is the landed ticket protocol's answer, never a field
			// comparison: a ticket for another output, host session or source revision,
			// or one whose run epoch this output already spent, cannot drive it. A run
			// that no longer owns the output is told so (`superseded`) instead of being
			// left to write into an output it no longer holds — which is what makes a
			// prior-epoch completion unable to install its intent after a replacement or
			// a content change.
			const decision = requestCameraOutput(camera.output(), ticket);
			if (decision.kind !== 'accepted') {
				return {
					kind: 'superseded',
					state: camera.state(),
					message:
						decision.kind === 'refused'
							? `the stage inspection output refused this ticket: ${decision.reason}`
							: 'the inspection output is held by another run; acquire it before requesting a viewing intent',
					...(decision.kind === 'refused' ? { reason: decision.reason } : {})
				};
			}
			const result = camera.applyIntent(intent, clockSeconds);
			// A reading change is the one projection move a captured gesture must be told
			// about, and it happens at the *next* evaluation — `applyIntent` only moves
			// session state. Running the live lease's policy here is therefore strictly
			// before the projection changes, and it runs exactly once per accepted
			// request, whether the request came from the keyboard, the toolbar or an
			// adapter's `requestIntent`.
			if (result.kind === 'accepted' && intent.kind === 'set-reading') {
				session.applyReadingChange();
			}
			return result;
		},
		acquireInspection(policy = 'exclusive') {
			// The host owns one inspection output, so it mints its own run order: every
			// claim this facade acquires is strictly newer than any epoch the output has
			// already accepted, and the observation it presents is the live one.
			return camera.acquireInspection(policy, nextInspectionRun());
		},
		inspectionClaim: () => camera.output().claim,
		inspectionTicket: () => camera.inspectionTicket(),
		installAccepted(next) {
			if (disposed) {
				return { kind: 'refused', code: 'disposed', message: 'the stage is disposed and installs no source' };
			}
			const previous = currentSnapshot;
			if (next.acceptedRevision.projectId !== previous.acceptedRevision.projectId) {
				return {
					kind: 'refused',
					code: 'different-project',
					message: 'a different project identity is a replacement, not a content change'
				};
			}
			if (next.sourceContentId === previous.sourceContentId) {
				// Identical content: the claim, the selection and the task all still mean
				// what they meant, so nothing is rebased and nothing is re-acquired.
				return { kind: 'unchanged', sourceContentId: next.sourceContentId, claim: camera.output().claim };
			}
			const installed = session.installAccepted(next);
			if (installed.kind !== 'installed') {
				// The session holds one accepted-source slot, so this is the "nothing
				// mounted yet" case; a disposed or divergent session is named as such.
				return {
					kind: 'refused',
					code:
						installed.kind === 'refused' && installed.code === 'disposed'
							? 'disposed'
							: installed.kind === 'refused' && installed.code === 'stale-session'
								? 'stale-session'
								: 'no-current-source',
					message:
						installed.kind === 'refused'
							? installed.message
							: 'the session reports identical content for a changed source'
				};
			}
			const endedClaim = camera.output().claim;
			const pose = camera.state().pose;
			const endedAdapters = endAdapters();
			// The source rebase ends the live claim (its intent was evaluated against the
			// old content) without touching the pose, and the host re-acquires at once.
			camera.rebaseSource(next.sourceContentId);
			currentSnapshot = next;
			const acquired = camera.acquireInspection('exclusive', nextInspectionRun());
			return {
				kind: 'installed',
				previousSourceContentId: previous.sourceContentId,
				sourceContentId: next.sourceContentId,
				pose: camera.state().pose,
				endedClaim,
				claim: acquired.kind === 'acquired' ? acquired.claim : null,
				endedAdapters,
				clearedSelection: installed.clearedSelection,
				closedTask: installed.closedTask,
				releasedGestures: installed.releasedGestures
			};
		},
		plan: (overrides) => planFor(overrides),
		setPlanParameters(overrides) {
			planOverrides = { ...planOverrides, ...overrides };
		},
		eligibleFragments() {
			const result = planFor();
			return result.kind === 'evaluated' ? eligiblePlanFragments(result.plan) : [];
		},
		resolveSourceHit(candidate) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== candidate.evaluationId) {
				return { kind: 'failed', code: 'stale-evaluation' };
			}
			// Domain hit providers are asked first, in registration order, and the first
			// claim wins. The host does not arbitrate one global priority among Camera,
			// Scene and Layout species (interfaces §“Viewport projection v1”): an adapter
			// answers for its own domain and its own hit policy, so a Scene object mounted
			// on a Wall is reachable even though the Wall's Plan fragment is nearer the
			// datum-plane point. Layout's own Plan resolution is the built-in fallback
			// when no adapter claims, which keeps its priority deterministic within Layout.
			const context = adapterContext();
			if (context !== null) {
				for (const entry of adapters.values()) {
					const provider = entry.adapter.hitProvider;
					if (provider === undefined) continue;
					const claimed = provider(candidate, context);
					if (claimed !== null) return { kind: 'resolved', hit: claimed };
				}
			}
			if (
				!Number.isFinite(candidate.css[0]) ||
				!Number.isFinite(candidate.css[1])
			) {
				return { kind: 'failed', code: 'invalid-css-point' };
			}
			const token = tokenOf(evaluation);
			const planResult = planFor();
			if (planResult.kind !== 'evaluated') return { kind: 'none', reason: 'no-fragment' };
			const plan = planResult.plan;
			const project = (point: Vec3): readonly [number, number] | null => {
				const result = projectWorld(point, evaluation, token);
				// A point behind the camera projects to a mirrored CSS position; it is not
				// something the pointer can be over, so it must not become a candidate.
				return result.kind === 'projected' && result.visibility !== 'behind' ? result.css : null;
			};
			// Only eligible placements become fragments, so the first fragment within the
			// screen tolerance *is* the eligible hit; there is no second pass that could
			// surface an excluded target. The sort keeps the retained Layout priority
			// deterministic (Wall before Opening before object before floor, then source
			// identity), never Map iteration or a changing label.
			const eligible = [...eligiblePlanFragments(plan)].sort(compareFragments);
			for (const fragment of eligible) {
				const distanceCss = cssDistanceToFragment(
					candidate.css,
					fragment,
					currentSnapshot.domain.datumMeters,
					project
				);
				if (distanceCss === null || distanceCss > PLAN_HIT_TOLERANCE_CSS_PX) continue;
				return {
					kind: 'resolved',
					hit: {
						sourceId: fragment.ref.sourceId,
						sourceKind: fragment.ref.sourceKind,
						generationId: fragment.ref.generationId,
						stream: fragment.ref.stream,
						subRef: fragment.ref.subRef,
						worldPoint: worldPointOnFragment(candidate.css, fragment, evaluation, token)
					}
				};
			}
			return { kind: 'none', reason: 'no-fragment' };
		},
		selection: () => session.selection(),
		select,
		openTask: (task) => session.openTask(task),
		closeTask: () => session.closeTask(),
		registerStageAdapter(adapter) {
			if (disposed) {
				return {
					kind: 'refused',
					code: 'unknown-required-capability',
					missing: [],
					message: 'the stage is disposed and mounts no adapter'
				};
			}
			if (adapters.has(adapter.id)) {
				return {
					kind: 'refused',
					code: 'duplicate-adapter',
					missing: [],
					message: `an adapter "${adapter.id}" is already registered`
				};
			}
			const required = adapter.requiredCapabilities ?? [];
			const missing = required.filter((capability) => !HOST_STAGE_CAPABILITIES.includes(capability));
			if (missing.length > 0) {
				return {
					kind: 'refused',
					code: 'unknown-required-capability',
					missing,
					message: `this host does not provide ${missing.join(', ')}; refusing to mount "${adapter.id}"`
				};
			}
			const dispose = () => {
				adapters.delete(adapter.id);
			};
			adapters.set(adapter.id, { adapter, dispose });
			session.addDisposable(dispose);
			return { kind: 'registered', id: adapter.id, dispose };
		},
		adapters: () => [...adapters.values()].map((entry) => entry.adapter),
		overlays() {
			const context = adapterContext();
			if (context === null) return [];
			return [...adapters.values()].flatMap((entry) => entry.adapter.overlay?.(context) ?? []);
		},
		graphics() {
			const context = adapterContext();
			if (context === null) return [];
			return [...adapters.values()].flatMap((entry) => entry.adapter.graphics?.(context) ?? []);
		},
		acquireGesture(request) {
			return session.acquireGesture({
				owner: request.owner,
				evaluationId: request.evaluationId,
				acceptedRevision: currentSnapshot.acceptedRevision,
				policy: request.policy
			});
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			endAdapters();
		}
	};

	return facade;
}
