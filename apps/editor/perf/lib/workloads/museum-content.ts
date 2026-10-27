/**
 * Scene placements, Camera Views and an Experience route for the museum-shaped
 * workloads (T1.P02.S06 B). Generator-only: it reads the editor catalogue and
 * runs T3's public Experience operations, so it runs under `vite-node` with the
 * editor's `$lib` alias, never inside a measured browser run.
 *
 * - **Placements** are shipped catalogue models (already licensed product
 *   assets, no download). They stand in for the realistic-L load's approved
 *   derivatives until the owner approves those sources; see `realistic.ts`.
 * - **Views, Presentations and Stops** are created through T3's own F4
 *   operations (`createExperienceIntent`, `captureBindIntent`) on the acceptance
 *   coordinator, exactly as the Experience surface submits them.
 * - **Connections** have no public operation (Camera graph authoring is not
 *   shipped), so the route's consecutive Views are joined with authored
 *   connection records through the door between their galleries, then the
 *   whole envelope passes the real admission. T3 reviews this generator.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assets, resolveAssetFallback } from '$lib/content/assets';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { captureBindIntent, capturedViewPose, createExperienceIntent } from '$lib/authoring/experience/commands';
import type { SceneEntity } from '@portfolio/project-model';
import {
	cameraUnit,
	computeEnvelopeSourceContentId,
	MODEL_RESOURCE_MIME,
	normalizeUnitEnvelope,
	resourceUnit,
	createUnitAcceptanceProfile,
	replaceUnitData,
	sceneUnit,
	serializeProjectEnvelope,
	type CameraUnitPayload,
	type ProjectEnvelope,
	type TypedResource
} from '@portfolio/project-model/units';

import { FOCUS_WING, MUSEUM_BOUNDS, sweepBlockOrigin, SWEEP_BLOCK, type SweepVariant } from './museum-layout';

const STATIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../static');

/** Floor-standing catalogue models whose bytes actually ship (not fallback-only). */
function placeableAssets() {
	return assets.filter(
		(asset) =>
			asset.productionFile !== undefined &&
			asset.placementSurface === 'floor' &&
			existsSync(join(STATIC_DIR, asset.productionFile))
	);
}

type Vec3 = [number, number, number];

/** Deterministic placement grid inside one rectangle, clear of its Walls. */
function placementsIn(
	prefix: string,
	rect: { x0: number; z0: number; x1: number; z1: number },
	count: number,
	salt: number
): SceneEntity[] {
	const catalogue = placeableAssets();
	const entities: SceneEntity[] = [];
	const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
	const rows = Math.ceil(count / columns);
	for (let index = 0; index < count; index++) {
		const asset = catalogue[(index + salt) % catalogue.length]!;
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = rect.x0 + ((column + 0.5) / columns) * (rect.x1 - rect.x0);
		const z = rect.z0 + ((row + 0.5) / rows) * (rect.z1 - rect.z0);
		entities.push({
			id: `${prefix}-${index}`,
			name: `${asset.name ?? asset.id} ${index + 1}`,
			kind: 'model',
			assetId: asset.id,
			fallback: resolveAssetFallback(asset),
			position: [x, 0, z],
			rotation: [0, ((index * 37 + salt * 11) % 360) * (Math.PI / 180), 0]
		} as SceneEntity);
	}
	return entities;
}

const SOUTH_COLUMNS = [MUSEUM_BOUNDS.x0, 4, 14, 24, 36, 46, 56, 66, 76, MUSEUM_BOUNDS.x1];

/** The base museum's placements: ornaments in the focus wing, a few per gallery elsewhere. */
export function museumPlacements(): SceneEntity[] {
	const entities: SceneEntity[] = [];
	// Focus wing: the south row's two west galleries carry the ornament set (the
	// north row keeps the enfilade axis and the fixed View's foreground clear).
	entities.push(...placementsIn('focus-ornament-a', { x0: -11, z0: -11, x1: 3, z1: -10 }, 8, 0));
	entities.push(...placementsIn('focus-ornament-b', { x0: 5, z0: -11, x1: 13, z1: -10 }, 6, 3));
	entities.push(...placementsIn('focus-ornament-c', { x0: -11, z0: 4.5, x1: 3, z1: 5.5 }, 6, 1));
	for (let column = 2; column + 1 < SOUTH_COLUMNS.length; column++) {
		const x0 = SOUTH_COLUMNS[column]! + 1;
		const x1 = SOUTH_COLUMNS[column + 1]! - 1;
		entities.push(...placementsIn(`south-${column}`, { x0, z0: -11, x1, z1: -10.2 }, 3, column));
		entities.push(...placementsIn(`south-n-${column}`, { x0, z0: 4.6, x1, z1: 5.4 }, 2, column + 1));
	}
	entities.push(...placementsIn('hall', { x0: 32, z0: 19.5, x1: 55, z1: 22 }, 12, 2));
	entities.push(...placementsIn('central-w', { x0: -8, z0: 10, x1: 29, z1: 11 }, 9, 4));
	entities.push(...placementsIn('north', { x0: -11, z0: 40, x1: 83, z1: 41 }, 16, 5));
	return entities;
}

/** Placements for the sweep blocks: the same per-Room density as a museum gallery. */
export function sweepPlacements(variant: SweepVariant, blocks: number): SceneEntity[] {
	const size = SWEEP_BLOCK.k * SWEEP_BLOCK.cell;
	const entities: SceneEntity[] = [];
	for (let index = 0; index < blocks; index++) {
		const [ox, oz] = sweepBlockOrigin(variant, index);
		entities.push(
			...placementsIn(`sweep-${variant}-${index}`, { x0: ox + 1, z0: oz + 1, x1: ox + size - 1, z1: oz + size - 1 }, 24, index)
		);
	}
	return entities;
}

/**
 * The executable closure of a catalogue model: a typed `asset` resource pinned
 * to the shipped file's exact bytes. Without it the envelope admits for reading
 * but every F4 acceptance refuses with `lock-closure`.
 */
function catalogueResource(assetId: string): TypedResource {
	const asset = assets.find((candidate) => candidate.id === assetId);
	if (asset?.productionFile === undefined) throw new Error(`catalogue asset ${assetId} has no shipped file`);
	const bytes = readFileSync(join(STATIC_DIR, asset.productionFile));
	const hash = `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
	return {
		kind: 'asset',
		id: assetId,
		contentRevision: hash,
		pin: { hash, mime: MODEL_RESOURCE_MIME, size: bytes.byteLength, locator: asset.productionFile },
		unresolved: null
	};
}

export function withPlacements(envelope: ProjectEnvelope, entities: readonly SceneEntity[]): ProjectEnvelope {
	const scene = sceneUnit(envelope);
	const placed = replaceUnitData(envelope, 'scene', { ...scene, entities: [...scene.entities, ...entities] });
	const registry = resourceUnit(placed);
	const known = new Set(registry.resources.map((resource) => `${resource.kind}:${resource.id}`));
	const assetIds = [...new Set(entities.flatMap((entity) => (entity.kind === 'model' ? [entity.assetId] : [])))].sort();
	const added = assetIds.filter((id) => !known.has(`asset:${id}`)).map(catalogueResource);
	return replaceUnitData(placed, 'resources', { ...registry, resources: [...registry.resources, ...added] });
}

/**
 * The route's Views: the north row of the south wing west → east (its first
 * View is the focus wing's fixed View), then its south row east → west.
 * Consecutive galleries share a door, which their Camera connection passes.
 */
type RouteView = { readonly label: string; readonly eye: Vec3; readonly target: Vec3; readonly door: Vec3 | null };

const EYE_HEIGHT = 1.6;
const TARGET_HEIGHT = 1.4;
const NORTH_ROW_Z = 1.5;
const SOUTH_ROW_Z = -4.5;

export const FIXED_VIEW_LABEL = 'Focus wing — enfilade';

function routeViews(): RouteView[] {
	const views: RouteView[] = [];
	for (let column = 0; column + 1 < SOUTH_COLUMNS.length; column++) {
		const a = SOUTH_COLUMNS[column]!;
		const b = SOUTH_COLUMNS[column + 1]!;
		views.push({
			label: column === 0 ? FIXED_VIEW_LABEL : `Gallery N${column + 1}`,
			eye: [a + (b - a) * 0.25, EYE_HEIGHT, NORTH_ROW_Z],
			target: [b, TARGET_HEIGHT, NORTH_ROW_Z],
			door: column === 0 ? null : [a, EYE_HEIGHT, NORTH_ROW_Z]
		});
	}
	for (let column = SOUTH_COLUMNS.length - 2; column >= 0; column--) {
		const a = SOUTH_COLUMNS[column]!;
		const b = SOUTH_COLUMNS[column + 1]!;
		const turning = column === SOUTH_COLUMNS.length - 2;
		views.push({
			label: `Gallery S${column + 1}`,
			eye: [a + (b - a) * 0.75, EYE_HEIGHT, SOUTH_ROW_Z],
			target: [a, TARGET_HEIGHT, SOUTH_ROW_Z],
			// Turning from the north row: the row door on z = -3 is centered on its Wall span.
			door: turning ? [(a + b) / 2, EYE_HEIGHT, -3] : [b, EYE_HEIGHT, SOUTH_ROW_Z]
		});
	}
	return views;
}

/** The fixed View the E5 sweep holds constant (plan meters, world Y up). */
export const FIXED_VIEW = (() => {
	const first = routeViews()[0]!;
	return { eye: first.eye, target: first.target, fov: 54 };
})();

export async function withExperienceRoute(unnormalized: ProjectEnvelope): Promise<ProjectEnvelope> {
	// The placed baseline carries derived revisions again before any F4 operation
	// reads it; an operation compares unit revisions to scope its domain.
	const envelope = await normalizeUnitEnvelope(unnormalized);
	const sessionEpoch = 'session:perf-workload';
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch,
		baseline: {
			revision: envelope.acceptedRevision,
			source: envelope,
			canonicalJson: serializeProjectEnvelope(envelope),
			sourceContentId: await computeEnvelopeSourceContentId(envelope)
		},
		mintRevisionId: (ordinal) => `${envelope.acceptedRevision.revisionId}-route-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	const current = () => coordinator.acceptedSnapshot().domain.source;
	const accept = async (intent: Parameters<typeof coordinator.accept>[0]) => {
		const outcome = await coordinator.accept(intent);
		if (outcome.kind !== 'accepted') throw new Error(`Experience operation refused: ${JSON.stringify(outcome).slice(0, 400)}`);
	};

	await accept(
		createExperienceIntent({
			revision: coordinator.acceptedRevision(),
			ids: { operation: 'op-experience', experience: 'experience-museum' },
			label: 'Museum walk'
		})
	);
	const views = routeViews();
	for (const [index, view] of views.entries()) {
		const n = String(index + 1).padStart(2, '0');
		await accept(
			captureBindIntent({
				envelope: current(),
				revision: coordinator.acceptedRevision(),
				ids: {
					operation: `op-capture-${n}`,
					view: `view-${n}`,
					presentation: `presentation-${n}`,
					stop: `stop-${n}`,
					...(index === 0 ? { guide: 'guide-museum' } : {})
				},
				experienceId: 'experience-museum',
				view: capturedViewPose({ label: view.label, eye: view.eye, target: view.target, fov: 54 }),
				presentationLabel: view.label,
				subjectEntityId: null,
				text: null,
				guideId: index === 0 ? null : 'guide-museum',
				firstGuideLabel: index === 0 ? 'Museum walk' : null,
				afterStopId: index === 0 ? null : `stop-${String(index).padStart(2, '0')}`
			})
		);
	}

	// Camera connections between consecutive route Views, through their shared door.
	const routed = current();
	const camera = cameraUnit(routed);
	const connections: CameraUnitPayload['connections'] = [];
	const neighbours = new Map<string, string[]>();
	for (let index = 1; index < views.length; index++) {
		const from = `view-${String(index).padStart(2, '0')}`;
		const to = `view-${String(index + 1).padStart(2, '0')}`;
		connections.push({
			id: `connection-${String(index).padStart(2, '0')}`,
			fromNodeId: from,
			toNodeId: to,
			positionPath: {
				kind: 'rounded-polyline',
				anchors: [{ id: `anchor-${String(index).padStart(2, '0')}`, position: views[index]!.door! }]
			},
			clearance: 0.35,
			timing: {
				forward: { durationSeconds: 4, easing: 'smoothstep' },
				reverse: { durationSeconds: 4, easing: 'smoothstep' }
			}
		});
		neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
		neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
	}
	return normalizeUnitEnvelope(replaceUnitData(routed, 'camera', {
		...camera,
		views: camera.views.map((view) => ({ ...view, connectedViewIds: neighbours.get(view.id) ?? [] })),
		connections: [...camera.connections, ...connections]
	}));
}

/** Plan rectangle of the focus wing, for census callers. */
export const FOCUS_WING_RECT = FOCUS_WING;
