/**
 * X7 — the Scene adapter's candidate presentation.
 *
 * Pure projection from one Stage adapter context plus the candidate facts the
 * placement binding and the object-mark session expose, to the three Stage
 * outputs a proposal paints: Paper candidate previews, overlay labels and ghost
 * meshes. It decides nothing, holds nothing and writes nothing: every state read
 * goes through the view it is handed (`PlacementPresentationView`), so there is
 * exactly one place a candidate becomes a drawing and no second copy of the
 * footprint/ghost rules.
 *
 * Footprints are built by the same Scene footprint authority that picks
 * (`buildPlanSceneFootprintProjection`); ghost bodies by `candidateGhost`.
 */

import type {
	StageAdapterContext,
	StageCandidatePreview,
	StageGhostMesh,
	StageOverlayContribution
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import { NATIVE_PLACEMENT_DIMENSIONS } from '$lib/authoring/scene/object-definition-policy';
import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { candidateGhost } from './candidate-ghost';
import { admittedModelFootprint } from './object-readings';
import type { SceneCandidate } from './placement';
import type { DrawPreview } from './shape/draw-session';

/** A refused release holds the last drawn candidate in refusal ink. */
export type PlacementReleaseRefusal = {
	readonly candidate: SceneCandidate;
	readonly message: string;
	readonly until: number;
};

/** The pointer-time refusal: where it was named, and the pose it would have shown. */
export type PlacementPointerRefusal = {
	readonly css: readonly [number, number];
	readonly world: Vec3 | null;
	readonly message: string;
	readonly candidate: SceneCandidate | null;
};

/**
 * What the placement binding lets the presenter read. The two lazy readers keep
 * their original timing: the release refusal clears itself when it expires, and
 * the session candidate is the live surface's, read only when nothing held,
 * refused or previewed outranks it.
 */
export type PlacementPresentationView = {
	/** The open task is Place (the "Click to place" label and "need" chip). */
	readonly placing: boolean;
	readonly pointerCss: readonly [number, number] | null;
	/** The candidate whose one acceptance is in flight. */
	readonly held: SceneCandidate | null;
	readonly releaseRefusal: () => PlacementReleaseRefusal | null;
	readonly pointerRefusal: PlacementPointerRefusal | null;
	readonly sessionCandidate: () => SceneCandidate | null;
	/** The live contact reader for a ghosted accepted model. */
	readonly contact: (entity: SceneEntity) => number | null;
};

/** A Scene entity at the exact pose a candidate would install. */
export function sceneEntityAtCandidate(
	candidate: SceneCandidate,
	acceptedEntities: readonly SceneEntity[]
): SceneEntity | null {
	if (candidate.entityId !== null) {
		const accepted = acceptedEntities.find((entity) => entity.id === candidate.entityId);
		if (accepted === undefined || accepted.kind === 'artwork') return null;
		if (accepted.kind === 'form') {
			return {
				...accepted,
				position: [...candidate.position] as Vec3,
				rotation: [...candidate.rotation] as Vec3,
				...(candidate.form === undefined ? {} : { form: candidate.form })
			};
		}
		return {
			...accepted,
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3,
			scale: candidate.scale
		};
	}
	if (candidate.form !== undefined) {
		return {
			kind: 'form',
			id: 'scene-candidate-form',
			name: 'Candidate form',
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3,
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			form: candidate.form
		};
	}
	if (candidate.primitive !== null) {
		const base = {
			kind: 'primitive' as const,
			id: 'scene-candidate-primitive',
			name: 'Candidate object',
			materialId: 'plaster-warm' as const,
			castShadow: true,
			receiveShadow: true,
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3
		};
		switch (candidate.primitive) {
			case 'box':
				return { ...base, primitive: 'box', dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.box } };
			case 'cylinder':
				return { ...base, primitive: 'cylinder', dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.cylinder } };
			case 'sphere':
				return { ...base, primitive: 'sphere', dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.sphere } };
		}
	}
	if (candidate.modelAssetId !== undefined && candidate.footprint !== undefined) {
		return {
			kind: 'model',
			id: 'scene-candidate-model',
			name: 'Candidate model',
			assetId: candidate.modelAssetId,
			fallback: 'generic',
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3
		};
	}
	return null;
}

/** Build the Paper silhouette through the same Scene footprint authority as picking. */
export function sceneCandidatePaperPreview(
	entity: SceneEntity,
	datumMeters: number,
	modelFootprints: ReadonlyMap<string, { readonly width: number; readonly depth: number }> | undefined,
	role: StageCandidatePreview['role'] = 'subject',
	label?: { readonly world: Vec3; readonly text: string }
): StageCandidatePreview | null {
	const projection = buildPlanSceneFootprintProjection(
		{ entities: [entity] },
		{ modelFootprintById: (assetId) => modelFootprints?.get(assetId) }
	);
	const footprint = projection.footprints[0];
	if (footprint === undefined) return null;
	const rings = footprint.polygons ?? [footprint.points];
	return {
		id: 'scene-candidate-footprint',
		role,
		polygons: rings.map((ring) => ring.map(([x, z]) => [x, datumMeters, z] as Vec3)),
		segments: [],
		labels: label === undefined ? [] : [label]
	};
}

/**
 * The live mark gesture's proposal in Plan, where the Canvas draws no ghost
 * body: the candidate's footprint as dashed segments at the datum, the same
 * full-size outline 3D draws as the body's dashed edges.
 */
export function presentMarkOutline(
	adapterContext: StageAdapterContext,
	candidate: SceneCandidate | null
): StageCandidatePreview | null {
	if (candidate === null) return null;
	const entity = sceneEntityAtCandidate(candidate, stageScene(adapterContext.snapshot).entities);
	if (entity === null) return null;
	const runtimeScene = adapterContext.snapshot.domain.scene;
	const projection = buildPlanSceneFootprintProjection(
		{ entities: [entity] },
		{
			modelFootprintById: (assetId) =>
				runtimeScene.modelFootprints?.get(assetId) ??
				admittedModelFootprint(adapterContext.snapshot, assetId) ??
				undefined
		}
	);
	const footprint = projection.footprints[0];
	if (footprint === undefined) return null;
	const y = adapterContext.snapshot.domain.datumMeters;
	const segments: [Vec3, Vec3][] = [];
	for (const ring of footprint.polygons ?? [footprint.points]) {
		for (let index = 0; index < ring.length; index += 1) {
			const a = ring[index]!;
			const b = ring[(index + 1) % ring.length]!;
			segments.push([[a[0], y, a[1]], [b[0], y, b[1]]]);
		}
	}
	return { id: 'scene-mark-outline', role: 'subject', polygons: [], segments, labels: [] };
}

/** The drawn Shape tile's Paper preview: its footprint plus the draft segments. */
export function presentDrawnCandidate(
	drawn: DrawPreview | null,
	datumMeters: number
): readonly StageCandidatePreview[] {
	if (drawn === null) return [];
	const footprint = drawn.entity === null
		? null
		: sceneCandidatePaperPreview(drawn.entity, datumMeters, undefined, 'subject');
	return [{
		id: 'scene-draw-footprint',
		role: drawn.refused ? 'refused' : 'subject',
		polygons: footprint?.polygons ?? [],
		segments: drawn.segments,
		labels: drawn.label === null ? [] : [drawn.label],
		...(drawn.snap === null ? {} : { snap: { world: drawn.snap, name: 'Grid' } })
	}];
}

/**
 * The Plan Paper preview of the candidate the placement shows, in the order the
 * Stage has always ranked them: the held commit, a live release refusal, the
 * mark gesture's pose, the pointer refusal, then the session's own candidate.
 * Only called once the reading is Plan.
 */
export function presentPlacementPreview(
	adapterContext: StageAdapterContext,
	view: PlacementPresentationView,
	markCandidate: SceneCandidate | null
): readonly StageCandidatePreview[] {
	const runtimeScene = adapterContext.snapshot.domain.scene;
	let entity: SceneEntity | null = null;
	let candidate: SceneCandidate | null = view.held;
	let role: StageCandidatePreview['role'] = 'subject';
	let label: { readonly world: Vec3; readonly text: string } | undefined;
	if (candidate !== null) {
		label = { world: candidate.position, text: 'Placing…' };
	} else {
		const releaseRefusal = view.releaseRefusal();
		if (releaseRefusal !== null) {
			candidate = releaseRefusal.candidate;
			role = 'refused';
			label = { world: candidate.position, text: releaseRefusal.message };
		}
	}
	if (entity === null && candidate === null && markCandidate !== null) {
		candidate = markCandidate;
	}
	if (entity === null && candidate === null && view.pointerRefusal !== null) {
		candidate = view.pointerRefusal.candidate;
		role = 'refused';
		if (view.pointerRefusal.world !== null) {
			label = { world: view.pointerRefusal.world, text: view.pointerRefusal.message };
		}
	}
	if (entity === null && candidate === null) {
		candidate = view.sessionCandidate();
	}
	if (entity === null && candidate !== null) {
		entity = sceneEntityAtCandidate(candidate, runtimeScene.entities);
	}
	if (entity === null) return [];
	let modelFootprints = runtimeScene.modelFootprints;
	if (candidate?.modelAssetId !== undefined && candidate.footprint !== undefined) {
		const expanded = new Map(modelFootprints ?? []);
		expanded.set(candidate.modelAssetId, candidate.footprint);
		modelFootprints = expanded;
	}
	const preview = sceneCandidatePaperPreview(
		entity,
		adapterContext.snapshot.domain.datumMeters,
		modelFootprints,
		role,
		label
	);
	return preview === null ? [] : [preview];
}

/** The captured candidate as the one overlay label Plan and 3D share. */
export function presentOverlay(
	adapterContext: StageAdapterContext,
	view: PlacementPresentationView
): readonly StageOverlayContribution[] {
	const held = view.held;
	if (held !== null) {
		const css = adapterContext.project(held.position);
		return css === null ? [] : [{ id: 'scene-candidate-hold', css, label: 'Placing…' }];
	}
	const releaseRefusal = view.releaseRefusal();
	if (releaseRefusal !== null) {
		const css = adapterContext.project(releaseRefusal.candidate.position);
		return css === null
			? []
			: [{ id: 'scene-candidate-refusal', css, label: releaseRefusal.message }];
	}
	const candidate = view.sessionCandidate();
	if (candidate === null) {
		if (view.pointerRefusal !== null) {
			return [{
				id: 'scene-candidate-refusal',
				// StageFacade applies the viewport-to-surface translation to all
				// adapter overlays. This refusal is captured in surface CSS by the
				// pointer path, so restore viewport CSS before returning it.
				css: [
					view.pointerRefusal.css[0] + adapterContext.evaluation.rect.left,
					view.pointerRefusal.css[1] + adapterContext.evaluation.rect.top
				],
				label: view.pointerRefusal.message
			}];
		}
		if (view.placing && view.pointerCss !== null) {
			return [{
				id: 'scene-candidate-need',
				css: [
					view.pointerCss[0] + adapterContext.evaluation.rect.left,
					view.pointerCss[1] + adapterContext.evaluation.rect.top
				],
				label: 'Point at a surface'
			}];
		}
		return [];
	}
	const css = adapterContext.project(candidate.position);
	if (css === null) return [];
	return [
		{
			id: 'scene-candidate',
			css,
			label: view.placing
				? 'Click to place · Esc cancels'
				: `${candidate.worldXZ[0].toFixed(3)}, ${candidate.worldXZ[1].toFixed(3)} m · ${candidate.yaw.toFixed(3)} rad${candidate.kind === 'resize' ? ` · scale ${candidate.scale}` : ''}${candidate.snappedStep === null ? '' : ` · snap ${candidate.snappedStep} m`}`
		}
	];
}

/**
 * Ghost meshes for the shown placement candidate, appended after the `leading`
 * ghosts the mark gesture and the drawn tile already contributed.
 */
export function presentGhosts(
	adapterContext: StageAdapterContext,
	view: PlacementPresentationView,
	leading: readonly StageGhostMesh[]
): readonly StageGhostMesh[] {
	const marks = [...leading];
	const candidate: SceneCandidate | null = view.held ?? view.sessionCandidate();
	const releaseRefusal = candidate === null ? view.releaseRefusal() : null;
	const refused = candidate === null
		? releaseRefusal?.candidate ?? view.pointerRefusal?.candidate ?? null
		: null;
	const shown = candidate ?? refused;
	if (shown === null) return marks;
	const entity =
		shown.entityId === null
			? null
			: adapterContext.snapshot.domain.scene.entities.find((entry) => entry.id === shown.entityId) ??
				null;
	const ghost = candidateGhost(entity, shown, {
		modelFootprint:
			entity?.kind === 'model'
				? adapterContext.snapshot.domain.scene.modelFootprints?.get(entity.assetId) ??
				  admittedModelFootprint(adapterContext.snapshot, entity.assetId)
				: null,
		modelContactMinY:
			shown.modelContactMinY ?? (entity?.kind === 'model' ? view.contact(entity) : null),
		treatment: candidate !== null ? 'subject' : 'refused'
	});
	return ghost === null ? marks : [...marks, ghost];
}
