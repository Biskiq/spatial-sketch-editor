import { defaultArtworkWidth, isArtworkWidth } from '../artwork';
import type { DomainPlanner, PlannerOutcome, PlannerRequest } from '../f4';
import type { SceneArtworkEntity } from '../scene';
import { validateArtworkLibrary } from '../scene-codec';
import { ShapeReader } from '../strict-shape';
import { replaceUnitData } from '../units/envelope';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../units/source';
import type { ProjectEnvelope, CameraFreeSceneDocument } from '../units/types';
import { sceneEntityTargetProblem } from './intent-payload';
import { finalizeSceneCandidate, type SceneRecordScope } from './record-scope';

export const ARTWORK_IMPORT = 'artwork-import';
export const ARTWORK_PLACE = 'artwork-place';
export const ARTWORK_TRANSFORM = 'artwork-transform';
export const ARTWORK_DUPLICATE = 'artwork-duplicate';

const kinds = [ARTWORK_IMPORT, ARTWORK_PLACE, ARTWORK_TRANSFORM, ARTWORK_DUPLICATE] as const;
type Kind = (typeof kinds)[number];
type Result = PlannerOutcome<ProjectEnvelope>;

function refuse(message: string, code = 'invalid-value'): Result {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

function prepare(request: PlannerRequest<ProjectEnvelope>, kind: Kind): Result {
	const envelope = request.snapshot.domain.source;
	const { data: before, header } = envelope.units.scene;
	const { targets, allocatedIds } = request.intent;
	const reader = new ShapeReader();
	const scope = {
		operationKind: kind, changedEntityIds: [], changedEntityFields: [],
		createdEntityIds: [], removedEntityIds: [], allowClusterCleanup: false
	} satisfies SceneRecordScope;
	const complete = (
		after: CameraFreeSceneDocument,
		grant: Partial<SceneRecordScope>,
		subjectIds: string[],
		fields: string[]
	): Result => {
		const finalized = finalizeSceneCandidate({ before, after, scope: { ...scope, ...grant } });
		if (finalized.kind === 'rejected') return finalized;
		return {
			kind: 'prepared',
			candidate: {
				operationId: request.intent.operationId,
				sourceKind: request.snapshot.sourceKind,
				sourceVersion: request.snapshot.sourceVersion,
				source: replaceUnitData(envelope, 'scene', finalized.scene),
				changes: [{ kind, subjectIds, fields }],
				correspondence: [],
				diagnostics: []
			}
		};
	};
	if (kind === ARTWORK_IMPORT) {
		const payload = reader.object(request.intent.payload, '$.payload', ['entries']);
		if (!Array.isArray(payload?.entries) || targets.length || allocatedIds.length || reader.issues.length) {
			return refuse('Import requires a list of project Artwork images.');
		}
		const { library, issues } = validateArtworkLibrary(payload.entries, []);
		if (issues.length) return refuse(issues[0]!.message);
		const existing = new Map((before.artworkLibrary ?? []).map((entry) => [entry.assetId, entry]));
		const additions = library.filter((entry) => !existing.has(entry.assetId));
		if (library.some((entry) => {
			const prior = existing.get(entry.assetId);
			return prior && (prior.pixelWidth !== entry.pixelWidth || prior.pixelHeight !== entry.pixelHeight);
		})) return refuse('An Artwork image no longer matches its Library record.');
		if (!additions.length) return refuse('These images are already in the Artwork Library.', 'no-change');
		const ids = additions.map((entry) => entry.assetId);
		return complete({ ...before, artworkLibrary: [...existing.values(), ...additions] },
			{ addedArtworkAssetIds: ids }, ids, ['artworkLibrary']);
	}

	const creates = kind === ARTWORK_PLACE || kind === ARTWORK_DUPLICATE;
	const allocation = allocatedIds[0];
	if (creates ? (allocatedIds.length !== 1 || allocation?.kind !== 'scene-entity' ||
		before.entities.some((entity) => entity.id === allocation.id)) : allocatedIds.length !== 0) {
		return refuse('Artwork needs an unused allocated Scene entity ID for placement or duplication.');
	}
	if (kind === ARTWORK_PLACE) {
		const payload = reader.object(request.intent.payload, '$.payload', ['assetId', 'position', 'rotation']);
		const entry = before.artworkLibrary?.find((image) => image.assetId === payload?.assetId);
		const position = reader.vector3(payload?.position, '$.payload.position');
		const rotation = reader.vector3(payload?.rotation, '$.payload.rotation');
		if (!entry || !position || !rotation || targets.length || reader.issues.length) {
			return refuse('Place requires a Library image and a finite world pose.');
		}
		const { assetId, name, pixelWidth, pixelHeight } = entry;
		const widthMeters = defaultArtworkWidth(entry);
		const entity: SceneArtworkEntity = {
			kind: 'artwork', id: allocation!.id, name, position, rotation, widthMeters,
			source: { kind: 'image', assetId, pixelWidth, pixelHeight }
		};
		return complete({ ...before, entities: [...before.entities, entity] },
			{ createdEntityIds: [entity.id] }, [entity.id], ['entities']);
	}

	const target = targets[0];
	const entity = before.entities.find((item) => item.id === target?.subject.id);
	if (targets.length !== 1 || entity?.kind !== 'artwork' ||
		sceneEntityTargetProblem(target!, entity.id, header.contentRevision)) {
		return refuse('Choose one Artwork from the current Scene revision.');
	}
	if (kind === ARTWORK_DUPLICATE) {
		reader.object(request.intent.payload, '$.payload', []);
		if (reader.issues.length) return refuse(reader.issues[0]!.message);
		const duplicate: SceneArtworkEntity = {
			...entity, id: allocation!.id,
			position: [entity.position[0] + 0.15, entity.position[1], entity.position[2] + 0.15]
		};
		return complete({ ...before, entities: [...before.entities, duplicate] },
			{ createdEntityIds: [duplicate.id] }, [duplicate.id], ['entities']);
	}

	const payload = reader.object(request.intent.payload, '$.payload', ['widthMeters', 'position', 'rotation']);
	const position = payload?.position === undefined ? entity.position : reader.vector3(payload.position, '$.payload.position');
	const rotation = payload?.rotation === undefined ? entity.rotation : reader.vector3(payload.rotation, '$.payload.rotation');
	const widthMeters = payload?.widthMeters === undefined ? entity.widthMeters : reader.number(payload.widthMeters, '$.payload.widthMeters');
	if (!position || !rotation || widthMeters === null || !isArtworkWidth(widthMeters, entity.source) || reader.issues.length) {
		return refuse('Artwork needs a finite pose and a width and height between 0.001 and 1000 m.');
	}
	if (widthMeters === entity.widthMeters && position.every((value, i) => value === entity.position[i]) &&
		rotation.every((value, i) => value === entity.rotation[i])) return refuse('Artwork is unchanged.', 'no-change');
	const fields = Object.keys(payload!);
	const entities = before.entities.map((item) => item.id === entity.id ? { ...entity, position, rotation, widthMeters } : item);
	return complete({ ...before, entities }, { changedEntityIds: [entity.id], changedEntityFields: fields }, [entity.id], fields);
}

export function createArtworkPlanners(): DomainPlanner<ProjectEnvelope>[] {
	return kinds.map((kind) => ({
		id: `scene.${kind}`,
		kind,
		admission: { domain: 'scene', compound: false, units: false, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare: (request) => prepare(request, kind)
	}));
}
