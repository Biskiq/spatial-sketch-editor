/**
 * T2.P02.S02 — approved creator-model bytes for rendering.
 *
 * A Scene entity names a `model` resource id; the bytes are the resource pin's
 * immutable derivative. This module is the editor's one resolver: it fetches
 * each approved derivative through S01's owner-only hash-keyed route, keeps one
 * object URL per content hash while it is referenced, and revokes it when the
 * accepted source no longer needs it. A fresh reopen resolves the pins again
 * instead of trusting a stale session URL.
 *
 * Runtime-safe callers (Preview's visitor surface) receive the URL map; they
 * never learn about editor sessions, API routes or authoring modules.
 */
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { createModelImportClient, type ModelImportClient } from '$lib/platform/model-import-client';

export type ApprovedModelSources = {
	/** `assetId` (the model resource id) → object URL of the approved derivative. */
	readonly urls: ReadonlyMap<string, string>;
	/** `assetId` → why its bytes are unavailable; the fallback box stays honest. */
	readonly failures: ReadonlyMap<string, string>;
	/** Revoke exactly the URLs this resolution acquired. */
	dispose(): void;
};

type CachedBytes = {
	readonly url: string;
	readonly bytes: Uint8Array;
	refs: number;
};

/** One immutable derivative per pin hash, shared by every instance. */
const cache = new Map<string, CachedBytes>();

function acquire(hash: string, bytes: Uint8Array): string {
	const existing = cache.get(hash);
	if (existing !== undefined) {
		existing.refs += 1;
		return existing.url;
	}
	const url = URL.createObjectURL(new Blob([bytes.slice() as unknown as BlobPart], { type: 'model/gltf-binary' }));
	cache.set(hash, { url, bytes, refs: 1 });
	return url;
}

/** Take one more reference to bytes already resolved for the same hash. */
function retainExisting(hash: string): string | null {
	const existing = cache.get(hash);
	if (existing === undefined) return null;
	existing.refs += 1;
	return existing.url;
}

function release(hash: string): void {
	const existing = cache.get(hash);
	if (existing === undefined) return;
	existing.refs -= 1;
	if (existing.refs > 0) return;
	URL.revokeObjectURL(existing.url);
	cache.delete(hash);
}

export type ApprovedModelPin = {
	readonly assetId: string;
	readonly hash: string;
};

/** Every approved model resource one envelope can render. */
export function approvedModelPins(envelope: ProjectEnvelope): readonly ApprovedModelPin[] {
	return envelope.units.resources.data.resources
		.filter(
			(resource) =>
				resource.kind === 'model' && resource.pin !== null && resource.unresolved === null && resource.model !== undefined
		)
		.map((resource) => ({ assetId: resource.id, hash: resource.pin!.hash }));
}

export type ResolveApprovedModelsInput = {
	readonly envelope: ProjectEnvelope;
	readonly projectId: string;
	readonly apiOrigin: string;
	readonly signal?: AbortSignal;
	/** Test seam: the transport, or `null` when the API is not configured. */
	readonly client?: Pick<ModelImportClient, 'loadContent'> | null;
};

/**
 * Resolve every approved derivative for one accepted source.
 *
 * Failures are reported per resource rather than thrown: one unavailable model
 * must not blank the Stage, and the fallback box carries the same approved
 * footprint so the reading stays truthful about what is missing.
 */
export async function resolveApprovedModels(
	input: ResolveApprovedModelsInput
): Promise<ApprovedModelSources> {
	const pins = approvedModelPins(input.envelope);
	const client = input.client === undefined ? createModelImportClient(input.apiOrigin) : input.client;
	const urls = new Map<string, string>();
	const failures = new Map<string, string>();
	const acquired: string[] = [];
	if (pins.length === 0 || client === null) {
		if (pins.length > 0) {
			for (const pin of pins) failures.set(pin.assetId, 'The API is not configured, so approved model bytes are unavailable.');
		}
		return { urls, failures, dispose() {} };
	}
	const seen = new Set<string>();
	for (const pin of pins) {
		if (seen.has(pin.assetId)) continue;
		seen.add(pin.assetId);
		// Two instances of one immutable revision share one fetch and one URL: the
		// pin hash is the byte identity, so the second instance adds a reference
		// rather than downloading the same derivative again.
		const alreadyResolved = acquired.includes(pin.hash) ? retainExisting(pin.hash) : null;
		if (alreadyResolved !== null) {
			urls.set(pin.assetId, alreadyResolved);
			acquired.push(pin.hash);
			continue;
		}
		try {
			const bytes = await client.loadContent(input.projectId, pin.hash, input.signal);
			urls.set(pin.assetId, acquire(pin.hash, bytes));
			acquired.push(pin.hash);
		} catch (error) {
			if (input.signal?.aborted === true) {
				for (const hash of acquired) release(hash);
				throw error;
			}
			failures.set(
				pin.assetId,
				error instanceof Error ? error.message : 'The approved model could not be loaded.'
			);
		}
	}
	return {
		urls,
		failures,
		dispose() {
			for (const hash of acquired) release(hash);
			acquired.length = 0;
		}
	};
}

/** The empty resolution a route holds before any source is admitted. */
export const NO_APPROVED_MODELS: ApprovedModelSources = {
	urls: new Map(),
	failures: new Map(),
	dispose() {}
};
