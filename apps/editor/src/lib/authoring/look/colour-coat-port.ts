/**
 * The colour-coat port: Paint's Colours tab writes through it.
 *
 * Each stroke is one `scene-colour-coat` acceptance, so one Undo. The port
 * runs the same pure `planColourCoats` the planner runs, on the same accepted
 * snapshot, to allocate exactly the Finish ids the coat creates; it never
 * edits a Finish and never decides the recipe itself.
 */
import {
	SCENE_COLOUR_COAT,
	coatKeepsRelief,
	coatMaterialLabel,
	coatSourceOf,
	planColourCoats,
	type CoatTarget,
} from '@portfolio/project-model/scene-planning';
import type { MaterialId, SceneColor, SceneSurfaceRef } from '@portfolio/project-model/scene';
import type { SemanticReference } from '@portfolio/project-model/references';
import type { Recipe } from '@portfolio/project-model/materials';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import type { PaintColour } from './paint-pick';

type Snapshot = ReturnType<StageAdapterServices['stage']['snapshot']>;

/** What a colour pick would do to one target, for the consequence line. */
export type CoatReading =
	| { readonly kind: 'refused'; readonly message: string }
	/** `keeps` names the material whose relief and sheen stay, or null when it has none. */
	| { readonly kind: 'coat'; readonly keeps: string | null };

export type ColourCoatTargetRef =
	| { readonly entityId: string }
	| { readonly surface: SceneSurfaceRef };

/** The F.1 subject and component one Layout surface identity names. */
export function layoutSurfaceTarget(
	snapshot: Snapshot,
	surface: SceneSurfaceRef,
): SemanticReference {
	const subject =
		surface.kind === 'wall-side'
			? { kind: 'wall' as const, id: surface.wallId }
			: surface.kind === 'region-face'
				? { kind: 'region' as const, id: surface.regionId }
				: { kind: 'room' as const, id: surface.roomId };
	const componentId =
		surface.kind === 'wall-side'
			? `side:${surface.side}`
			: surface.kind === 'region-face'
				? surface.face
				: surface.kind === 'room-floor'
					? 'floor'
					: 'lid';
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: snapshot.domain.unitRevisions.layout },
		subject,
		instancePath: [],
		location: {
			kind: 'layout-location',
			levelId: snapshot.domain.layoutLevelId,
			structureInstancePath: [],
		},
		componentId,
		capabilityId: null,
	};
}

export function sceneEntityTarget(snapshot: Snapshot, id: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: snapshot.domain.unitRevisions.scene },
		subject: { kind: 'entity', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

export function sceneColorOf(colour: PaintColour): SceneColor {
	return colour.kind === 'slot' ? { slot: colour.slotId } : colour.hex;
}

export type ColourCoatPortHost = {
	readonly services: () => StageAdapterServices | null;
	readonly onNotice: (message: string) => void;
	readonly labelForMaterial: (id: MaterialId) => string;
};

export function createColourCoatPort(host: ColourCoatPortHost) {
	function recipes(snapshot: Snapshot): ReadonlyMap<string, Recipe> {
		return (
			(snapshot.domain.scene.materialIndex?.definitions as
				| ReadonlyMap<string, Recipe>
				| undefined) ?? new Map()
		);
	}

	function plan(snapshot: Snapshot, colour: PaintColour, targets: readonly CoatTarget[]) {
		return planColourCoats(snapshot.domain.scene, {
			colour: sceneColorOf(colour),
			targets,
			materialRecipes: recipes(snapshot),
			labelForMaterial: host.labelForMaterial,
		});
	}

	async function paint(
		colour: PaintColour,
		targets: readonly CoatTarget[],
		payload:
			| { readonly entityIds: readonly string[] }
			| { readonly surfaces: readonly SceneSurfaceRef[] },
	): Promise<boolean> {
		const services = host.services();
		if (services === null) {
			host.onNotice('The Stage is still opening.');
			return false;
		}
		if (targets.length === 0) return false;
		const snapshot = services.stage.snapshot();
		const planned = plan(snapshot, colour, targets);
		if (planned.kind === 'refused') {
			host.onNotice(planned.message);
			return false;
		}
		if (planned.already) return false;
		const outcome = await services.authoring.accept({
			version: 1,
			kind: SCENE_COLOUR_COAT,
			operationId: crypto.randomUUID(),
			expectedRevision: snapshot.acceptedRevision,
			targets: targets.map((target) =>
				target.kind === 'entity'
					? sceneEntityTarget(snapshot, target.id)
					: layoutSurfaceTarget(snapshot, target.surface),
			),
			payload: { colour: sceneColorOf(colour), ...payload } as never,
			capturedInputs: [],
			allocatedIds: planned.creates.map(() => ({ kind: 'scene-finish', id: crypto.randomUUID() })),
		});
		if (
			outcome.kind === 'refused' &&
			outcome.code !== 'no-change' &&
			outcome.reason !== 'no-change'
		) {
			host.onNotice(outcome.message);
		}
		return outcome.kind === 'installed';
	}

	function targetsOf(refs: {
		readonly entityIds: readonly string[];
		readonly surfaces: readonly SceneSurfaceRef[];
	}): CoatTarget[] {
		return [
			...refs.entityIds.map((id): CoatTarget => ({ kind: 'entity', id })),
			...refs.surfaces.map((surface): CoatTarget => ({ kind: 'surface', surface })),
		];
	}

	return {
		/**
		 * One acceptance. Objects that take no coat (a model's own materials) are
		 * left out of the stroke and named; when none is left the stroke refuses.
		 */
		async paintEntities(entityIds: readonly string[], colour: PaintColour): Promise<boolean> {
			const snapshot = host.services()?.stage.snapshot() ?? null;
			if (snapshot === null) return paint(colour, [], { entityIds });
			const readings = entityIds.map((id) => ({
				id,
				source: coatSourceOf(snapshot.domain.scene, { kind: 'entity', id }),
			}));
			const coatable = readings
				.filter((entry) => !('kind' in entry.source))
				.map((entry) => entry.id);
			const refused = readings.find((entry) => 'kind' in entry.source);
			if (coatable.length === 0) {
				if (refused !== undefined && 'kind' in refused.source)
					host.onNotice(refused.source.message);
				return false;
			}
			const painted = await paint(
				colour,
				coatable.map((id) => ({ kind: 'entity', id })),
				{ entityIds: coatable },
			);
			if (painted && coatable.length < entityIds.length) {
				const skipped = entityIds.length - coatable.length;
				host.onNotice(
					`Painted ${coatable.length} object${coatable.length === 1 ? '' : 's'}; ${skipped} keep${skipped === 1 ? 's' : ''} its own materials.`,
				);
			}
			return painted;
		},
		paintSurfaces(surfaces: readonly SceneSurfaceRef[], colour: PaintColour): Promise<boolean> {
			return paint(
				colour,
				surfaces.map((surface) => ({ kind: 'surface', surface })),
				{ surfaces },
			);
		},
		isAlready(
			refs: {
				readonly entityIds: readonly string[];
				readonly surfaces: readonly SceneSurfaceRef[];
			},
			colour: PaintColour,
		): boolean {
			const snapshot = host.services()?.stage.snapshot() ?? null;
			const targets = targetsOf(refs);
			if (snapshot === null || targets.length === 0) return false;
			const planned = plan(snapshot, colour, targets);
			return planned.kind === 'planned' && planned.already;
		},
		/** What a colour would do to this target: refuse in place, or keep the named relief. */
		read(target: ColourCoatTargetRef): CoatReading | null {
			const snapshot = host.services()?.stage.snapshot() ?? null;
			if (snapshot === null) return null;
			const source = coatSourceOf(
				snapshot.domain.scene,
				'entityId' in target
					? { kind: 'entity', id: target.entityId }
					: { kind: 'surface', surface: target.surface },
			);
			if ('kind' in source) return { kind: 'refused', message: source.message };
			return {
				kind: 'coat',
				keeps: coatKeepsRelief(source, recipes(snapshot))
					? coatMaterialLabel(source, host.labelForMaterial)
					: null,
			};
		},
	};
}

export type ColourCoatPort = ReturnType<typeof createColourCoatPort>;
