/**
 * What a Library action names (T2.S8 U5).
 *
 * The Stage calls Apply/Use, but the Library talks about "this surface" or
 * "this object". This maps the accepted selection to exactly the entity or
 * Layout surface a Finish writer already understands, and resolves an
 * inspected user list back to one selection — never to a write.
 */
import type { SceneSurfaceRef } from '@portfolio/project-model/scene';
import type { SemanticReference } from '@portfolio/project-model/references';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import {
	finishKeyOfSurface,
	finishOf,
	isFinishPaintable,
	surfaceFinishFor,
	type FinishKey
} from '@portfolio/project-model/scene-planning';
import { resolveLayoutSurface, surfaceKey } from '@portfolio/layout-core/plan';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
import { layoutSurfaceTarget, sceneEntityTarget } from '../look/colour-coat-port';
import type { InspectedFinishUser } from '@portfolio/project-model/scene-planning';

type Snapshot = ReturnType<StageAdapterServices['stage']['snapshot']>;

export type LibraryTarget =
	| {
			readonly kind: 'entity';
			readonly key: string;
			readonly entityId: string;
			readonly label: string;
			readonly finishKey: FinishKey | null;
		}
	| {
			readonly kind: 'surface';
			readonly key: string;
			readonly surface: SceneSurfaceRef;
			readonly label: string;
			readonly finishKey: FinishKey | null;
		};

export function surfaceLabel(surface: SceneSurfaceRef): string {
	if (surface.kind === 'wall-side') return `Wall · ${surface.side}`;
	if (surface.kind === 'room-floor') return 'Floor';
	if (surface.kind === 'room-lid') return 'Ceiling';
	return `Region · ${surface.face}`;
}

function surfaceOfReference(reference: SemanticReference): SceneSurfaceRef | null {
	if (reference.domain !== 'layout') return null;
	const component = reference.componentId;
	if (reference.subject.kind === 'wall') {
		if (component !== 'side:left' && component !== 'side:right') return null;
		return { kind: 'wall-side', wallId: reference.subject.id, side: component === 'side:left' ? 'left' : 'right' };
	}
	if (reference.subject.kind === 'room') {
		if (component !== 'floor' && component !== 'lid') return null;
		return component === 'floor'
			? { kind: 'room-floor', roomId: reference.subject.id }
			: { kind: 'room-lid', roomId: reference.subject.id };
	}
	if (reference.subject.kind === 'region') {
		if (component !== 'top' && component !== 'underside') return null;
		return { kind: 'region-face', regionId: reference.subject.id, face: component };
	}
	return null;
}

/**
 * The Finish target the current selection names, or null when it cannot take
 * one (an empty selection, a light, an Artwork, an edge, a dormant surface).
 */
export function libraryTargetOf(
	reference: SemanticReference | null,
	envelope: ProjectEnvelope
): LibraryTarget | null {
	if (reference === null) return null;
	const scene = envelope.units.scene.data;
	if (reference.domain === 'scene' && reference.subject.kind === 'entity') {
		const entity = scene.entities.find((candidate) => candidate.id === reference.subject.id);
		if (entity === undefined || !isFinishPaintable(entity)) return null;
		return {
			kind: 'entity',
			key: `entity:${entity.id}`,
			entityId: entity.id,
			label: entity.name,
			finishKey: finishOf(entity, scene.materials)
		};
	}
	if (reference.domain !== 'layout') return null;
	const surface = surfaceOfReference(reference);
	if (surface === null) return null;
	const layout = envelope.units.layout.data;
	if (resolveLayoutSurface(layout, surface) !== 'present') return null;
	const assignment = surfaceFinishFor(scene, surface);
	return {
		kind: 'surface',
		key: `surface:${surfaceKey(surface)}`,
		surface,
		label: surfaceLabel(surface),
		finishKey: assignment === null ? null : finishKeyOfSurface(scene, assignment)
	};
}

/**
 * The Library target a Stage pick names (the draft editor's retarget), read
 * fresh from the accepted envelope: null when it cannot take a Finish.
 */
export function libraryTargetOfPick(
	pick: { readonly kind: 'entity'; readonly entityId: string } | { readonly kind: 'surface'; readonly surface: SceneSurfaceRef },
	envelope: ProjectEnvelope
): LibraryTarget | null {
	const scene = envelope.units.scene.data;
	if (pick.kind === 'entity') {
		const entity = scene.entities.find((candidate) => candidate.id === pick.entityId);
		if (entity === undefined || !isFinishPaintable(entity)) return null;
		return {
			kind: 'entity',
			key: `entity:${entity.id}`,
			entityId: entity.id,
			label: entity.name,
			finishKey: finishOf(entity, scene.materials)
		};
	}
	const layout = envelope.units.layout.data;
	if (resolveLayoutSurface(layout, pick.surface) !== 'present') return null;
	const assignment = surfaceFinishFor(scene, pick.surface);
	return {
		kind: 'surface',
		key: `surface:${surfaceKey(pick.surface)}`,
		surface: pick.surface,
		label: surfaceLabel(pick.surface),
		finishKey: assignment === null ? null : finishKeyOfSurface(scene, assignment)
	};
}

/** A selection of every present user an inspection found; dormant surfaces are listed but not selected. */
export function selectionEntriesOfFinishUsers(
	users: readonly InspectedFinishUser[],
	snapshot: Snapshot
): StageSelectionEntry[] {
	const entries: StageSelectionEntry[] = [];
	for (const user of users) {
		if (user.kind === 'entity') {
			entries.push({ reference: sceneEntityTarget(snapshot, user.entityId) });
		} else if (user.lifecycle === 'present') {
			entries.push({ reference: layoutSurfaceTarget(snapshot, user.surface) });
		}
	}
	return entries;
}

/** Whether a target already wears the Finish: the draft's one pre-condition. */
export function targetWears(target: LibraryTarget | null, finishKey: FinishKey): boolean {
	return target !== null && target.finishKey === finishKey;
}
