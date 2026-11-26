/**
 * Save an accepted Scene Finish into My Materials and insert one back into a
 * project.
 *
 * Save is a snapshot, not a link: it flattens the current palette-following
 * colour to a literal and names every private image by its exact pin. Insert is
 * two-phase by design: the API vendors exact bytes and allocates one Finish id;
 * the active editor then registers that id through the ordinary F4 intent. A
 * stale editor refuses only the registration, leaving the vendored P20 rows for
 * a later insert.
 */
import { resolveLayoutSurface } from '@portfolio/layout-core/plan';
import type { AcceptedRevision, SemanticReference } from '@portfolio/project-model/references';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import {
	finishLibraryDraftFromScene,
	MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE,
	type FinishLibraryDraft,
	type MaterialLibraryIssue,
	type MaterialLibraryItemSummary,
	type MaterialLibraryTransfer,
} from '@portfolio/project-model/library';
import type { Finish, Recipe } from '@portfolio/project-model/materials';
import { isFinishTarget, SCENE_FINISH_REGISTER } from '@portfolio/project-model/scene-planning';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { draftFinishId, type DraftTargets } from '../../../materials/material-set';
import type { MaterialProofRegistry } from '../../../material-proof';
import { encodeInspectionPng, type InspectionFrame } from '$lib/render/materials/inspection';
import { MaterialLibraryClientError, type MaterialLibraryClient } from './material-client';

export type FinishLibrarySaveResult =
	| {
			readonly ok: true;
			readonly summary: MaterialLibraryItemSummary;
			readonly draft: FinishLibraryDraft;
	  }
	| { readonly ok: false; readonly issues: readonly MaterialLibraryIssue[] };

/** The exact local image dependencies of one accepted Scene Finish. */
export function finishLibraryImages(source: ProjectEnvelope, materialId?: string | null) {
	const resources = source.units.resources.data.resources;
	return {
		definitionImages:
			materialId === null
				? []
				: resources.flatMap((resource) =>
						resource.kind === 'material' &&
						resource.material !== undefined &&
						(materialId === undefined || resource.id === materialId)
							? resource.material.images
							: [],
					),
		textureImages: resources.flatMap((resource) =>
			resource.kind === 'texture' && resource.pin !== null
				? [{ hash: resource.pin.hash, source: { textureId: resource.id } }]
				: [],
		),
	};
}

/**
 * Flatten and save one accepted Finish. The source is the accepted envelope the
 * creator is looking at; no project save or history entry is produced.
 */
export async function saveFinishToLibrary(input: {
	readonly source: ProjectEnvelope;
	readonly finishId?: string;
	/** A curated or draft Finish that is not a Scene material instance yet. */
	readonly finish?: Finish;
	readonly operationId: string;
	readonly client: MaterialLibraryClient;
	readonly signal?: AbortSignal;
}): Promise<FinishLibrarySaveResult> {
	const finish =
		input.finish ??
		input.source.units.scene.data.materials.find((entry) => entry.id === input.finishId);
	if (finish === undefined) {
		return {
			ok: false,
			issues: [
				{
					path: '$.finish',
					code: 'missing-finish',
					message: 'That Finish is not in the current revision.',
				},
			],
		};
	}
	const resources = input.source.units.resources.data.resources;
	const baseMaterial = 'material' in finish.base ? finish.base.material : null;
	const definition =
		baseMaterial === null
			? undefined
			: resources.find((resource) => resource.kind === 'material' && resource.id === baseMaterial);
	const images = finishLibraryImages(input.source, baseMaterial);
	const draft = await finishLibraryDraftFromScene({
		finish,
		definition: definition?.material?.recipe ?? null,
		definitionImages: definition?.material?.images ?? [],
		textureImages: images.textureImages,
		...(input.source.units.scene.data.palette === undefined
			? {}
			: { palette: input.source.units.scene.data.palette }),
	});
	if (!draft.ok) return draft;
	input.signal?.throwIfAborted();
	const summary = await input.client.save(
		{
			payload: draft.draft.payload,
			operationId: input.operationId,
			sourceProjectId: input.source.id,
			images: draft.draft.images,
		},
		input.signal,
	);
	return { ok: true, summary, draft: draft.draft };
}

/** The sample-tile master and the 192 px thumbnail size. */
const THUMBNAIL_EDGES: readonly number[] = [MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE, 192];

/**
 * Encode and install the square thumbnail for one saved item: the 256×256
 * sample-tile master or a 192×192 frame. The render happens outside this function; a failed encode or upload
 * leaves the item usable with the swatch fallback.
 */
export async function uploadFinishThumbnail(input: {
	readonly item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'recipeHash'>;
	readonly frame: InspectionFrame;
	readonly client: MaterialLibraryClient;
	readonly signal?: AbortSignal;
}): Promise<boolean> {
	if (input.frame.width !== input.frame.height || !THUMBNAIL_EDGES.includes(input.frame.width)) {
		throw new Error('A material thumbnail must be a 256×256 master or a 192×192 frame.');
	}
	const bytes = await encodeInspectionPng(input.frame);
	if (bytes === null) return false;
	if (bytes.byteLength > 256 * 1024) return false;
	input.signal?.throwIfAborted();
	await input.client.putThumbnail(input.item, bytes, input.signal);
	return true;
}

/** Install an already-encoded 256×256 PNG; the API enforces the edge and bytes. */
export async function uploadFinishThumbnailBytes(input: {
	readonly item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'recipeHash'>;
	readonly bytes: Uint8Array;
	readonly client: MaterialLibraryClient;
	readonly signal?: AbortSignal;
}): Promise<boolean> {
	if (input.bytes.byteLength > 256 * 1024) return false;
	input.signal?.throwIfAborted();
	await input.client.putThumbnail(input.item, input.bytes, input.signal);
	return true;
}

export type InsertFinishRefusal =
	| 'aborted'
	| 'stale-revision'
	| 'target-pending'
	| 'conflict'
	| 'refused';

export type InsertFinishResult =
	| { readonly ok: true; readonly finishId: string; readonly transfer: MaterialLibraryTransfer }
	| {
			readonly ok: false;
			readonly code: InsertFinishRefusal;
			readonly message: string;
			readonly issues: readonly {
				readonly path: string;
				readonly code: string;
				readonly message: string;
			}[];
	  };

export type InsertFinishHost = {
	readonly current: () => {
		readonly source: ProjectEnvelope;
		readonly revision: { readonly projectId: string; readonly revisionId: string };
	};
	readonly accept: (intent: AuthoringIntent) => Promise<{
		readonly kind: string;
		readonly code?: string;
		readonly reason?: string | null;
		readonly message?: string;
	}>;
	readonly entityReference: (source: ProjectEnvelope, entityId: string) => SemanticReference;
	readonly surfaceReference: (
		source: ProjectEnvelope,
		surface: DraftTargets['surfaces'][number],
	) => SemanticReference;
	/** The session proof registry the F4 planner reads synchronously. */
	readonly materialProofs: MaterialProofRegistry;
};

function refused(code: InsertFinishRefusal, message: string): InsertFinishResult {
	return { ok: false, code, message, issues: [{ path: '$', code, message }] };
}

/**
 * Vendor a saved material into the destination and register one new Finish.
 *
 * The transfer is owner-authorized by the API; this function only decides which
 * Scene records still need installing. A refusal after transfer is not rolled
 * back: the P20 rows are already reusable by the next attempt.
 */
export async function insertFinishFromLibrary(input: {
	readonly item: Pick<MaterialLibraryItemSummary, 'id' | 'contentId' | 'recipeHash'>;
	readonly destinationProjectId: string;
	readonly operationId: string;
	readonly expectedRevision?: AcceptedRevision;
	readonly targets: DraftTargets;
	readonly client: MaterialLibraryClient;
	readonly host: InsertFinishHost;
	readonly signal: AbortSignal;
}): Promise<InsertFinishResult> {
	if (input.signal.aborted) return refused('aborted', 'Cancelled. Nothing was inserted.');
	if (input.targets.entityIds.length > 0 && input.targets.surfaces.length > 0) {
		return refused(
			'refused',
			'Assign the inserted Finish to objects or to surfaces first, then paint the rest.',
		);
	}
	const beforeState = input.host.current();
	const expectedRevision = input.expectedRevision ?? beforeState.revision;
	if (
		beforeState.source.id !== input.destinationProjectId ||
		beforeState.revision.projectId !== expectedRevision.projectId ||
		beforeState.revision.revisionId !== expectedRevision.revisionId
	) {
		return refused(
			'stale-revision',
			'The destination project changed before insertion started. Try again.',
		);
	}
	for (const entityId of input.targets.entityIds) {
		const entity = beforeState.source.units.scene.data.entities.find(
			(entry) => entry.id === entityId,
		);
		if (entity === undefined) {
			return refused('refused', `Target entity "${entityId}" is not in the current revision.`);
		}
		if (!isFinishTarget(entity)) {
			return refused('refused', `Target entity "${entityId}" cannot receive a Finish.`);
		}
	}
	for (const surface of input.targets.surfaces) {
		if (resolveLayoutSurface(beforeState.source.units.layout.data, surface) !== 'present') {
			return refused('refused', 'Target surface is not present in the current layout.');
		}
	}
	let transfer: MaterialLibraryTransfer;
	try {
		transfer = await input.client.transfer(
			input.item,
			input.destinationProjectId,
			input.operationId,
			input.signal,
		);
	} catch (error) {
		if (input.signal.aborted) return refused('aborted', 'Cancelled. Nothing was inserted.');
		if (error instanceof MaterialLibraryClientError) {
			const code: InsertFinishRefusal =
				error.code === 'stale'
					? 'stale-revision'
					: error.code === 'conflict'
						? 'conflict'
						: 'refused';
			return refused(code, error.message);
		}
		const message =
			error instanceof Error ? error.message : 'The saved material could not be inserted.';
		return refused('refused', message);
	}
	if (transfer.finishId !== draftFinishId(input.operationId)) {
		return refused('conflict', 'The inserted material returned an unexpected Finish identity.');
	}
	const prepared = await input.host.materialProofs.prepareFinishRegistration(transfer.recipe);
	if (!prepared.ok) {
		return {
			ok: false,
			code: 'refused',
			message: 'The saved material recipe is not admissible in this session.',
			issues: prepared.issues.map((issue) => ({
				path: issue.path,
				code: issue.code,
				message: issue.action ?? issue.code,
			})),
		};
	}
	if (prepared.hash !== transfer.recipeHash) {
		return refused('conflict', 'The saved material recipe does not match its pinned revision.');
	}
	if (input.signal.aborted)
		return refused('aborted', 'Cancelled. The inserted images stay reusable in this project.');
	const afterState = input.host.current();
	if (
		afterState.source.id !== input.destinationProjectId ||
		afterState.revision.projectId !== expectedRevision.projectId ||
		afterState.revision.revisionId !== expectedRevision.revisionId
	) {
		return refused(
			'stale-revision',
			'The project changed while the material was being prepared. Try inserting it again.',
		);
	}
	const after = afterState.source;
	const scene = after.units.scene.data;
	const resources = after.units.resources.data.resources;
	const images = transfer.images.map((image) => {
		if ('shipped' in image.source) {
			return { hash: image.hash, source: image.source };
		}
		const textureId = image.source.textureId;
		const recorded = scene.textures.find((texture) => texture.id === textureId) !== undefined;
		const pinned = resources.some(
			(resource) =>
				resource.kind === 'texture' &&
				resource.id === textureId &&
				resource.pin?.hash === image.hash &&
				resource.pin.mime === image.mime &&
				resource.pin.size === image.byteSize,
		);
		return {
			hash: image.hash,
			source: image.source,
			...(recorded && pinned
				? {}
				: {
						texture: {
							name:
								image.name ??
								`library-${image.hash.slice('sha256-'.length, 'sha256-'.length + 12)}`,
							pin: { hash: image.hash, mime: image.mime, size: image.byteSize },
						},
					}),
		};
	});
	const outcome = await input.host.accept({
		version: 1,
		kind: SCENE_FINISH_REGISTER,
		operationId: input.operationId,
		expectedRevision,
		targets: [
			...input.targets.entityIds.map((id) => input.host.entityReference(after, id)),
			...input.targets.surfaces.map((surface) => input.host.surfaceReference(after, surface)),
		],
		payload: {
			name: transfer.name,
			recipeHash: transfer.recipeHash,
			recipe: transfer.recipe as Recipe,
			images,
			entityIds: [...input.targets.entityIds],
			...(input.targets.surfaces.length === 0 ? {} : { surfaces: [...input.targets.surfaces] }),
			targetFacts: [],
		},
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-finish', id: transfer.finishId }],
	} as AuthoringIntent);
	if (outcome.kind !== 'accepted') {
		const reason = outcome.reason ?? outcome.code ?? outcome.kind;
		const code: InsertFinishRefusal =
			reason === 'target-pending'
				? 'target-pending'
				: reason === 'stale-revision'
					? 'stale-revision'
					: reason === 'aborted'
						? 'aborted'
						: 'refused';
		return {
			ok: false,
			code,
			message: outcome.message ?? 'The saved material could not be added.',
			issues: [{ path: '$', code: reason, message: outcome.message ?? outcome.kind }],
		};
	}
	return { ok: true, finishId: transfer.finishId, transfer };
}
