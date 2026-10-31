/**
 * T2.P01.S02 — snapshot-qualified floor support for Scene operations.
 *
 * Every Scene operation that needs support re-derives it from the **snapshot's**
 * canonical Layout compile through the landed `layout-core` floor-support query.
 * Two things follow from that, and both are structural here:
 *
 * - **No captured geometry, no mesh height.** A support query runs against
 *   compiled `room-floor` records, so a renderer hit's face Y cannot enter a
 *   committed pose (S01's planner has nowhere to put it).
 * - **The datum is the support of last resort (R217.S17A).** Where no Room floor
 *   covers a point, the Layout's explicit horizontal datum supports it, so object
 *   creation never needs an enclosure. A Room floor always wins where it exists,
 *   and the datum goes through the same selection: an operation that must keep
 *   another resting elevation refuses rather than dropping to the datum.
 * - **The snapshot is the qualification.** The compile is a pure function of the
 *   accepted Layout, so the support generation identity is derived from the
 *   snapshot's own content identity (`sceneSupportGenerationId`). There is no
 *   viewport generation to map here — `T2.P01.S03` owns that mapping when a real
 *   host exists. A captured choice from another generation refuses instead of
 *   being re-resolved against a source the creator never saw.
 *
 * Selection never picks an elevation: a required elevation must be yielded by
 * the snapshot, and more than one eligible floor context is `choice-required`.
 * Candidate order is not an input to the decision — `selectSceneSupport`
 * filters and resolves by identity/elevation, so reordering the query's polygon
 * records cannot change the answer.
 */
import {
	FLOOR_SUPPORT_TOLERANCES,
	chooseFloorSupport,
	compileWallFirstLayoutGeometry,
	datumSupportCandidate,
	floorSupportSnapshotOf,
	layoutDatumElevation,
	queryFloorSupports,
	type FloorSupportCandidate,
	type FloorSupportQueryResult,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
/** A live draw preview plans on every pointer move; one accepted Layout compiles once. */
const compiledBySource = new WeakMap<LayoutDocumentWallFirst, CompiledLayoutGeometry>();

/** The compile/support generation of one accepted snapshot. */
export function sceneSupportGenerationId(sourceContentId: string): string {
	return `scene-support@${sourceContentId}`;
}

/**
 * A creator's captured support choice, qualified by the generation it was made
 * against. The generation travels with the choice so a stale one is refused
 * rather than silently re-resolved.
 */
export type SceneSupportChoice =
	| { readonly kind: 'order-key'; readonly orderKey: string; readonly generationId: string }
	| { readonly kind: 'elevation'; readonly elevation: number; readonly generationId: string };

export type SceneSupportSelection =
	| { readonly kind: 'resolved'; readonly support: FloorSupportCandidate }
	| {
			readonly kind: 'choice-required';
			readonly candidates: readonly FloorSupportCandidate[];
			readonly message: string;
	  }
	| {
			readonly kind: 'no-support';
			readonly message: string;
			/** Every elevation the snapshot does yield here, for creator disclosure. */
			readonly availableElevations: readonly number[];
	  }
	| { readonly kind: 'stale-generation'; readonly message: string }
	| { readonly kind: 'unsupported'; readonly code: string; readonly message: string };

/**
 * Select one support from an already-queried candidate list.
 *
 * `requiredElevation` is the resting elevation the operation must preserve
 * (`null` for an explicit re-seat, which owns the resulting Y). A captured
 * choice is honoured only at the same generation; a choice the snapshot no
 * longer yields is `choice-required`, never a silent fallback to the first
 * candidate. When no choice was captured exactly one eligible candidate
 * resolves; zero is `no-support`; more than one asks the creator.
 */
export function selectSceneSupport(input: {
	readonly candidates: readonly FloorSupportCandidate[];
	readonly generationId: string;
	readonly requiredElevation: number | null;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneSupportSelection {
	const { candidates, generationId, requiredElevation, choice } = input;
	if (
		requiredElevation !== null &&
		(typeof requiredElevation !== 'number' || !Number.isFinite(requiredElevation))
	) {
		return {
			kind: 'unsupported',
			code: 'invalid-value',
			message: 'A required resting elevation must be a finite number.'
		};
	}
	if (choice !== undefined && choice.generationId !== generationId) {
		return {
			kind: 'stale-generation',
			message: `The captured support choice was made against generation "${choice.generationId}" and this snapshot is "${generationId}".`
		};
	}

	const eligible =
		requiredElevation === null
			? [...candidates]
			: candidates.filter(
					(candidate) =>
						Math.abs(candidate.elevation - requiredElevation) <=
						FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
				);

	if (choice !== undefined) {
		const chosen = chooseFloorSupport(candidates, choice);
		if (chosen.kind === 'choice-required' || chosen.kind === 'invalid-choice') {
			// Only the contexts this operation could actually use are disclosed: a
			// candidate at another elevation would refuse on selection.
			if (eligible.length === 0) {
				return {
					kind: 'no-support',
					message: `The captured support choice is no longer usable (${chosen.kind === 'choice-required' ? 'it is ambiguous' : chosen.message}) and no floor supports the required elevation ${requiredElevation} m.`,
					availableElevations: elevationsOf(candidates)
				};
			}
			return {
				kind: 'choice-required',
				candidates: eligible,
				message:
					chosen.kind === 'choice-required'
						? 'The captured support choice is ambiguous.'
						: `The captured support choice is no longer yielded by this snapshot (${chosen.message})`
			};
		}
		if (
			requiredElevation !== null &&
			Math.abs(chosen.support.elevation - requiredElevation) >
				FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters
		) {
			return {
				kind: 'no-support',
				message: `This operation must keep its contact at elevation ${requiredElevation} m, and the chosen support is at ${chosen.support.elevation} m. Reseating on another floor is an explicit Place on floor.`,
				availableElevations: elevationsOf(candidates)
			};
		}
		return { kind: 'resolved', support: chosen.support };
	}

	if (eligible.length === 0) {
		return {
			kind: 'no-support',
			message: `Nothing supports this point at ${requiredElevation === null ? 'any elevation' : `${requiredElevation} m`}; an object keeps its height when it moves.`,
			availableElevations: elevationsOf(candidates)
		};
	}
	if (eligible.length === 1) return { kind: 'resolved', support: eligible[0]! };
	return {
		kind: 'choice-required',
		candidates: eligible,
		message: `${eligible.length} floor contexts or elevations support this point; the creator must choose one.`
	};
}

export type SceneSupportResolution =
	| {
			readonly kind: 'resolved';
			readonly support: FloorSupportCandidate;
			readonly generationId: string;
	  }
	| {
			readonly kind: 'refused';
			readonly code: 'no-support' | 'support-choice-required' | 'stale-generation' | 'unsupported-surface';
			readonly message: string;
			readonly candidates: readonly FloorSupportCandidate[];
	  };

/**
 * Re-derive floor support for one world X/Z from the snapshot's canonical
 * compile.
 *
 * The compile is the same one the runtime uses, and the query is the landed
 * Layout-owned query; this function contributes only the generation
 * qualification and the selection rule.
 */
export function resolveSceneSupport(input: {
	readonly layout: LayoutDocumentWallFirst;
	readonly sourceContentId: string;
	readonly point: LayoutVec2;
	readonly requiredElevation: number | null;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneSupportResolution {
	const generationId = sceneSupportGenerationId(input.sourceContentId);
	let geometry = compiledBySource.get(input.layout);
	if (geometry === undefined) {
		geometry = compileWallFirstLayoutGeometry(input.layout).geometry;
		compiledBySource.set(input.layout, geometry);
	}
	return resolveSceneSupportOnGeometry({ ...input, geometry, generationId });
}

/**
 * The same resolution over an already compiled Layout. The Stage previews through
 * this, so a shown pose and the planner's commit cannot disagree about support.
 */
export function resolveSceneSupportOnGeometry(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly generationId: string;
	readonly point: LayoutVec2;
	readonly requiredElevation: number | null;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneSupportResolution {
	const { geometry, generationId, point } = input;
	const queried = queryFloorSupports(floorSupportSnapshotOf(geometry), {
		generationId,
		...(input.choice === undefined ? {} : { evidenceGenerationId: input.choice.generationId }),
		x: point[0],
		z: point[1]
	});
	const withDatum: FloorSupportQueryResult = queried.kind === 'none'
		? {
			kind: 'candidates',
			candidates: [datumSupportCandidate({
				elevation: layoutDatumElevation(geometry),
				generationId,
				x: point[0],
				z: point[1]
			})]
		}
		: queried;
	return fromQuery(withDatum, generationId, input.requiredElevation, input.choice);
}

function fromQuery(
	queried: FloorSupportQueryResult,
	generationId: string,
	requiredElevation: number | null,
	choice: SceneSupportChoice | undefined
): SceneSupportResolution {
	if (queried.kind === 'none') {
		return { kind: 'refused', code: 'no-support', message: 'Nothing supports this point.', candidates: [] };
	}
	if (queried.kind === 'invalid-input') {
		return {
			kind: 'refused',
			code: 'unsupported-surface',
			message: queried.message,
			candidates: []
		};
	}
	if (queried.kind === 'stale-generation') {
		return {
			kind: 'refused',
			code: 'stale-generation',
			message: queried.message,
			candidates: []
		};
	}
	if (queried.kind === 'unsupported') {
		return {
			kind: 'refused',
			code: 'unsupported-surface',
			message: queried.message,
			candidates: []
		};
	}

	const selection = selectSceneSupport({
		candidates: queried.candidates,
		generationId,
		requiredElevation,
		...(choice === undefined ? {} : { choice })
	});
	switch (selection.kind) {
		case 'resolved':
			return { kind: 'resolved', support: selection.support, generationId };
		case 'choice-required':
			return {
				kind: 'refused',
				code: 'support-choice-required',
				message: selection.message,
				candidates: selection.candidates
			};
		case 'no-support':
			return {
				kind: 'refused',
				code: 'no-support',
				message: selection.message,
				candidates: queried.candidates
			};
		case 'stale-generation':
			return {
				kind: 'refused',
				code: 'stale-generation',
				message: selection.message,
				candidates: queried.candidates
			};
		case 'unsupported':
			return {
				kind: 'refused',
				code: 'unsupported-surface',
				message: selection.message,
				candidates: queried.candidates
			};
	}
}

function elevationsOf(candidates: readonly FloorSupportCandidate[]): readonly number[] {
	return [...new Set(candidates.map((candidate) => candidate.elevation))].sort((left, right) => left - right);
}
