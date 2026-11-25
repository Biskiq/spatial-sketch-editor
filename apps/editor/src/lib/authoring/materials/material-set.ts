/**
 * Manual composition and correctable set import, editor side (T2.S8 E5).
 *
 * The pure grammar, correction and composition live in
 * `@portfolio/project-model/material-authoring`; this module owns everything
 * that touches bytes and the network:
 *
 * 1. `readSetFileFacts` hashes and probes the creator's files (two at a time)
 *    and keeps the exact bytes in session memory. Nothing here is persisted.
 * 2. `prepareDraft` composes one recipe from edits and verified facts, digests
 *    it through the session proof registry and returns a `PreparedFinishDraft`
 *    whose sources are scoped readers over those session bytes.
 * 3. `acceptDraft` stages each distinct digest through the P20 importer, rechecks
 *    the expected revision and target reach after IO, then issues exactly one
 *    `scene-finish-register` intent with a deterministic Finish id.
 *
 * A refusal at any step leaves the accepted project unchanged. Uploaded P20
 * bytes stay under ordinary retention when a later step is cancelled.
 */
import { probeArtworkImage } from '@portfolio/project-model/artwork';
import type { AcceptedRevision, SemanticReference } from '@portfolio/project-model/references';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import {
	composeDraft,
	type DraftEdits,
	type DraftIssue,
	type SetFileFact,
	type SetImageMime
} from '@portfolio/project-model/material-authoring';
import type { Hash, Recipe, TargetAnalysis } from '@portfolio/project-model/materials';
import { SCENE_FINISH_REGISTER, isFinishTarget } from '@portfolio/project-model/scene-planning';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { resolveLayoutSurface, surfaceKey, type LayoutSurfaceRef } from '@portfolio/layout-core/plan';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { imageSha256 } from '$lib/render/artwork/image-digest';
import { probeRawImage } from '$lib/render/resources/image-encoding';
import { FINISH_IMAGE_POLICY, importProjectImage, type ImportedProjectImage } from '../artwork/project-artwork';
import type { MaterialProofRegistry } from '../material-proof';

/** The preflight/decode/upload concurrency the plan fixes. */
export const MATERIAL_SET_CONCURRENCY = 2;

/** One creator file, named by a session-local key. */
export type SetFileInput = { readonly key: string; readonly file: File };

/** A scoped reader for one verified digest's exact bytes. */
export type VerifiedImageSource = {
	readonly hash: Hash;
	readonly mime: SetImageMime;
	readonly length: number;
	/** The creator's file name, display-only. */
	readonly name: string;
	read(signal?: AbortSignal): Promise<Uint8Array>;
	release(): void;
};

export type PreparedFinishDraft = {
	readonly expectedRevision: AcceptedRevision;
	readonly name: string;
	readonly recipe: Recipe;
	readonly recipeHash: Hash;
	readonly sources: ReadonlyMap<Hash, VerifiedImageSource>;
};

/** The session store of verified bytes behind a set of file facts. */
export type SetFileSession = {
	readonly facts: readonly SetFileFact[];
	factsByKey(): ReadonlyMap<string, SetFileFact>;
	bytesOf(key: string): Uint8Array | undefined;
	release(): void;
};

/**
 * Run `work` over `items`, at most `limit` at a time, preserving input order.
 *
 * The first failure aborts the lanes' shared signal and stops new items from
 * starting; every lane settles before this returns or throws, so no `work` call
 * begins or is still running after the caller sees the result.
 */
async function mapBounded<T, R>(
	items: readonly T[],
	limit: number,
	signal: AbortSignal,
	work: (item: T, signal: AbortSignal) => Promise<R>
): Promise<R[]> {
	const controller = new AbortController();
	const link = () => controller.abort(signal.reason);
	if (signal.aborted) link();
	else signal.addEventListener('abort', link, { once: true });
	const results = new Array<R>(items.length);
	let next = 0;
	let failure: { readonly error: unknown } | null = null;
	const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (failure === null && next < items.length) {
			if (controller.signal.aborted) {
				failure ??= { error: controller.signal.reason ?? new DOMException('Aborted', 'AbortError') };
				return;
			}
			const index = next++;
			try {
				results[index] = await work(items[index]!, controller.signal);
			} catch (error) {
				failure ??= { error };
				controller.abort(error);
				return;
			}
		}
	});
	await Promise.all(lanes);
	signal.removeEventListener('abort', link);
	if (failure !== null) throw (failure as { error: unknown }).error;
	return results;
}

function admissionFailure(error: unknown, fallback: string): { ok: false; reason: string; action: string } {
	const message = error instanceof Error ? error.message : fallback;
	const unsupported = message.startsWith('unsupported-image-encoding:');
	const detail = unsupported ? message.slice('unsupported-image-encoding:'.length).trim() : message;
	const [reason, ...rest] = detail.split('. ');
	return {
		ok: false,
		reason: reason ?? detail,
		action: rest.length > 0 ? rest.join('. ') : 'Export the map as an 8-bit sRGB PNG, JPEG or WebP.'
	};
}

/** Whether the container stores lossy samples (JPEG, or a lossy WebP frame). */
function isLossy(bytes: Uint8Array, mime: string): boolean {
	if (mime === 'image/jpeg') return true;
	if (mime !== 'image/webp') return false;
	for (let offset = 12; offset + 4 <= bytes.length && offset < 64; offset += 1) {
		if (bytes[offset] === 0x56 && bytes[offset + 1] === 0x50 && bytes[offset + 2] === 0x38 && bytes[offset + 3] === 0x20) {
			return true;
		}
	}
	return false;
}

/** Hash and probe one file. Unreadable files still produce a fact, refused for both roles. */
export async function readSetFileFact(key: string, name: string, bytes: Uint8Array): Promise<SetFileFact> {
	const hash = `sha256-${await imageSha256(bytes)}`;
	let mime: SetImageMime | null = null;
	let width = 0;
	let height = 0;
	let colour: SetFileFact['colour'];
	try {
		const probe = probeArtworkImage(bytes);
		mime = probe.mime;
		width = probe.pixelWidth;
		height = probe.pixelHeight;
		colour = { ok: true, lossy: isLossy(bytes, probe.mime) };
	} catch (error) {
		colour = admissionFailure(error, 'Colour maps require a static 8-bit PNG, JPEG or WebP image.');
	}
	let raw: SetFileFact['raw'];
	let precision: 8 | null = null;
	try {
		const probe = probeRawImage(bytes);
		mime ??= probe.mime;
		if (width === 0) {
			width = probe.width;
			height = probe.height;
		}
		precision = probe.bitDepth;
		raw = { ok: true, lossy: isLossy(bytes, probe.mime) };
	} catch (error) {
		raw = admissionFailure(error, 'Material maps require a valid static PNG, JPEG or WebP image.');
	}
	return { key, name, hash, mime, width, height, precision, colour, raw };
}

/**
 * Read every file's facts and keep its bytes in session memory. Duplicate keys
 * are a caller error. Concurrency is capped at two.
 */
export async function readSetFileFacts(
	files: readonly SetFileInput[],
	signal: AbortSignal
): Promise<SetFileSession> {
	const keys = new Set<string>();
	for (const input of files) {
		if (keys.has(input.key)) throw new Error(`Duplicate set file key "${input.key}".`);
		keys.add(input.key);
	}
	const bytes = new Map<string, Uint8Array>();
	const facts = await mapBounded(files, MATERIAL_SET_CONCURRENCY, signal, async (input) => {
		const data = new Uint8Array(await input.file.arrayBuffer());
		signal.throwIfAborted();
		bytes.set(input.key, data);
		return readSetFileFact(input.key, input.file.name, data);
	});
	signal.throwIfAborted();
	let released = false;
	return {
		facts,
		factsByKey: () => new Map(facts.map((fact) => [fact.key, fact])),
		bytesOf: (key) => (released ? undefined : bytes.get(key)),
		release() {
			released = true;
			bytes.clear();
		}
	};
}

export type PrepareDraftResult =
	| { readonly ok: true; readonly draft: PreparedFinishDraft }
	| { readonly ok: false; readonly code: 'aborted' | 'unresolved-role'; readonly issues: readonly DraftIssue[] };

/**
 * Compose and digest one draft. Manual creation and a corrected set proposal
 * both arrive here as `DraftEdits`, so both produce the same recipe and proof.
 */
export async function prepareDraft(
	edits: DraftEdits,
	files: SetFileSession,
	expectedRevision: AcceptedRevision,
	signal: AbortSignal,
	materialProofs: MaterialProofRegistry
): Promise<PrepareDraftResult> {
	if (signal.aborted) return { ok: false, code: 'aborted', issues: [] };
	const composed = composeDraft(edits, files.factsByKey());
	if (!composed.ok) return { ok: false, code: 'unresolved-role', issues: composed.issues };
	const prepared = await materialProofs.prepareFinishRegistration(composed.draft.recipe);
	if (signal.aborted) return { ok: false, code: 'aborted', issues: [] };
	if (!prepared.ok) {
		return {
			ok: false,
			code: 'unresolved-role',
			issues: prepared.issues.map((issue) => ({
				code: issue.code === 'out-of-range' ? 'out-of-range' : 'invalid-value',
				path: issue.path,
				...(issue.role === undefined ? {} : { role: issue.role }),
				action: issue.action ?? 'Correct this value.'
			}))
		};
	}
	const facts = files.factsByKey();
	const sources = new Map<Hash, VerifiedImageSource>();
	for (const [hash, key] of [...composed.draft.files].sort(([left], [right]) => (left < right ? -1 : 1))) {
		const fact = facts.get(key)!;
		let held: Uint8Array | undefined = files.bytesOf(key);
		if (held === undefined) return { ok: false, code: 'aborted', issues: [] };
		const length = held.length;
		sources.set(hash, {
			hash,
			mime: fact.mime!,
			length,
			name: fact.name,
			async read(readSignal) {
				readSignal?.throwIfAborted();
				if (held === undefined) throw new Error('This draft source was released. Choose the files again.');
				return held;
			},
			release() {
				held = undefined;
			}
		});
	}
	return {
		ok: true,
		draft: {
			expectedRevision,
			name: composed.draft.name,
			recipe: composed.draft.recipe,
			recipeHash: prepared.hash,
			sources
		}
	};
}

/** The objects and surfaces a new Finish is assigned to. Empty is an unassigned Finish. */
export type DraftTargets = {
	readonly entityIds: readonly string[];
	readonly surfaces: readonly Extract<LayoutSurfaceRef, { kind: string }>[];
};

export type AcceptDraftHost = {
	readonly api: ProjectApi;
	readonly projectId: string;
	/** The accepted source and its revision at the time of the call. */
	readonly current: () => { readonly source: ProjectEnvelope; readonly revision: AcceptedRevision };
	readonly accept: (intent: AuthoringIntent) => Promise<{
		readonly kind: string;
		readonly code?: string;
		/** F4 carries the planner's own refusal code here. */
		readonly reason?: string | null;
		readonly message?: string;
	}>;
	readonly targetAnalysis?: TargetAnalysis;
	readonly entityReference: (source: ProjectEnvelope, entityId: string) => SemanticReference;
	readonly surfaceReference: (source: ProjectEnvelope, surface: DraftTargets['surfaces'][number]) => SemanticReference;
	/** Override the importer (tests); defaults to P20's `importProjectImage`. */
	readonly importImage?: typeof importProjectImage;
};

export type AcceptDraftRefusal =
	| 'aborted'
	| 'stale-revision'
	| 'target-pending'
	| 'image-pin-mismatch'
	| 'unresolved-role'
	| 'upload-failed'
	| 'refused';

export type AcceptDraftResult =
	| { readonly ok: true; readonly finishId: string; readonly revision: AcceptedRevision }
	| {
			readonly ok: false;
			readonly code: AcceptDraftRefusal;
			readonly message: string;
			readonly issues: readonly AcceptIssue[];
	  };

/** The Finish id one acceptance allocates: a pure function of its operation id. */
export function draftFinishId(operationId: string): string {
	return `finish-${operationId}`;
}

type AcceptIssue = { readonly path: string; readonly code: string; readonly message: string };

function sameRevision(left: AcceptedRevision, right: AcceptedRevision): boolean {
	return left.projectId === right.projectId && left.revisionId === right.revisionId;
}

function refused(code: AcceptDraftRefusal, message: string, issues: readonly AcceptIssue[] = []): AcceptDraftResult {
	return { ok: false, code, message, issues };
}

/** Texture ids the accepted source already references, for deterministic reuse. */
function referencedTextureIds(source: ProjectEnvelope): Set<string> {
	return new Set(source.units.scene.data.textures.map((texture) => texture.id));
}

/**
 * A target the accepted revision cannot paint at all, as opposed to one whose
 * analysis is still pending. A light or Artwork never becomes paintable, so it
 * must not be reported as something to retry.
 */
function targetProblem(source: ProjectEnvelope, targets: DraftTargets): string | null {
	const entities = new Map(source.units.scene.data.entities.map((entity) => [entity.id, entity]));
	for (const id of targets.entityIds) {
		const entity = entities.get(id);
		if (entity === undefined) return 'That object is not in the current revision.';
		if (!isFinishTarget(entity)) {
			return entity.kind === 'light' ? 'Lights have no Finish.' : 'That subject cannot take a Finish.';
		}
	}
	for (const surface of targets.surfaces) {
		// The register planner admits only a present surface. A dormant one (e.g. the
		// lid of an open-to-sky room) draws nothing, so it can never qualify: refuse
		// it for good instead of reporting it as pending analysis.
		const lifecycle = resolveLayoutSurface(source.units.layout.data, surface);
		if (lifecycle === 'dormant') return 'That surface is not drawn right now, so it cannot take a Finish.';
		if (lifecycle !== 'present') return 'That surface changed. Try again.';
	}
	return null;
}

function targetsArePending(
	source: ProjectEnvelope,
	targets: DraftTargets,
	analysis: TargetAnalysis | undefined
): boolean {
	const requests = [
		...targets.entityIds.map((entityId) => ({
			subject: entityId,
			domain: 'scene' as const,
			entityId,
			expectedGeometryRevision: source.units.scene.header.contentRevision
		})),
		...targets.surfaces.map((surface) => ({
			subject: surfaceKey(surface),
			domain: 'layout' as const,
			surface,
			expectedGeometryRevision: source.units.layout.header.contentRevision
		}))
	];
	if (requests.length === 0) return false;
	const facts = analysis?.(requests) ?? null;
	if (facts === null) return true;
	return requests.some((request) => {
		const answer = facts.find((entry) => entry.subject === request.subject);
		return answer === undefined || answer.geometryRevision !== request.expectedGeometryRevision || answer.draws.length === 0;
	});
}

/**
 * Stage and register one prepared draft as exactly one history entry.
 *
 * Distinct digests are staged two at a time; identical bytes are uploaded once.
 */
export async function acceptDraft(
	draft: PreparedFinishDraft,
	targets: DraftTargets,
	operationId: string,
	signal: AbortSignal,
	host: AcceptDraftHost
): Promise<AcceptDraftResult> {
	if (signal.aborted) return refused('aborted', 'Cancelled. Nothing was added.');
	// One registration addresses one target domain; F4 never widens it to a
	// compound Layout + Scene write. Refuse before any byte leaves the browser.
	if (targets.entityIds.length > 0 && targets.surfaces.length > 0) {
		return refused('refused', 'Assign the new Finish to objects or to surfaces first, then paint the rest.');
	}
	const before = host.current();
	if (!sameRevision(before.revision, draft.expectedRevision)) {
		return refused('stale-revision', 'The project changed since this material was prepared. Review it again.');
	}
	const unpaintable = targetProblem(before.source, targets);
	if (unpaintable !== null) return refused('refused', unpaintable);
	if (targetsArePending(before.source, targets, host.targetAnalysis)) {
		return refused('target-pending', 'The selected objects are still being analysed. Try again in a moment.');
	}
	const importImage = host.importImage ?? importProjectImage;
	const prefer = referencedTextureIds(before.source);
	const sources = [...draft.sources.values()].sort((left, right) => (left.hash < right.hash ? -1 : 1));
	let staged: ImportedProjectImage[];
	try {
		staged = await mapBounded(sources, MATERIAL_SET_CONCURRENCY, signal, async (source, laneSignal) => {
			const bytes = await source.read(laneSignal);
			const file = new File([bytes as BlobPart], source.name, { type: source.mime });
			return importImage(host.api, host.projectId, file, laneSignal, FINISH_IMAGE_POLICY, { preferAssetIds: prefer });
		});
	} catch (error) {
		if (signal.aborted) return refused('aborted', 'Cancelled. Uploaded images stay in the project; no Finish was added.');
		return refused(
			'upload-failed',
			error instanceof Error ? error.message : 'An image could not be uploaded. Try again.'
		);
	}
	for (const [index, image] of staged.entries()) {
		const source = sources[index]!;
		if (image.sha256 !== source.hash || image.mime !== source.mime || image.byteSize !== source.length) {
			return refused('image-pin-mismatch', `“${source.name}” changed while it was uploading. Choose it again.`);
		}
	}
	// IO is over: recheck what the write depends on before issuing it.
	if (signal.aborted) return refused('aborted', 'Cancelled. Uploaded images stay in the project; no Finish was added.');
	const after = host.current();
	if (!sameRevision(after.revision, draft.expectedRevision)) {
		return refused('stale-revision', 'The project changed while images were uploading. Review the material again.');
	}
	const unpaintableAfter = targetProblem(after.source, targets);
	if (unpaintableAfter !== null) return refused('refused', unpaintableAfter);
	if (targetsArePending(after.source, targets, host.targetAnalysis)) {
		return refused('target-pending', 'The selected objects changed while images were uploading. Try again.');
	}
	const scene = after.source.units.scene.data;
	const resources = after.source.units.resources.data.resources;
	const images = staged.map((image) => {
		const recorded = scene.textures.some((texture) => texture.id === image.assetId);
		const pinned = resources.some(
			(resource) => resource.kind === 'texture' && resource.id === image.assetId && resource.pin?.hash === image.sha256
		);
		return {
			hash: image.sha256,
			source: { textureId: image.assetId },
			...(recorded && pinned
				? {}
				: { texture: { name: image.name, pin: { hash: image.sha256, mime: image.mime, size: image.byteSize } } })
		};
	});
	const finishId = draftFinishId(operationId);
	const outcome = await host.accept({
		version: 1,
		kind: SCENE_FINISH_REGISTER,
		operationId,
		expectedRevision: after.revision,
		targets: [
			...targets.entityIds.map((id) => host.entityReference(after.source, id)),
			...targets.surfaces.map((surface) => host.surfaceReference(after.source, surface))
		],
		payload: {
			name: draft.name,
			recipeHash: draft.recipeHash,
			recipe: draft.recipe,
			images,
			entityIds: [...targets.entityIds],
			...(targets.surfaces.length === 0 ? {} : { surfaces: [...targets.surfaces] }),
			targetFacts: []
		},
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-finish', id: finishId }]
	} as AuthoringIntent);
	if (outcome.kind !== 'accepted') {
		const reason = outcome.reason ?? outcome.code ?? outcome.kind;
		const code: AcceptDraftRefusal =
			reason === 'target-pending'
				? 'target-pending'
				: reason === 'stale-revision'
					? 'stale-revision'
					: reason === 'image-pin-conflict' || reason === 'texture-mismatch'
						? 'image-pin-mismatch'
						: reason === 'aborted'
							? 'aborted'
							: 'refused';
		return refused(code, outcome.message ?? 'The material could not be added.', [
			{ path: '$', code: reason, message: outcome.message ?? outcome.kind }
		]);
	}
	return { ok: true, finishId, revision: host.current().revision };
}
