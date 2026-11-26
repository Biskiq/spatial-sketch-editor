import { Box3, Ray, Vector3 } from 'three';
import { compiledOpeningFaceLoops } from './opening-faces';
import {
	projectWorld,
	pointerRay,
	type ViewportEvaluation,
	type ViewportEvaluationToken,
} from '@portfolio/camera-core/viewport';
import type { Vec3 } from '@portfolio/camera-core/camera';
import {
	indexedCompiledWall,
	type CompiledLayoutGeometry,
	type OverheadSource,
} from '@portfolio/layout-core/geometry';
import {
	eligiblePlanFragments,
	type PlanEvaluation,
	type PlanFragment,
	type PlanFragmentGeometry,
	type PlanSubRef,
} from '@portfolio/layout-core/world';
import { createPlanPickIndex, type PlanPickBox, type PlanPickIndex } from './plan-pick-index';
import { LIFT_OUTLINE_DEPTH_BAND_METERS, LIFT_OUTLINE_DROP_METERS } from '../stage/lift-ink';
import type { StageDomainPick, StageHitSourceKind, StagePickQuery } from '../stage/stage-facade';
import { fragmentLayer, PAPER_LAYER } from '../stage/paper-plan';
import { sliceHides, type ResolvedSlice } from '../stage/slice/slice-cut';
import { resolvedSliceNow } from '../stage/slice/slice-resolved';
import { resolvedCutawayNow, type ResolvedCutaway } from '../stage/cutaway/cutaway-resolved';
import type { PlanEvaluationResult } from '@portfolio/layout-core/world';
import {
	PLAN_HIT_TOLERANCE_CSS_PX,
	closestOnCssSegment,
	clipSurfaceToCutaway,
	clipSurfaceToSlice,
	cssDistanceToSurfaces,
	openingRayHit,
	pickSurfacesOf,
	surfaceDepth,
	worldPointOnSurface,
	type LayoutPickContext,
} from './plan-pick-geometry';

export function createPlanPickProvider(
	planFor: () => PlanEvaluationResult,
	/**
	 * The overheads the live Lift reading lifts, named by Layout for the geometry in
	 * the pick context. No accessor means Lift is off: this test adds no hit.
	 */
	liftedOutlines: (geometry: CompiledLayoutGeometry) => readonly OverheadSource[] = () => [],
	/**
	 * The live Slice, read on the pointer. The default reads the route's own
	 * mirror — the same value the Canvas draws with — so the adapter needs no new
	 * wiring and the provider cannot hold a cut the Stage is not showing. With no
	 * reading every surface, cap and hidden-point test below is exactly today's
	 * behaviour, which is what keeps ordinary picking unchanged when Slice is off.
	 */
	sliceOf: () => ResolvedSlice | null = resolvedSliceNow,
	/**
	 * The live effective cutaway, read on the pointer. Its default is the
	 * route's mirror — the same set the Canvas cuts — so the adapter needs no new
	 * wiring and the provider can never hold a cut the Stage is not showing.
	 */
	cutawayOf: () => ResolvedCutaway | null = resolvedCutawayNow,
) {
	/**
	 * The retained pick index for one Plan evaluation.
	 *
	 * Built lazily on the first hit that needs it and kept with the evaluation, so a
	 * second click in the same view — or the same evaluation after a pan, which no
	 * longer produces a new one — costs no build. The Plan is the only key: its
	 * `fragments` array identity already names the compiled geometry and datum it
	 * was evaluated from, so a recompile or a parameter change retires the index
	 * with the evaluation.
	 */
	type RetainedPickIndex = {
		readonly index: PlanPickIndex;
		/** The fragments the index's entries address, in the hit path's priority order. */
		readonly fragments: readonly PlanFragment[];
	};
	const pickIndexes = new WeakMap<PlanEvaluation, RetainedPickIndex>();

	function pickIndexFor(plan: PlanEvaluation, context: LayoutPickContext): RetainedPickIndex {
		const existing = pickIndexes.get(plan);
		if (existing !== undefined) return existing;
		const geometry = context.snapshot.domain.geometry;
		// The fragments are indexed in the **hit path's own priority order**, so a
		// candidate index is also its rank: the caller never re-sorts to decide.
		//
		// That order is already `plan.fragments`': the evaluator emits Wall before
		// Opening before object before floor, then source identity, then interval, and
		// eligibility is a **per-source** fact, so a source's fragments are contiguous
		// and filtering out ineligible sources is order-preserving. Sorting here again
		// was an `O(F log F)` pass that could not change the array it sorted.
		const fragments = eligiblePlanFragments(plan);
		const boxes = fragments.map((fragment) => pickBoxOf(fragment, geometry, plan.datumMeters));
		const retained: RetainedPickIndex = { index: createPlanPickIndex(boxes), fragments };
		pickIndexes.set(plan, retained);
		return retained;
	}

	const openingTargets = new WeakMap<
		RetainedPickIndex,
		readonly {
			fragment: PlanFragment;
			/** The host Wall, so the cutaway's stub filter can answer per Opening. */
			wallId: string;
			faces: Vector3[][];
			bounds: Box3;
		}[]
	>();

	function openingTargetsFor(retained: RetainedPickIndex, geometry: CompiledLayoutGeometry) {
		const cached = openingTargets.get(retained);
		if (cached !== undefined) return cached;
		const fragments = new Map(
			retained.fragments
				.filter((fragment) => fragment.ref.sourceKind === 'opening')
				.map((fragment) => [fragment.ref.sourceId, fragment]),
		);
		const elevations = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation]));
		const targets = geometry.walls.flatMap((wall) =>
			wall.openings.flatMap((opening) => {
				const fragment = fragments.get(opening.openingId);
				if (fragment === undefined) return [];
				const faces = compiledOpeningFaceLoops(
					wall,
					opening,
					elevations.get(wall.floorId) ?? 0,
				).map((face) => face.map((point) => new Vector3(...point)));
				return [
					{ fragment, wallId: wall.wallId, faces, bounds: new Box3().setFromPoints(faces.flat()) },
				];
			}),
		);
		openingTargets.set(retained, targets);
		return targets;
	}

	/**
	 * The world box that contains everything one fragment's exact test projects.
	 *
	 * **Conservative on purpose, and never the Plan cut.** A Wall fragment is drawn
	 * as faces at the compiled Wall's own extent (a lintel starts where the Opening
	 * ends), so the compiled Wall's bounds are the box. A flat fragment is tested at
	 * its own elevation only, so its plan extent at that elevation is exact. Deriving
	 * the box from the cut elevation would prune precisely the Walls above it — the
	 * defect the face surfaces were introduced to fix, moved into a broad phase.
	 */
	function pickBoxOf(
		fragment: PlanFragment,
		geometry: CompiledLayoutGeometry,
		datumMeters: number,
	): PlanPickBox {
		const planBounds = planExtentOf(fragment.geometry);
		const elevation = Number.isFinite(fragment.elevationMeters)
			? fragment.elevationMeters
			: datumMeters;
		if (fragment.ref.sourceKind === 'wall') {
			const wall = indexedCompiledWall(geometry, fragment.ref.sourceId);
			if (wall !== undefined) {
				// The compiled Wall's own bounds plus its declared vertical extent. The
				// union is deliberate: `pickSurfacesOf` may fall back to the fragment's
				// whole line at full Wall height, and a box narrowed to the solid spans
				// would prune a hit the exact test would have made.
				return {
					minX: Math.min(wall.bounds3.min[0], planBounds.minX),
					minY: Math.min(wall.bounds3.min[1], datumMeters),
					minZ: Math.min(wall.bounds3.min[2], planBounds.minZ),
					maxX: Math.max(wall.bounds3.max[0], planBounds.maxX),
					maxY: Math.max(wall.bounds3.max[1], datumMeters + wall.height, elevation),
					maxZ: Math.max(wall.bounds3.max[2], planBounds.maxZ),
				};
			}
		}
		// A flat fragment is tested at its own elevation, and only there.
		return {
			minX: planBounds.minX,
			minY: elevation,
			minZ: planBounds.minZ,
			maxX: planBounds.maxX,
			maxY: elevation,
			maxZ: planBounds.maxZ,
		};
	}

	function planExtentOf(geometry: PlanFragmentGeometry): {
		readonly minX: number;
		readonly minZ: number;
		readonly maxX: number;
		readonly maxZ: number;
	} {
		const points =
			geometry.kind === 'span'
				? [geometry.start, geometry.end]
				: geometry.kind === 'polyline'
					? geometry.polyline
					: geometry.polygon;
		let minX = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxZ = -Infinity;
		for (const point of points) {
			if (point[0] < minX) minX = point[0];
			if (point[1] < minZ) minZ = point[1];
			if (point[0] > maxX) maxX = point[0];
			if (point[1] > maxZ) maxZ = point[1];
		}
		// An empty or non-finite plan gives a box the box test cannot prune, rather
		// than an empty one it would prune every time.
		if (!(minX <= maxX && minZ <= maxZ)) {
			return { minX: -Infinity, minZ: -Infinity, maxX: Infinity, maxZ: Infinity };
		}
		return { minX, minZ, maxX, maxZ };
	}

	/**
	 * Layout's Eraser eligibility, in its own words. A Room floor derives
	 * from its Walls and a Layout object (the plinth) has no Layout delete, so the
	 * Eraser refuses them here rather than skipping to a subject behind them.
	 */
	const eraseRefusal = (sourceKind: string): string | null =>
		sourceKind === 'region'
			? null
			: sourceKind === 'room-floor'
				? 'A Room floor cannot be erased.'
				: sourceKind === 'object'
					? 'A plinth cannot be erased; Layout has no delete for its objects.'
					: null;

	/**
	 * A lifted overhead answers the pointer through the **outline it is drawn as**.
	 *
	 * A lift removes the lid from the view and from rays, so the dashed line is the
	 * only thing that stands for it. The test is in CSS pixels, where the creator
	 * aims, at the same tolerance as every other Layout hit — and at the plane the
	 * outline is drawn on, not the lid's own elevation, so the line under the
	 * pointer is the line that answers.
	 *
	 * The surface under the pointer keeps the final say: an outline behind a nearer
	 * Wall is not editable through that Wall. The hit names the subject the
	 * overhead belongs to: a Room's floor fragment for a generated lid, or the
	 * region fragment for an authored slab.
	 */
	function liftOutlinePick(
		css: readonly [number, number],
		evaluation: ViewportEvaluation,
		token: ViewportEvaluationToken,
		context: LayoutPickContext,
		retained: RetainedPickIndex,
		slice: ResolvedSlice | null,
	): StageDomainPick | null {
		const sources = liftedOutlines(context.snapshot.domain.geometry);
		if (sources.length === 0) return null;
		const rayResult = pointerRay(css, evaluation, token);
		if (rayResult.kind !== 'ray') return null;
		const { origin, direction } = rayResult.ray;
		const projectPoint = (point: readonly [number, number, number]) => {
			const projected = projectWorld(point as Vec3, evaluation, token);
			return projected.kind === 'projected' && projected.visibility !== 'behind'
				? projected.css
				: null;
		};
		let best: {
			readonly fragment: PlanFragment;
			readonly worldPoint: Vec3;
			readonly depthMeters: number;
			readonly cssDistance: number;
		} | null = null;
		for (const source of sources) {
			const outline = source.outline;
			if (outline.length < 3) continue;
			const elevation = source.elevation - LIFT_OUTLINE_DROP_METERS;
			for (let index = 0; index < outline.length; index += 1) {
				const start = outline[index]!;
				const end = outline[(index + 1) % outline.length]!;
				const startCss = projectPoint([start[0], elevation, start[1]]);
				const endCss = projectPoint([end[0], elevation, end[1]]);
				// An endpoint behind the camera is not something the pointer is over.
				if (startCss === null || endCss === null) continue;
				const closest = closestOnCssSegment(css, startCss, endCss);
				if (closest.distance > PLAN_HIT_TOLERANCE_CSS_PX) continue;
				if (best !== null && closest.distance >= best.cssDistance) continue;
				const worldPoint: Vec3 = [
					start[0] + (end[0] - start[0]) * closest.amount,
					elevation,
					start[1] + (end[1] - start[1]) * closest.amount,
				];
				// A lid the cut has removed is not an outline the creator can aim at.
				if (slice !== null && sliceHides(slice, worldPoint[0], worldPoint[1], worldPoint[2]))
					continue;
				// Depth along the pointer's own ray, so an outline and a surface are
				// compared on one axis.
				const depthMeters =
					(worldPoint[0] - origin[0]) * direction[0] +
					(worldPoint[1] - origin[1]) * direction[1] +
					(worldPoint[2] - origin[2]) * direction[2];
				if (!(depthMeters > 0)) continue;
				const fragment = retained.fragments.find((candidate) =>
					source.key.kind === 'region'
						? candidate.ref.sourceKind === 'region' && candidate.ref.sourceId === source.subject.id
						: candidate.ref.sourceKind === 'room-floor' &&
							candidate.ref.sourceId === source.subject.id,
				);
				if (fragment === undefined) continue;
				best = { fragment, worldPoint, depthMeters, cssDistance: closest.distance };
				break;
			}
		}
		if (best === null) return null;
		const drawn = context.pickScene(rayResult.ray);
		if (
			drawn !== null &&
			drawn.distanceMeters < best.depthMeters - LIFT_OUTLINE_DEPTH_BAND_METERS
		) {
			return null;
		}
		return {
			hit: {
				sourceId: best.fragment.ref.sourceId,
				sourceKind: best.fragment.ref.sourceKind,
				generationId: best.fragment.ref.generationId,
				stream: best.fragment.ref.stream,
				subRef: best.fragment.ref.subRef,
				worldPoint: best.worldPoint,
			},
			refusal: null,
			depthMeters: best.depthMeters,
			planLayer: fragmentLayer(best.fragment),
			cssDistance: best.cssDistance,
		};
	}

	return (query: StagePickQuery, context: LayoutPickContext): StageDomainPick | null => {
		const evaluation = context.evaluation;
		const css: [number, number] = [
			query.css[0] + evaluation.rect.left,
			query.css[1] + evaluation.rect.top,
		];
		if (!css.every(Number.isFinite)) return null;
		const token = evaluation.token;
		const result = planFor();
		if (result.kind !== 'evaluated') return null;
		const project = (
			point: readonly [number, number, number],
		): readonly [number, number] | null => {
			const projected = projectWorld(point as Vec3, evaluation, token);
			return projected.kind === 'projected' && projected.visibility !== 'behind'
				? projected.css
				: null;
		};
		const retained = pickIndexFor(result.plan, context);
		const slice = sliceOf();
		const cutaway = cutawayOf();
		const erasing = query.purpose === 'tool' && query.tool?.kind === 'erase';
		// In the 3D reading Paint needs the exact rendered triangle: the side tag
		// distinguishes the two outward Wall faces and excludes tops, caps and
		// Opening reveals. The ordinary Plan hit remains Layout's projected pick.
		if (
			evaluation.renderedReading !== 'plan' &&
			query.purpose === 'tool' &&
			query.tool?.kind === 'paint'
		) {
			const ray = pointerRay(css, evaluation, token);
			const drawn = ray.kind === 'ray' ? context.pickScene(ray.ray) : null;
			if (
				drawn === null ||
				drawn.entityId !== null ||
				drawn.layoutId === undefined ||
				drawn.layoutKind === undefined
			)
				return null;
			let sourceKind: StageHitSourceKind;
			let sourceId = drawn.layoutId;
			let subRef: PlanSubRef | null = null;
			if (drawn.layoutKind === 'wall' || drawn.layoutKind === 'wall-failure') {
				sourceKind = 'wall';
				sourceId = drawn.wallId ?? drawn.layoutId;
				if (drawn.wallSide !== undefined)
					subRef = { kind: 'component', componentId: `side:${drawn.wallSide}` };
			} else if (drawn.layoutKind === 'floor') {
				sourceKind = 'room-floor';
			} else if (drawn.layoutKind === 'lid') {
				sourceKind = 'room-lid';
			} else if (drawn.layoutKind === 'region') {
				sourceKind = 'region';
				if (drawn.region !== undefined)
					subRef = { kind: 'component', componentId: drawn.region.face };
			} else {
				sourceKind = 'object';
			}
			return {
				hit: {
					sourceId,
					sourceKind,
					generationId: context.snapshot.compileGeneration,
					stream: 'projected',
					subRef,
					worldPoint: drawn.worldPoint,
				},
				refusal: null,
				depthMeters: drawn.distanceMeters,
				planLayer: PAPER_LAYER.projected,
				cssDistance: 0,
			};
		}
		const pickOpeningIn3D =
			evaluation.renderedReading !== 'plan' &&
			(query.purpose !== 'tool' || erasing) &&
			(query.tool === null || erasing);
		if (pickOpeningIn3D) {
			const rayResult = pointerRay(css, evaluation, token);
			if (rayResult.kind === 'ray') {
				const { origin, direction } = rayResult.ray;
				const ray = new Ray(new Vector3(...origin), new Vector3(...direction));
				let nearest: StageDomainPick | null = null;
				for (const { fragment, wallId, faces, bounds } of openingTargetsFor(
					retained,
					context.snapshot.domain.geometry,
				)) {
					if (!ray.intersectsBox(bounds)) continue;
					const point = openingRayHit(ray, faces);
					if (point === null) continue;
					// A reveal the cut removes is not a place to aim at, and it must not
					// answer for the opening's visible part either.
					if (slice !== null && sliceHides(slice, point.x, point.y, point.z)) continue;
					// An Opening above a cut Wall's stub is not selectable: its host is
					// not drawn there, and the ray must reach the interior behind it.
					if (cutaway !== null && cutaway.wallIds.has(wallId) && point.y > cutaway.stubTopY + 1e-4)
						continue;
					const depthMeters = ray.origin.distanceTo(point);
					if (depthMeters >= (nearest?.depthMeters ?? Infinity)) continue;
					nearest = {
						hit: {
							sourceId: fragment.ref.sourceId,
							sourceKind: 'opening',
							generationId: fragment.ref.generationId,
							stream: fragment.ref.stream,
							subRef: fragment.ref.subRef,
							worldPoint: point.toArray(),
						},
						depthMeters,
						cssDistance: 0,
						planLayer: fragmentLayer(fragment),
						refusal: null,
					};
				}
				if (nearest !== null) {
					const drawn = context.pickScene(rayResult.ray);
					if (drawn === null || nearest.depthMeters! <= drawn.distanceMeters + 1e-5) return nearest;
				}
			}
		}
		if (
			evaluation.renderedReading !== 'plan' &&
			context.snapshot.domain.geometry.regions.length > 0
		) {
			const ray = pointerRay(css, evaluation, token);
			const drawn = ray.kind === 'ray' ? context.pickScene(ray.ray) : null;
			if (drawn?.region) {
				return {
					hit: {
						sourceId: drawn.region.regionId,
						sourceKind: 'region',
						generationId: context.snapshot.compileGeneration,
						stream: 'projected',
						subRef: { kind: 'component', componentId: drawn.region.face },
						worldPoint: drawn.worldPoint,
					},
					refusal:
						query.purpose === 'tool' && query.tool?.kind === 'erase'
							? eraseRefusal('region')
							: null,
					depthMeters: drawn.distanceMeters,
					planLayer: PAPER_LAYER.projected,
					cssDistance: 0,
				};
			}
		}
		const openingOverHost =
			erasing ||
			(evaluation.renderedReading === 'plan' && query.purpose === 'select' && query.tool === null);
		const roomAreaOf = (roomId: string): number | null => {
			const room = context.snapshot.domain.geometry.rooms.find(
				(candidate) => candidate.roomId === roomId,
			);
			if (room === undefined) return null;
			let twice = 0;
			for (let index = 0; index < room.floorPolygon.length; index += 1) {
				const current = room.floorPolygon[index]!;
				const next = room.floorPolygon[(index + 1) % room.floorPolygon.length]!;
				twice += current[0] * next[1] - next[0] * current[1];
			}
			return Math.abs(twice) / 2;
		};
		type Ranked = {
			readonly fragment: PlanFragment;
			readonly pick: NonNullable<ReturnType<typeof cssDistanceToSurfaces>>;
			/** A Room floor's compiled area, for innermost containment. */
			readonly roomArea: number | null;
		};
		let winner: Ranked | null = null;
		// A Room floor is the last source rank, so it can never outrank a Wall,
		// Opening or object. It is tracked separately: two floors that both contain
		// the pointer must be compared (innermost wins), and the first floor must
		// not end the scan before that comparison can run.
		let floorWinner: Ranked | null = null;
		const innermost = (candidate: Ranked, incumbent: Ranked): boolean => {
			if (candidate.roomArea === null || incumbent.roomArea === null) return false;
			if (candidate.pick.distanceCss > incumbent.pick.distanceCss + 1e-9) return false;
			return (
				candidate.roomArea < incumbent.roomArea - 1e-9 ||
				(Math.abs(candidate.roomArea - incumbent.roomArea) <= 1e-9 &&
					candidate.fragment.ref.sourceId < incumbent.fragment.ref.sourceId)
			);
		};
		for (const index of retained.index.candidates(css, PLAN_HIT_TOLERANCE_CSS_PX, project)) {
			const fragment = retained.fragments[index];
			if (
				fragment === undefined ||
				(fragment.ref.sourceKind === 'region' && evaluation.renderedReading !== 'plan') ||
				(pickOpeningIn3D && fragment.ref.sourceKind === 'opening')
			)
				continue;
			const surfaces = pickSurfacesOf(
				fragment,
				context.snapshot.domain.geometry,
				context.snapshot.domain.datumMeters,
				slice,
				cutaway,
			)
				.flatMap((surface) =>
					clipSurfaceToCutaway(
						surface,
						cutaway,
						fragment.ref.sourceKind === 'wall' ? fragment.ref.sourceId : null,
					),
				)
				.flatMap((surface) => clipSurfaceToSlice(surface, slice));
			const pick = cssDistanceToSurfaces(css, surfaces, project);
			if (pick === null || pick.distanceCss > PLAN_HIT_TOLERANCE_CSS_PX) continue;
			const roomArea =
				fragment.ref.sourceKind === 'room-floor' ? roomAreaOf(fragment.ref.sourceId) : null;
			if (roomArea !== null) {
				// Two Room floors can both contain the pointer at the same depth. The
				// innermost Space wins: a booth inside a hall selects the booth.
				const ranked = { fragment, pick, roomArea };
				if (floorWinner === null || innermost(ranked, floorWinner)) floorWinner = ranked;
				continue;
			}
			if (winner === null) {
				winner = { fragment, pick, roomArea };
				// Plan Select and Eraser name an Opening over its own host Wall.
				if (!openingOverHost || fragment.ref.sourceKind !== 'wall') break;
				continue;
			}
			if (
				fragment.ref.sourceKind === 'opening' &&
				winner.fragment.ref.sourceKind === 'wall' &&
				context.snapshot.domain.geometry.walls?.some(
					(wall) =>
						wall.wallId === winner!.fragment.ref.sourceId &&
						wall.openings.some((opening) => opening.openingId === fragment.ref.sourceId),
				)
			) {
				winner = { fragment, pick, roomArea };
				break;
			}
		}
		if (winner === null) winner = floorWinner;
		// A lifted overhead is only reachable in the 3D reading and only by the pointer's
		// own verbs: a tool (Eraser, Measure) still works on what it can see.
		if (evaluation.renderedReading !== 'plan' && query.purpose !== 'tool') {
			const outlineRay = pointerRay(css, evaluation, token);
			const winnerDepth =
				winner === null
					? null
					: surfaceDepth(outlineRay.kind === 'ray' ? outlineRay.ray : null, winner.pick.surface);
			const outline = liftOutlinePick(css, evaluation, token, context, retained, slice);
			if (
				outline !== null &&
				(winnerDepth === null ||
					(outline.depthMeters ?? Infinity) <= winnerDepth + LIFT_OUTLINE_DEPTH_BAND_METERS)
			) {
				return outline;
			}
		}
		if (winner !== null) {
			const { fragment, pick } = winner;
			const rayResult = pointerRay(css, evaluation, token);
			let worldPoint = worldPointOnSurface(css, pick.surface, fragment, evaluation, token);
			if (query.purpose === 'tool' && query.tool?.kind === 'measure') {
				const candidates: Vec3[] = [];
				const wall =
					fragment.ref.sourceKind === 'wall'
						? indexedCompiledWall(context.snapshot.domain.geometry, fragment.ref.sourceId)
						: undefined;
				if (wall !== undefined && wall.samples.length) {
					for (const sample of [wall.samples[0]!, wall.samples[wall.samples.length - 1]!])
						candidates.push([
							sample.point[0],
							context.snapshot.domain.datumMeters,
							sample.point[1],
						]);
				}
				for (const junction of context.snapshot.domain.geometry.junctions ?? [])
					candidates.push([
						junction.point[0],
						context.snapshot.domain.datumMeters,
						junction.point[1],
					]);
				let nearest = PLAN_HIT_TOLERANCE_CSS_PX;
				for (const point of candidates) {
					const projected = project(point);
					if (projected === null) continue;
					const d = Math.hypot(projected[0] - css[0], projected[1] - css[1]);
					if (d <= nearest) {
						nearest = d;
						worldPoint = point;
					}
				}
			}
			return {
				hit: {
					sourceId: fragment.ref.sourceId,
					sourceKind: fragment.ref.sourceKind,
					generationId: fragment.ref.generationId,
					stream: fragment.ref.stream,
					subRef: fragment.ref.subRef,
					worldPoint,
				},
				refusal:
					query.purpose === 'tool' && query.tool?.kind === 'erase'
						? eraseRefusal(fragment.ref.sourceKind)
						: null,
				depthMeters: surfaceDepth(rayResult.kind === 'ray' ? rayResult.ray : null, pick.surface),
				planLayer: fragmentLayer(fragment),
				cssDistance: pick.distanceCss,
			};
		}
		return null;
	};
}
